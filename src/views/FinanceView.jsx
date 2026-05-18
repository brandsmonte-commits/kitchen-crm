import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import {
  cur, fmt, todayStr, SOURCE_LABEL,
  cashBalance, cardBalance, husbandDebt, husbandBorrowed, husbandRepaid,
  orderTotal, orderDebt,
} from "../helpers";
import * as db from "../db";

export default function FinanceView({ data, refresh }) {
  const [period, setPeriod] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRepay, setShowRepay] = useState(false);

  const cash = cashBalance(data);
  const card = cardBalance(data);
  const hDebt = husbandDebt(data);
  const hBorrowed = husbandBorrowed(data);
  const hRepaid = husbandRepaid(data);

  function getRange() {
    const now = new Date();
    if (period === "today") return { from: todayStr(), to: todayStr() };
    if (period === "week") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      return { from: d.toISOString().slice(0, 10), to: todayStr() };
    }
    if (period === "month") return { from: now.toISOString().slice(0, 8) + "01", to: todayStr() };
    if (period === "custom") return { from: fromDate || "2000-01-01", to: toDate || todayStr() };
    return { from: "2000-01-01", to: "2099-12-31" };
  }
  const { from, to } = getRange();

  const ordersInPeriod = data.orders.filter(
    (o) => o.delivery_date >= from && o.delivery_date <= to && o.status !== "cancelled"
  );
  const revenue = ordersInPeriod.reduce((s, o) => s + orderTotal(o, data.menu), 0);

  const paysInPeriod = data.payments.filter((p) => p.paid_at >= from && p.paid_at <= to);
  const paidCash = paysInPeriod.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const paidCard = paysInPeriod.filter((p) => p.method === "card").reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal = paidCash + paidCard;

  const debtTotal = data.orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + orderDebt(o, data.menu, data.payments), 0);

  const costOrders = ordersInPeriod.reduce(
    (s, o) =>
      s +
      o.items.reduce((ss, i) => {
        const m = data.menu.find((mi) => mi.id === i.menu_item_id);
        return ss + (m?.cost || 0) * i.qty;
      }, 0),
    0
  );

  const purchTotal = data.purchases
    .filter((p) => p.type === "buy" && p.purchased_at >= from && p.purchased_at <= to)
    .reduce((s, p) => s + Number(p.total_price || 0), 0);

  const profit = revenue - costOrders;

  const periodWithdraws = data.withdrawals.filter((w) => w.withdrawn_at >= from && w.withdrawn_at <= to);

  // husband credit history (combined borrows + repays, sorted by date)
  const credits = [
    ...data.purchases.filter((p) => p.type === "buy" && p.source === "husband").map((p) => ({ ...p, _t: "borrow" })),
    ...data.repayments.map((r) => ({ ...r, _t: "repay" })),
  ].sort((a, b) => (a.purchased_at || a.repaid_at || "").localeCompare(b.purchased_at || b.repaid_at || ""));

  const clientDebts = data.orders.filter(
    (o) => orderDebt(o, data.menu, data.payments) > 0 && o.status !== "cancelled"
  );

  async function delWithdrawal(id) {
    if (!confirm("Удалить вывод?")) return;
    await db.deleteWithdrawal(id);
    refresh();
  }
  async function delRepayment(id) {
    if (!confirm("Удалить запись о погашении?")) return;
    await db.deleteRepayment(id);
    refresh();
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Финансы</h2>
        <button className="btn btn-sm" onClick={() => setShowWithdraw(true)}>↓ Вывод</button>
      </div>

      <div className="cat-label" style={{ marginTop: 0 }}>💼 Счета (текущие остатки)</div>
      <div className="balances">
        <div className="balance-card cash">
          <div className="balance-icon">💵</div>
          <div className="balance-label">Наличные</div>
          <div className="balance-value green">{cur(cash)}</div>
          <div className="balance-sub">в руках</div>
        </div>
        <div className="balance-card card">
          <div className="balance-icon">💳</div>
          <div className="balance-label">Карта</div>
          <div className="balance-value blue">{cur(card)}</div>
          <div className="balance-sub">на карте</div>
        </div>
        <div className="balance-card husband">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="balance-icon">🤝</div>
              <div className="balance-label">Кредит мужа (долг)</div>
              <div className="balance-value pink">{cur(hDebt)}</div>
              <div className="balance-sub">Взято: {cur(hBorrowed)} · Возвращено: {cur(hRepaid)}</div>
            </div>
            {hDebt > 0 ? (
              <button className="btn btn-sm" style={{ background: "var(--pink)" }} onClick={() => setShowRepay(true)}>Погасить</button>
            ) : (
              <span style={{ color: "var(--green)", fontWeight: 800, fontSize: 13 }}>✓ Погашен</span>
            )}
          </div>
        </div>
      </div>

      <div className="cat-label">📊 За период</div>
      <div className="period-row">
        {[["today","Сегодня"],["week","Неделя"],["month","Месяц"],["all","Всё"],["custom","📅"]].map(([k,l]) => (
          <button key={k} className={`period-btn ${period === k ? "active" : ""}`} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>
      {period === "custom" && (
        <div className="date-range">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span>—</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      )}

      <div className="fin-grid">
        <div className="fin-card green">
          <div className="fin-label">Выручка</div>
          <div className="fin-val">{cur(revenue)}</div>
          <div className="fin-sub">Получено: {cur(paidTotal)}</div>
        </div>
        <div className="fin-card blue">
          <div className="fin-label">💵 Нал / 💳 Карта</div>
          <div className="fin-val" style={{ fontSize: 15 }}>{cur(paidCash)}<br />{cur(paidCard)}</div>
        </div>
        <div className="fin-card yellow">
          <div className="fin-label">Долги клиентов</div>
          <div className="fin-val">{cur(debtTotal)}</div>
          <div className="fin-sub">⏳ всего</div>
        </div>
        <div className="fin-card red">
          <div className="fin-label">Закупки</div>
          <div className="fin-val">{cur(purchTotal)}</div>
          <div className="fin-sub">Себест: {cur(costOrders)}</div>
        </div>
        <div className={`fin-card ${profit >= 0 ? "white" : "red"}`} style={{ gridColumn: "span 2" }}>
          <div className="fin-label">Прибыль</div>
          <div className="fin-val" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>{cur(profit)}</div>
          <div className="fin-sub">{profit >= 0 ? "✅ В плюсе" : "⚠️ В минусе"}</div>
        </div>
      </div>

      <div className="cat-label">🤝 Кредит мужа — история</div>
      {credits.length === 0 && <p className="empty-msg">Нет операций</p>}
      {credits.map((c) =>
        c._t === "borrow" ? (
          <div key={"b" + c.id} className="credit-row">
            <div>📥 Взято на: {c.ingredient}</div>
            <div className="pr-right">
              <span style={{ color: "var(--pink)" }}>+{cur(c.total_price)}</span>
              <span className="pr-date">{fmt(c.purchased_at)}</span>
            </div>
          </div>
        ) : (
          <div key={"r" + c.id} className="credit-row paid">
            <div>✓ Возвращено {SOURCE_LABEL[c.source]} {c.note && `· ${c.note}`}</div>
            <div className="pr-right">
              <span style={{ color: "var(--green)" }}>−{cur(c.amount)}</span>
              <span className="pr-date">{fmt(c.repaid_at)}</span>
              <button className="icon-btn danger" onClick={() => delRepayment(c.id)}><TrashIcon /></button>
            </div>
          </div>
        )
      )}

      <div className="cat-label" style={{ marginTop: 16 }}>📉 Долги клиентов</div>
      {clientDebts.length === 0 && <p className="empty-msg">Долгов нет 🎉</p>}
      {clientDebts.map((o) => {
        const cl = data.clients.find((c) => c.id === o.client_id);
        return (
          <div key={o.id} className="debt-row">
            <span>{cl?.name || "—"}</span>
            <span>{fmt(o.delivery_date)}</span>
            <span>{cur(orderDebt(o, data.menu, data.payments))}</span>
          </div>
        );
      })}

      <div className="cat-label" style={{ marginTop: 16 }}>💸 Выводы средств</div>
      {periodWithdraws.length === 0 && <p className="empty-msg">Выводов нет</p>}
      {periodWithdraws.map((w) => (
        <div key={w.id} className="withdraw-row">
          <div>
            <strong>{cur(w.amount)}</strong>
            <span className={`pr-source ${w.source}`} style={{ marginLeft: 6 }}>{SOURCE_LABEL[w.source]}</span>
            {w.note && ` · ${w.note}`}
          </div>
          <div className="pr-right">
            <span className="pr-date">{fmt(w.withdrawn_at)}</span>
            <button className="icon-btn danger" onClick={() => delWithdrawal(w.id)}><TrashIcon /></button>
          </div>
        </div>
      ))}

      {showWithdraw && (
        <WithdrawModal cash={cash} card={card} onClose={() => setShowWithdraw(false)} onSaved={() => { setShowWithdraw(false); refresh(); }} />
      )}
      {showRepay && (
        <RepayModal debt={hDebt} cash={cash} card={card} onClose={() => setShowRepay(false)} onSaved={() => { setShowRepay(false); refresh(); }} />
      )}
    </div>
  );
}

function WithdrawModal({ cash, card, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!Number(amount)) return alert("Введите сумму");
    const bal = source === "cash" ? cash : card;
    if (Number(amount) > bal && !confirm(`На счёте только ${cur(bal)}. Продолжить?`)) return;
    setSaving(true);
    await db.addWithdrawal({ amount: Number(amount), source, note });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Вывод средств" onClose={onClose}>
      <div className="fg"><label>Сумма (QAR)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
      <div className="fg">
        <label>Откуда взять</label>
        <div className="pay-method-grid">
          <button className={`pay-method-btn ${source === "cash" ? "active" : ""}`} onClick={() => setSource("cash")}>
            <span style={{ fontSize: 24 }}>💵</span>Наличные
            <span style={{ fontSize: 11, color: "var(--text2)" }}>{cur(cash)}</span>
          </button>
          <button className={`pay-method-btn ${source === "card" ? "active" : ""}`} onClick={() => setSource("card")}>
            <span style={{ fontSize: 24 }}>💳</span>Карта
            <span style={{ fontSize: 11, color: "var(--text2)" }}>{cur(card)}</span>
          </button>
        </div>
      </div>
      <div className="fg"><label>Примечание</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Личные нужды..." /></div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Вывести"}</button>
      </div>
    </Modal>
  );
}

