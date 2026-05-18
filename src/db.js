import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL || "https://placeholder.supabase.co", SUPABASE_KEY || "placeholder");

// Работает с любым форматом ключа (eyJ... или sb_publishable_...)
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export async function loadAll() {
  const [clients, menu, orders, orderItems, payments, purchases, withdrawals, repayments] =
    await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("menu_items").select("*").order("category, name"),
      supabase.from("orders").select("*").order("delivery_date"),
      supabase.from("order_items").select("*"),
      supabase.from("payments").select("*"),
      supabase.from("purchases").select("*").order("purchased_at", { ascending: false }),
      supabase.from("withdrawals").select("*").order("withdrawn_at", { ascending: false }),
      supabase.from("repayments").select("*").order("repaid_at", { ascending: false }),
    ]);

  const ordersWithItems = (orders.data || []).map((o) => ({
    ...o,
    items: (orderItems.data || []).filter((i) => i.order_id === o.id),
  }));

  return {
    clients: clients.data || [],
    menu: menu.data || [],
    orders: ordersWithItems,
    payments: payments.data || [],
    purchases: purchases.data || [],
    withdrawals: withdrawals.data || [],
    repayments: repayments.data || [],
  };
}

export const upsertClient = (c) =>
  c.id
    ? supabase.from("clients").update({ name: c.name, phone: c.phone, note: c.note }).eq("id", c.id)
    : supabase.from("clients").insert({ name: c.name, phone: c.phone, note: c.note });
export const deleteClient = (id) => supabase.from("clients").delete().eq("id", id);

export const upsertMenu = (m) => {
  const data = { name: m.name, price: m.price, cost: m.cost, category: m.category, unit: m.unit };
  return m.id ? supabase.from("menu_items").update(data).eq("id", m.id) : supabase.from("menu_items").insert(data);
};
export const deleteMenu = (id) => supabase.from("menu_items").delete().eq("id", id);

export async function upsertOrder(o) {
  const data = {
    client_id: o.client_id,
    delivery_date: o.delivery_date,
    delivery_time: o.delivery_time || null,
    status: o.status,
    disc_type: o.disc_type,
    disc_value: o.disc_value,
    note: o.note,
  };
  let orderId = o.id;
  if (orderId) {
    await supabase.from("orders").update(data).eq("id", orderId);
    await supabase.from("order_items").delete().eq("order_id", orderId);
  } else {
    const { data: inserted, error } = await supabase.from("orders").insert(data).select().single();
    if (error) throw error;
    orderId = inserted.id;
  }
  if (o.items?.length) {
    await supabase.from("order_items").insert(
      o.items.map((i) => ({ order_id: orderId, menu_item_id: i.menu_item_id, qty: i.qty }))
    );
  }
  return orderId;
}
export const updateOrderStatus = (id, status) => supabase.from("orders").update({ status }).eq("id", id);
export const transferOrder = (id, delivery_date, delivery_time) =>
  supabase.from("orders").update({ delivery_date, delivery_time }).eq("id", id);
export const deleteOrder = (id) => supabase.from("orders").delete().eq("id", id);

export const addPayment = (p) =>
  supabase.from("payments").insert({
    order_id: p.order_id, amount: p.amount, method: p.method,
    paid_at: p.paid_at || new Date().toISOString().slice(0, 10),
  });

export const addPurchase = (p) =>
  supabase.from("purchases").insert({
    type: p.type, ingredient: p.ingredient, qty: p.qty, unit: p.unit,
    total_price: p.total_price || 0, source: p.source || null,
    purchased_at: p.purchased_at || new Date().toISOString().slice(0, 10),
  });
export const deletePurchase = (id) => supabase.from("purchases").delete().eq("id", id);

export const addWithdrawal = (w) =>
  supabase.from("withdrawals").insert({
    amount: w.amount, source: w.source, note: w.note,
    withdrawn_at: w.withdrawn_at || new Date().toISOString().slice(0, 10),
  });
export const deleteWithdrawal = (id) => supabase.from("withdrawals").delete().eq("id", id);

export const addRepayment = (r) =>
  supabase.from("repayments").insert({
    amount: r.amount, source: r.source, note: r.note,
    repaid_at: r.repaid_at || new Date().toISOString().slice(0, 10),
  });
export const deleteRepayment = (id) => supabase.from("repayments").delete().eq("id", id);
