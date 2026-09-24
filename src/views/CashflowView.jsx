import { useState } from "react";
import { cur, fmt, fmtFull, fmtTime, periodRange, SOURCE_LABEL, ACCOUNTS, accountLedger } from "../helpers";

const KIND_ICON = { payment: "📥", purchase: "🛒", withdrawal: "💸", repayment: "🤝" };

// Хронология движения денег по счетам: кто и когда заплатил, что сняли/потратили,
// и сколько оставалось на счёте после каждой операции — чтобы легко разбирать остатки.
export default function CashflowView({ data }) {
  const [account, setAccount] = useState("all"); // all | madina | moldir | card
  const [kind, setKind] = useState("all");       // all | in | out
  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { from, to } = periodRange(period, fromDate, toDate);
  const ledger = accountLedger(data).filter((r) => account === "all" || r.account === account);
  const balAfter = (r) => (account === "all" ? r.totalAfter : r.balanceAfter);

  // Остаток на начало периода — после последней операции до него
  const before = ledger.filter((r) => r.date < from);
  const startBal = before.length ? balAfter(before[before.length - 1]) : 0;
  const inPeriod = ledger.filter((r) => r.date >= from && r.date <= to);
  const endBal = inPeriod.length ? balAfter(inPeriod[inPeriod.length - 1]) : startBal;
  const incomeSum = inPeriod.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const outSum = inPeriod.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);

  const shown = inPeriod
    .filter((r) => kind === "all" || (kind === "in" ? r.amount > 0 : r.amount < 0))
    .reverse(); // новые сверху

  // Группировка по дням; остаток на конец дня — после последней операции дня (в т.ч. скрытых фильтром)
  const days = [];
  shown.forEach((r) => {
    let day = days[days.length - 1];
    if (!day || day.date !== r.date) {
      const dayRows = inPeriod.filter((x) => x.date === r.date);
      day = { date: r.date, rows: [], endBal: balAfter(dayRows[dayRows.length - 1]) };
      days.push(day);
    }
    day.rows.push(r);
  });

  return (
    <div className="view">
      <div className="view-header">
        <h2>Приходы и расходы</h2>
      </div>

      <div className="period-row">
        {[["all", "Все счета"], ...ACCOUNTS.map((a) => [a, SOURCE_LABEL[a]])].map(([k, l]) => (
          <button key={k} className={`period-btn ${account === k ? "active" : ""}`} onClick={() => setAccount(k)}>{l}</button>
        ))}
      </div>
      <div className="period-row">
        {[["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"], ["all", "Всё"], ["custom", "📅"]].map(([k, l]) => (
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

      <div className="ledger-summary">
        <div><span>Остаток на начало</span><strong>{cur(startBal)}</strong></div>
        <div><span>Пришло</span><strong className="in">+{cur(incomeSum)}</strong></div>
        <div><span>Ушло</span><strong className="out">−{cur(outSum)}</strong></div>
        <div><span>Остаток на конец</span><strong>{cur(endBal)}</strong></div>
      </div>

      <div className="period-row">
        {[["all", "Всё"], ["in", "📥 Приходы"], ["out", "📤 Расходы"]].map(([k, l]) => (
          <button key={k} className={`period-btn ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>

      {days.length === 0 && <p className="empty-msg">Операций за период нет</p>}
      {days.map((day) => (
        <div key={day.date}>
          <div className="ledger-day">
            <span>{fmtFull(day.date)}</span>
            <span>остаток: {cur(day.endBal)}</span>
          </div>
          {day.rows.map((r) => (
            <div key={r.id} className={`ledger-row ${r.amount >= 0 ? "in" : "out"}`}>
              <div className="ledger-main">
                <div className="ledger-title">{KIND_ICON[r.kind]} {r.title}</div>
                <div className="ledger-meta">
                  {account === "all" && <span className={`pr-source ${r.account}`} style={{ marginLeft: 0, marginRight: 6 }}>{SOURCE_LABEL[r.account]}</span>}
                  {fmtTime(r.createdAt)}
                  {r.kind === "payment" && r.orderDate && r.orderDate !== r.date && ` · за заказ от ${fmt(r.orderDate)}`}
                  {r.note && ` · ${r.note}`}
                </div>
              </div>
              <div className="ledger-right">
                <div className={`ledger-amt ${r.amount >= 0 ? "in" : "out"}`}>
                  {r.amount >= 0 ? "+" : "−"}{cur(Math.abs(r.amount))}
                </div>
                <div className="ledger-bal">→ {cur(balAfter(r))}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
