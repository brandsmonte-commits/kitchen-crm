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
  new:        { label: "Новый",      cls: "s-new" },
  cooking:    { label: "Готов",      cls: "s-cooking" },
  delivered:  { label: "Доставлен", cls: "s-delivered" },
  cancelled:  { label: "Отменён",   cls: "s-cancelled" },
};

export const SOURCE_LABEL = {
  madina:  "💵 Мадина",
  moldir:  "💵 Молдир",
  card:    "💳 Карта",
  husband: "🤝 Асхат",
  azamat:  "🤝 Азамат",
  // обратная совместимость со старыми записями
  cash:    "💵 Нал",
};

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
export function accountBalance(data, account) {
  let b = 0;
  data.payments.filter((p) => p.method === account).forEach((p) => (b += Number(p.amount)));
  data.purchases.filter((p) => p.type === "buy" && p.source === account).forEach((p) => (b -= Number(p.total_price)));
  data.withdrawals.filter((w) => w.source === account).forEach((w) => (b -= Number(w.amount)));
  data.repayments.filter((r) => r.source === account).forEach((r) => (b -= Number(r.amount)));
  return b;
}

// Обратная совместимость — cash = madina + moldir вместе
export const cashBalance = (d) => accountBalance(d, "madina") + accountBalance(d, "moldir");
export const cardBalance = (d) => accountBalance(d, "card");

// Поступления на счёт (кто заплатил, сколько, за какой заказ) — без выводов и закупок,
// только оплаты клиентов, для показа "откуда деньги" по клику на баланс счёта.
export function accountIncome(data, account) {
  const methods = account === "madina" ? ["madina", "cash"] : [account];
  return data.payments
    .filter((p) => methods.includes(p.method))
    .map((p) => {
      const order = data.orders.find((o) => o.id === p.order_id);
      const client = order ? data.clients.find((c) => c.id === order.client_id) : null;
      return {
        id: p.id,
        amount: Number(p.amount),
        clientName: client?.name || "—",
        orderDate: order?.delivery_date || p.paid_at,
      };
    })
    .sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""));
}

// ── КРЕДИТЫ (ДОЛГИ) ──────────────────────────────────────────────────────────
// creditor: "husband" (= Асхат, старое имя поля сохранено для совместимости
// со старыми записями в purchases.source) | "azamat" (Азамат).
// repayments.creditor указывает, к какому из кредиторов относится погашение.
export function creditorBorrowed(d, creditor) {
  return d.purchases
    .filter((p) => p.type === "buy" && p.source === creditor)
    .reduce((s, p) => s + Number(p.total_price), 0);
}

export function creditorRepaid(d, creditor) {
  return d.repayments
    .filter((r) => (r.creditor || "husband") === creditor) // старые записи без поля = Асхат
    .reduce((s, r) => s + Number(r.amount), 0);
}

export function creditorDebt(d, creditor) {
  return Math.max(0, creditorBorrowed(d, creditor) - creditorRepaid(d, creditor));
}

// Обратная совместимость (Асхат = старое поле "husband")
export const husbandDebt = (d) => creditorDebt(d, "husband");
export const husbandBorrowed = (d) => creditorBorrowed(d, "husband");
export const husbandRepaid = (d) => creditorRepaid(d, "husband");
