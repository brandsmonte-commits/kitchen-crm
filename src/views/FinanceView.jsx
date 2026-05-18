import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import { cur, fmt, todayStr, SOURCE_LABEL, accountBalance, orderTotal, orderDebt, husbandDebt, husbandBorrowed, husbandRepaid } from "../helpers";
import * as db from "../db";

export default function FinanceView({ data, refresh }) {
  const [period, setPeriod] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRepay, setShowRepay] = useState(false);

  const madina = accountBalance(data, "madina") + accountBalance(data, "cash"); // cash = old madina
  const moldir = accountBalance(data, "moldir");
  const card = accountBalance(data, "card");
  const hDebt = husbandDebt(data);
  const hBorrowed = husbandBorrowed(data);
  const hRepaid = husbandRepaid(data);

  function getRange() {
    const now = new Date();
    if (period === "today") return { from: todayStr(), to: todayStr() };
    if (period === "week") { const d = new Date(); d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0, 10), to: todayStr() }; }
    if (period === "month") return { from: now.toISOString().slice(0, 8) + "01", to: todayStr() };
    if (period === "custom") return { from: fromDate || "2000-01-01", to: toDate || todayStr() };
    return { from: "2000-01-01", to: "2099-12-31" };
  }

  const { from, to } = getRange();
  const ordersInPeriod = data.orders.filter(o => o.delivery_date >= from && o.delivery_date <= to && o.status !== "cancelled");
  const revenue = ordersInPeriod.reduce((s, o) => s + orderTotal(o, data.menu), 0);

  const paysInPeriod = data.payments.filter(p => p.paid_at >= from && p.paid_at <= to);
  const paidMadina = paysInPeriod.filter(p => p.method === "madina" || p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const paidMoldir = paysInPeriod.filter(p => p.method === "moldir").reduce((s, p) => s + Number(p.amount), 0);
  const paidCard = paysInPeriod.filter(p => p.method === "card").reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal = paidMadina + paidMoldir + paidCard;

  const debtTotal = data.orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + orderDebt(o, data.menu, data.payments), 0);

  const purchTotal = data.purchases
    .filter(p => p.type === "buy" && p.purchased_at >= from && p.purchased_at <= to)
    .reduce((s, p) => s + Number(p.total_price || 0), 0);

  const profit = paidTotal - purchTotal;

  const credits = [
    ...data.purchases.filter(p => p.type === "buy" && p.source === "husband").map(p => ({ ...p, _t: "borrow" })),
    ...data.repayments.map(r => ({ ...r, _t: "repay" })),
  ].sort((a, b) => (a.purchased_at || a.repaid_at || "").localeCompare(b.purchased_at || b.repaid_at || ""));

  const clientDebts = data.orders.filter(o => orderDebt(o, data.menu, data.payments) > 0 && o.status !== "cancelled");
  const periodWithdraws = data.withdrawals.filter(w => w.withdrawn_at >= from && w.withdrawn_at <= to);

  async function delWithdrawal(id) { if (!confirm("Удалить вывод?")) return; await db.deleteWithdrawal(id); refresh(); }
  async function delRepayment(id) { if (!confirm("Удалить?")) return; await db.deleteRepayment(id); refresh(); }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Финансы</h2>
        <button className="btn btn-sm" onClick={() => setShowWithdraw(true)}>↓ Вывод</button>
      </div>

      <div className="cat-label" style={{ marginTop: 0 }}>💼 Счета</div>
      <div className="balances-3">
        <div className="balance-card madina">
          <div className="balance-icon">💵</div>
          <div className="balance-label">Мадина</div>
          <div className="balance-value green">{cur(madina)}</div>
        </div>
        <div className="balance-card moldir">
          <div className="balance-icon">💵</div>
          <div className="balance-label">Молдир</div>
          <div className="balance-value green">{cur(moldir)}</div>
        </div>
        <div className="balance-card card-acc">
          <div className="balance-icon">💳</div>
          <div className="balance-label">Карта</div>
          <div className="balance-value blue">{cur(card)}</div>
        </div>
      </div>

      <div className="balance-card husband" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="balance-icon">🤝</div>
            <div className="balance-label">Кредит мужа (долг)</div>
            <div className="balance-value pink">{cur(hDebt)}</div>
            <div className="balance-sub">Взято: {cur(hBorrowed)} · Возвращено: {cur(hRepaid)}</div>
          </div>
          {hDebt > 0
            ? <button className="btn btn-sm" style={{ background: "var(--pink)" }} onClick={() => setShowRepay(true)}>Погасить</button>
            : <span style={{ color: "var(--green)", fontWeight: 800, fontSize: 13 }}>✓ Погашен</span>}
        </div>
      </div>

      <div className="cat-label">📊 За период</div>
      <div className="period-row">
        {[["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"], ["all", "Всё"], ["custom", "📅"]].map(([k, l]) => (
          <button key={k} className={`period-btn ${period === k ? "active" : ""}`} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>
      {period === "custom" && (
        <div className="date-range">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span>—</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      )}

      <div className="fin-grid">
        <div className="fin-card green">
          <div className="fin-label">Выручка (начислено)</div>
          <div className="fin-val">{cur(revenue)}</div>
          <div className="fin-sub">Получено: {cur(paidTotal)}</div>
        </div>
        <div className="fin-card blue">
          <div className="fin-label">По счетам</div>
          <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.8 }}>
            💵 Мадина: <strong>{cur(paidMadina)}</strong><br />
            💵 Молдир: <strong>{cur(paidMoldir)}</strong><br />
            💳 Карта: <strong>{cur(paidCard)}</strong>
          </div>
        </div>
        <div className="fin-card yellow">
          <div className="fin-label">Долги клиентов</div>
          <div className="fin-val">{cur(debtTotal)}</div>
          <div className="fin-sub">⏳ всего</div>
        </div>
        <div className="fin-card red">
          <div className="fin-label">Закупки</div>
          <div className="fin-val">{cur(purchTotal)}</div>
        </div>
        <div className={`fin-card ${profit >= 0 ? "white" : "red"}`} style={{ gridColumn: "span 2" }}>
          <div className="fin-label">Прибыль (получено − закупки)</div>
          <div className="fin-val" style={{ color: profit >= 0 ? "var(--green)" : "var(--red)" }}>{cur(profit)}</div>
          <div className="fin-sub">{profit >= 0 ? "✅ В плюсе" : "⚠️ В минусе"}</div>
        </div>
      </div>

      <div className="cat-label">🤝 Кредит мужа — история</div>
      {credits.length === 0 && <p className="empty-msg">Нет операций</p>}
      {credits.map(c => c._t === "borrow" ? (
        <div key={"b" + c.id} className="credit-row">
          <div>📥 {c.ingredient}</div>
          <div className="pr-right">
            <span style={{ color: "var(--pink)" }}>+{cur(c.total_price)}</span>
            <span className="pr-date">{fmt(c.purchased_at)}</span>
          </div>
        </div>
      ) : (
        <div key={"r" + c.id} className="credit-row paid">
          <div>✓ Возвращено {SOURCE_LABEL[c.source]}</div>
          <div className="pr-right">
            <span style={{ color: "var(--green)" }}>−{cur(c.amount)}</span>
            <span className="pr-date">{fmt(c.repaid_at)}</span>
            <button className="icon-btn danger" onClick={() => delRepayment(c.id)}><TrashIcon /></button>
          </div>
        </div>
      ))}

      <div className="cat-label" style={{ marginTop: 16 }}>📉 Долги клиентов</div>
      {clientDebts.length === 0 && <p className="empty-msg">Долгов нет 🎉</p>}
      {clientDebts.map(o => {
        const cl = data.clients.find(c => c.id === o.client_id);
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
      {periodWithdraws.map(w => (
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

      {showWithdraw && <WithdrawModal madina={madina} moldir={moldir} card={card} onClose={() => setShowWithdraw(false)} onSaved={() => { setShowWithdraw(false); refresh(); }} />}
      {showRepay && <RepayModal debt={hDebt} madina={madina} moldir={moldir} card={card} onClose={() => setShowRepay(false)} onSaved={() => { setShowRepay(false); refresh(); }} />}
    </div>
  );
}

function WithdrawModal({ madina, moldir, card, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("madina");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const balances = { madina, moldir, card };

  async function save() {
    if (!Number(amount)) return alert("Введите сумму");
    const bal = balances[source] || 0;
    if (Number(amount) > bal && !confirm(`На счёте только ${cur(bal)}. Продолжить?`)) return;
    setSaving(true);
    await db.addWithdrawal({ amount: Number(amount), source, note });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Вывод средств" onClose={onClose}>
      <div className="fg"><label>Сумма (QAR)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
      <div className="fg">
        <label>Откуда взять</label>
        <div className="pay-method-grid three">
          {[["madina", "💵", "Мадина"], ["moldir", "💵", "Молдир"], ["card", "💳", "Карта"]].map(([s, ico, lbl]) => (
            <button key={s} className={`pay-method-btn ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>
              <span style={{ fontSize: 22 }}>{ico}</span>
              <span>{lbl}</span>
              <span style={{ fontSize: 10, color: "var(--text2)" }}>{cur(balances[s])}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="fg"><label>Примечание</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="Личные нужды..." /></div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Вывести"}</button>
      </div>
    </Modal>
  );
}

function RepayModal({ debt, madina, moldir, card, onClose, onSaved }) {
  const [amount, setAmount] = useState(debt);
  const [source, setSource] = useState("madina");
  const [saving, setSaving] = useState(false);
  const balances = { madina, moldir, card };

  async function save() {
    if (!Number(amount)) return alert("Введите сумму");
    const bal = balances[source] || 0;
    if (Number(amount) > bal && !confirm(`На счёте только ${cur(bal)}. Продолжить?`)) return;
    setSaving(true);
    await db.addRepayment({ amount: Number(amount), source });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Погасить кредит мужа" onClose={onClose}>
      <div style={{ background: "var(--pink-bg)", borderRadius: 12, padding: 12, marginBottom: 14, color: "var(--pink)", fontWeight: 700 }}>
        🤝 Долг мужу: <strong>{cur(debt)}</strong>
      </div>
      <div className="fg"><label>Сумма (QAR)</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(debt)}>Весь долг</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(Math.round(debt / 2))}>Половина</button>
      </div>
      <div className="fg">
        <label>Откуда оплатить</label>
        <div className="pay-method-grid three">
          {[["madina", "💵", "Мадина"], ["moldir", "💵", "Молдир"], ["card", "💳", "Карта"]].map(([s, ico, lbl]) => (
            <button key={s} className={`pay-method-btn ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>
              <span style={{ fontSize: 22 }}>{ico}</span>{lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Погасить"}</button>
      </div>
    </Modal>
  );
}
