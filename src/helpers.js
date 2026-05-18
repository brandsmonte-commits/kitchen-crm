// ── FORMATTERS ───────────────────────────────────────────────────────────────
export const cur = (n) => Number(n || 0).toLocaleString("ru-RU") + " QAR";
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const fmt = (d) =>
  d ? new Date(d + "T12:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "";
export const fmtFull = (d) =>
  new Date(d + "T12:00").toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

// ── CONSTANTS ────────────────────────────────────────────────────────────────
export const STATUS = {
  new:        { label: "Новый",        cls: "s-new" },
  confirmed:  { label: "Подтверждён",  cls: "s-confirmed" },
  cooking:    { label: "Готовится",    cls: "s-cooking" },
  delivered:  { label: "Доставлен",    cls: "s-delivered" },
  cancelled:  { label: "Отменён",      cls: "s-cancelled" },
};

export const SOURCE_LABEL = { cash: "💵 Нал", card: "💳 Карта", husband: "🤝 Кредит" };

// ── ORDER MATH ───────────────────────────────────────────────────────────────
export function orderSubtotal(o, menu) {
  return (o.items || []).reduce((s, i) => {
    const m = menu.find((mi) => mi.id === i.menu_item_id);
    return s + (m ? m.price * i.qty : 0);
  }, 0);
}

export function orderDiscount(o, menu) {
  const sub = orderSubtotal(o, menu);
  if (o.disc_type === "percent") return Math.round((sub * Number(o.disc_value || 0)) / 100);
  if (o.disc_type === "amount") return Math.min(sub, Number(o.disc_value || 0));
  return 0;
}

export const orderTotal = (o, menu) => orderSubtotal(o, menu) - orderDiscount(o, menu);

export const orderPaymentsTotal = (o, payments) =>
  payments.filter((p) => p.order_id === o.id).reduce((s, p) => s + Number(p.amount), 0);

export function orderDebt(o, menu, payments) {
  if (o.status === "cancelled") return 0;
  return Math.max(0, orderTotal(o, menu) - orderPaymentsTotal(o, payments));
}

export const orderPaid = (o, menu, payments) =>
  Math.min(orderTotal(o, menu), orderPaymentsTotal(o, payments));

export function paymentState(o, menu, payments) {
  if (o.status === "cancelled") return "cancelled";
  const t = orderTotal(o, menu);
  const p = orderPaymentsTotal(o, payments);
  if (p >= t && t > 0) return "paid-full";
  if (p > 0) return "paid-partial";
  return "unpaid";
}

// ── ACCOUNT BALANCES ─────────────────────────────────────────────────────────
export function cashBalance(d) {
  let b = 0;
  d.payments.filter((p) => p.method === "cash").forEach((p) => (b += Number(p.amount)));
  d.purchases.filter((p) => p.type === "buy" && p.source === "cash").forEach((p) => (b -= Number(p.total_price)));
  d.withdrawals.filter((w) => w.source === "cash").forEach((w) => (b -= Number(w.amount)));
  d.repayments.filter((r) => r.source === "cash").forEach((r) => (b -= Number(r.amount)));
  return b;
}

export function cardBalance(d) {
  let b = 0;
  d.payments.filter((p) => p.method === "card").forEach((p) => (b += Number(p.amount)));
  d.purchases.filter((p) => p.type === "buy" && p.source === "card").forEach((p) => (b -= Number(p.total_price)));
  d.withdrawals.filter((w) => w.source === "card").forEach((w) => (b -= Number(w.amount)));
  d.repayments.filter((r) => r.source === "card").forEach((r) => (b -= Number(r.amount)));
  return b;
}

export function husbandDebt(d) {
  const borrowed = d.purchases
    .filter((p) => p.type === "buy" && p.source === "husband")
    .reduce((s, p) => s + Number(p.total_price), 0);
  const repaid = d.repayments.reduce((s, r) => s + Number(r.amount), 0);
  return Math.max(0, borrowed - repaid);
}

export const husbandBorrowed = (d) =>
  d.purchases.filter((p) => p.type === "buy" && p.source === "husband").reduce((s, p) => s + Number(p.total_price), 0);

export const husbandRepaid = (d) => d.repayments.reduce((s, r) => s + Number(r.amount), 0);
