// ── FORMATTERS ───────────────────────────────────────────────────────────────
export const cur = (n) => Number(n || 0).toLocaleString("ru-RU") + " QAR";
// Бизнес живёт по времени Катара: даты считаем по Asia/Qatar (UTC+3), даже если запись
// вносят с телефона в другом часовом поясе (например, в поездке за границей).
export const TZ = "Asia/Qatar";
export function todayStr() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
// Сдвиг даты "YYYY-MM-DD" на n дней (без влияния часового пояса устройства)
export function addDays(d, n) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
// Время внесения записи (created_at) по Катару, "14:05"
export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "";
export const fmt = (d) =>
  d ? new Date(d + "T12:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "";
export const fmtFull = (d) =>
  new Date(d + "T12:00").toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

// Границы периода (from/to включительно) для фильтров "Сегодня/Неделя/Месяц/Всё/свой"
export function periodRange(period, fromDate, toDate) {
  const today = todayStr();
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0=вс, 1=пн...
    const from = addDays(today, dow === 0 ? -6 : 1 - dow);
    return { from, to: addDays(from, 6) };
  }
  if (period === "month") {
    const [y, m] = today.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: today.slice(0, 8) + "01", to: today.slice(0, 8) + String(last).padStart(2, "0") };
  }
  if (period === "custom") return { from: fromDate || "2000-01-01", to: toDate || today };
  return { from: "2000-01-01", to: "2099-12-31" };
}

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
    // цена фиксируется на момент заказа (i.price); у старых записей без снимка —
    // берём текущую цену меню, чтобы ничего не сломать до миграции/бэкафилла
    const price = i.price != null ? Number(i.price) : menu.find((mi) => mi.id === i.menu_item_id)?.price || 0;
    return s + price * i.qty;
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
// Сортировка — по дате получения денег (paid_at), а не по дате заказа: иначе долг,
// возвращённый позже за старый заказ, считался бы "старым" деньгами и пропадал из остатка.
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
        paidAt: p.paid_at,
        createdAt: p.created_at,
        orderDate: order?.delivery_date,
      };
    })
    .sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// Из каких оплат клиентов состоит текущий остаток счёта: выведенные/потраченные деньги
// списываются со старых поступлений в первую очередь (FIFO), поэтому остаток — это всегда
// самые свежие поступления. balance — текущий остаток счёта (см. accountBalance).
export function accountRemainingIncome(data, account, balance) {
  const entries = accountIncome(data, account); // от новых к старым
  if (balance <= 0) return [];
  const out = [];
  let sum = 0;
  for (const e of entries) {
    if (sum >= balance) break;
    out.push(e);
    sum += e.amount;
  }
  return out;
}

// ── ДВИЖЕНИЕ ДЕНЕГ ПО СЧЕТАМ ────────────────────────────────────────────────
export const ACCOUNTS = ["madina", "moldir", "card"];
const accountOf = (s) => (s === "cash" ? "madina" : s); // cash = старое имя счёта Мадины

// Все операции по счетам Мадина/Молдир/Карта в хронологическом порядке (от старых к новым):
// оплаты клиентов (+), закупки, выводы, погашения кредитов (−). Считается из тех же таблиц,
// что и accountBalance, поэтому итоговые остатки совпадают. У каждой строки:
// balanceAfter — остаток этого счёта после операции, totalAfter — сумма всех трёх счетов.
export function accountLedger(data) {
  const rows = [];
  data.payments.forEach((p) => {
    const order = data.orders.find((o) => o.id === p.order_id);
    const client = order ? data.clients.find((c) => c.id === order.client_id) : null;
    rows.push({
      id: "p" + p.id, kind: "payment", account: accountOf(p.method), date: p.paid_at, createdAt: p.created_at,
      amount: Number(p.amount), title: client?.name || "—", orderDate: order?.delivery_date,
    });
  });
  data.purchases.filter((p) => p.type === "buy").forEach((p) => {
    rows.push({
      id: "b" + p.id, kind: "purchase", account: accountOf(p.source), date: p.purchased_at, createdAt: p.created_at,
      amount: -Number(p.total_price || 0), title: `Закупка: ${p.ingredient}`, note: `${p.qty} ${p.unit || ""}`.trim(),
    });
  });
  data.withdrawals.forEach((w) => {
    rows.push({
      id: "w" + w.id, kind: "withdrawal", account: accountOf(w.source), date: w.withdrawn_at, createdAt: w.created_at,
      amount: -Number(w.amount), title: "Вывод", note: w.note,
    });
  });
  data.repayments.forEach((r) => {
    const creditor = r.creditor === "azamat" ? "Азамат" : "Асхат";
    rows.push({
      id: "r" + r.id, kind: "repayment", account: accountOf(r.source), date: r.repaid_at, createdAt: r.created_at,
      amount: -Number(r.amount), title: `Погашение кредита ${creditor}`, note: r.note,
    });
  });

  const out = rows
    .filter((r) => ACCOUNTS.includes(r.account))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
  const bal = { madina: 0, moldir: 0, card: 0 };
  let total = 0;
  out.forEach((r) => {
    bal[r.account] += r.amount;
    total += r.amount;
    r.balanceAfter = Math.round(bal[r.account] * 100) / 100; // убираем хвосты вида 670.3099999
    r.totalAfter = Math.round(total * 100) / 100;
  });
  return out;
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