function RepayModal({ debt, cash, card, onClose, onSaved }) {
  const [amount, setAmount] = useState(debt);
  const [source, setSource] = useState("cash");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!Number(amount)) return alert("Введите сумму");
    const bal = source === "cash" ? cash : card;
    if (Number(amount) > bal && !confirm(`На счёте только ${cur(bal)}. Продолжить?`)) return;
    setSaving(true);
    await db.addRepayment({ amount: Number(amount), source });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Погасить кредит мужа" onClose={onClose}>
      <div style={{ background: "var(--pink-bg)", borderRadius: 12, padding: 12, marginBottom: 14, color: "var(--pink)", fontWeight: 700 }}>
        🤝 Текущий долг мужу: <strong>{cur(debt)}</strong>
      </div>
      <div className="fg"><label>Сумма (QAR)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(debt)}>Весь долг</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(Math.round(debt / 2))}>Половина</button>
      </div>
      <div className="fg">
        <label>Откуда оплатить</label>
        <div className="pay-method-grid">
          <button className={`pay-method-btn ${source === "cash" ? "active" : ""}`} onClick={() => setSource("cash")}>
            <span style={{ fontSize: 24 }}>💵</span>Наличные
          </button>
          <button className={`pay-method-btn ${source === "card" ? "active" : ""}`} onClick={() => setSource("card")}>
            <span style={{ fontSize: 24 }}>💳</span>Карта
          </button>
        </div>
      </div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Погасить"}</button>
      </div>
    </Modal>
  );
}
