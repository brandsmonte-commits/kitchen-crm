import { useState } from "react";
import Modal, { TrashIcon, EditIcon, TransferIcon, CloseIcon } from "../components/Modal";
import {
  cur, fmt, fmtFull, todayStr, STATUS, SOURCE_LABEL,
  orderSubtotal, orderDiscount, orderTotal, orderPaymentsTotal, orderDebt, paymentState,
} from "../helpers";
import * as db from "../db";
import { supabase } from "../db";

export default function CalendarView({ data, refresh }) {
  const [calDate, setCalDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [orderModal, setOrderModal] = useState(null); // null | {} | order
  const [transferOrder, setTransferOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [editPayment, setEditPayment] = useState(null); // payment object to edit

  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = (firstDay + 6) % 7;

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const monthName = new Date(y, m, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const dayOrders = data.orders
    .filter((o) => o.delivery_date === selectedDate)
    .sort((a, b) => (a.delivery_time || "99").localeCompare(b.delivery_time || "99"));

  async function handleStatusChange(orderId, status) {
    await db.updateOrderStatus(orderId, status);
    refresh();
  }

  async function handleDelete(orderId) {
    if (!confirm("Удалить заказ? Все связанные оплаты тоже удалятся.")) return;
    await db.deleteOrder(orderId);
    refresh();
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Заказы</h2>
        <button className="btn btn-sm" onClick={() => setOrderModal({})}>＋ Заказ</button>
      </div>

      <div className="cal-nav">
        <button className="icon-btn" onClick={() => setCalDate(new Date(y, m - 1))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="cal-month">{monthName}</span>
        <button className="icon-btn" onClick={() => setCalDate(new Date(y, m + 1))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="cal-grid">
        {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const orders = data.orders.filter((o) => o.delivery_date === date && o.status !== "cancelled");
          const isToday = date === todayStr();
          const isSel = date === selectedDate;
          const isPast = date < todayStr();
          return (
            <div
              key={date}
              className={`cal-cell ${isToday ? "today" : ""} ${isSel ? "selected" : ""} ${isPast ? "past" : ""}`}
              onClick={() => setSelectedDate(date)}
            >
              <span className="cal-day">{new Date(date + "T12:00").getDate()}</span>
              {orders.length > 0 && (
                <div className="cal-dots">
                  {orders.slice(0, 3).map((o) => <span key={o.id} className={`cal-dot ${o.status}`} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="day-orders">
        <div className="day-title">{fmtFull(selectedDate)}</div>
        {dayOrders.length > 0 && (() => {
          // Aggregate items across all orders of the day
          const agg = {};
          dayOrders.forEach(o => {
            if (o.status === "cancelled") return;
            (o.items || []).forEach(i => {
              const m = data.menu.find(mi => mi.id === i.menu_item_id);
              if (!m) return;
              const key = m.id;
              if (!agg[key]) agg[key] = { name: m.name, unit: m.unit, qty: 0 };
              agg[key].qty += Number(i.qty);
            });
          });
          const entries = Object.values(agg);
          if (!entries.length) return null;
          return (
            <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "12px 14px", marginBottom: 12, border: "1.5px solid var(--border)", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📋 Объём на день</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {entries.map(e => (
                  <span key={e.name} style={{ background: "var(--accent-light)", color: "var(--accent)", borderRadius: 20, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>
                    {e.name} × {e.qty % 1 === 0 ? e.qty : e.qty.toFixed(1)}{e.unit && e.unit !== "шт" ? ` ${e.unit}` : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {dayOrders.length === 0 ? (
          <p className="empty-msg">Нет заказов на этот день</p>
        ) : (
          dayOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              data={data}
              onTransfer={() => setTransferOrder(o)}
              onEdit={() => setOrderModal(o)}
              onDelete={() => handleDelete(o.id)}
              onStatusChange={(s) => handleStatusChange(o.id, s)}
              onAddPayment={() => setPaymentOrder(o)}
              onEditPayment={(p) => setEditPayment(p)}
            />
          ))
        )}
        <button className="btn btn-ghost btn-full" onClick={() => setOrderModal({})}>＋ Добавить заказ</button>
      </div>

      {orderModal !== null && (
        <OrderModal
          order={orderModal.id ? orderModal : null}
          defaultDate={selectedDate}
          data={data}
          onClose={() => setOrderModal(null)}
          onSaved={() => { setOrderModal(null); refresh(); }}
        />
      )}
      {transferOrder && (
        <TransferModal
          order={transferOrder}
          onClose={() => setTransferOrder(null)}
          onSaved={(newDate) => { setTransferOrder(null); setSelectedDate(newDate); refresh(); }}
        />
      )}
      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          data={data}
          onClose={() => setPaymentOrder(null)}
          onSaved={() => { setPaymentOrder(null); refresh(); }}
        />
      )}
      {editPayment && (
        <EditPaymentModal
          payment={editPayment}
          onClose={() => setEditPayment(null)}
          onSaved={() => { setEditPayment(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── ORDER CARD ─────────────────────────────────────────────────────────────
function OrderCard({ order, data, onTransfer, onEdit, onDelete, onStatusChange, onAddPayment, onEditPayment }) {
  const cl = data.clients.find((c) => c.id === order.client_id);
  const sub = orderSubtotal(order, data.menu);
  const total = orderTotal(order, data.menu);
  const disc = orderDiscount(order, data.menu);
  const paid = orderPaymentsTotal(order, data.payments);
  const debt = orderDebt(order, data.menu, data.payments);
  const st = STATUS[order.status] || STATUS.new;
  const ps = paymentState(order, data.menu, data.payments);

  const orderPays = data.payments.filter((p) => p.order_id === order.id);
  const madinaSum = orderPays.filter((p) => p.method === "madina" || p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const moldirSum = orderPays.filter((p) => p.method === "moldir").reduce((s, p) => s + Number(p.amount), 0);
  const cardSum = orderPays.filter((p) => p.method === "card").reduce((s, p) => s + Number(p.amount), 0);
  const cashSum = madinaSum; // обратная совместимость

  return (
    <div className={`order-card ${ps}`}>
      <div className="order-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="order-client">
            {cl?.name || "—"}
            {disc > 0 && (
              <span className="order-discount">
                −{order.disc_type === "percent" ? `${order.disc_value}%` : cur(order.disc_value)}
              </span>
            )}
          </div>
          <div className="order-time-row">
            {order.delivery_time && <span className="order-time">🕒 {order.delivery_time}</span>}
            {cl?.phone && <a className="order-phone" href={`tel:${cl.phone}`}>📞 {cl.phone}</a>}
          </div>
        </div>
        <div className="row-actions">
          <button className="icon-btn" onClick={onTransfer} title="Перенести"><TransferIcon /></button>
          <button className="icon-btn" onClick={onEdit} title="Редактировать"><EditIcon /></button>
          <button className="icon-btn danger" onClick={onDelete} title="Удалить"><TrashIcon size={16} /></button>
        </div>
      </div>

      <div className="order-chips">
        {order.items?.map((i) => {
          const m = data.menu.find((mi) => mi.id === i.menu_item_id);
          if (!m) return null;
          const qtyDisplay = Number(i.qty) % 1 === 0 ? Number(i.qty) : Number(i.qty).toFixed(1);
          const unitDisplay = m.unit && m.unit !== "шт" ? ` ${m.unit}` : "";
          return <span key={i.id} className="chip">{m.name} ×{qtyDisplay}{unitDisplay}</span>;
        })}
      </div>

      <div className="price-line">
        <span>
          {disc > 0 && <span className="price-old">{cur(sub)}</span>}
          <span style={{ fontSize: 17, fontWeight: 900, color: "var(--accent)" }}>{cur(total)}</span>
        </span>
        <select
          className={`status-pill ${st.cls}`}
          value={order.status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {order.status !== "cancelled" && total > 0 && (
        <>
          <div className="payment-info">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <span className="payment-paid">Оплачено: {cur(paid)}</span>
                {debt > 0 ? <span style={{ marginLeft: 8 }} className="payment-debt">· Долг: {cur(debt)}</span> : " ✓"}
              </div>
              {orderPays.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {orderPays.map(p => {
                    const ico = p.method === "card" ? "💳" : "💵";
                    const lbl = p.method === "madina" || p.method === "cash" ? "Мадина" : p.method === "moldir" ? "Молдир" : "Карта";
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                        <span>{ico} {lbl}: {cur(p.amount)}</span>
                        <button className="icon-btn" style={{ padding: 2 }} onClick={() => onEditPayment(p)} title="Редактировать">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {debt > 0 && <button className="btn btn-sm" onClick={onAddPayment}>💰</button>}
          </div>
          {paid > 0 && debt > 0 && (
            <div className="pay-bar-wrap">
              <div className="pay-bar" style={{ width: `${Math.min(100, Math.round((paid / total) * 100))}%` }} />
            </div>
          )}
        </>
      )}

      {order.note && <div className="order-note">📝 {order.note}</div>}
    </div>
  );
}

// ─── ORDER MODAL ────────────────────────────────────────────────────────────
function OrderModal({ order, defaultDate, data, onClose, onSaved }) {
  const [clientId, setClientId] = useState(order?.client_id || "");
  const [date, setDate] = useState(order?.delivery_date || defaultDate || todayStr());
  const [time, setTime] = useState(order?.delivery_time || "");
  const [status, setStatus] = useState(order?.status || "new");
  const [note, setNote] = useState(order?.note || "");
  const [discType, setDiscType] = useState(order?.disc_type || "none");
  const [discValue, setDiscValue] = useState(order?.disc_value || "");
  const [items, setItems] = useState(
    order?.items?.map((i) => ({ menu_item_id: i.menu_item_id, qty: i.qty })) || [
      { menu_item_id: data.menu[0]?.id, qty: 1 },
    ]
  );
  const [saving, setSaving] = useState(false);

  const sub = items.reduce((s, i) => {
    const m = data.menu.find((mi) => mi.id === i.menu_item_id);
    return s + (m?.price || 0) * i.qty;
  }, 0);
  const disc =
    discType === "percent" ? Math.round((sub * Number(discValue || 0)) / 100) :
    discType === "amount" ? Math.min(sub, Number(discValue || 0)) : 0;
  const total = sub - disc;

  async function save() {
    if (!clientId) return alert("Выберите клиента");
    if (items.length === 0) return alert("Добавьте товары");
    setSaving(true);
    try {
      await db.upsertOrder({
        id: order?.id,
        client_id: clientId,
        delivery_date: date,
        delivery_time: time,
        status,
        note,
        disc_type: discType,
        disc_value: Number(discValue) || 0,
        items,
      });
      onSaved();
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
    setSaving(false);
  }

  return (
    <Modal title={order ? "Редактировать заказ" : "Новый заказ"} onClose={onClose}>
      <div className="fg">
        <label>Клиент</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— выберите —</option>
          {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-row-3">
        <div className="fg"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="fg"><label>Время</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div className="fg">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div className="fg">
        <label>Товары</label>
        {items.map((it, idx) => (
          <div key={idx} className="item-row">
            <select
              value={it.menu_item_id}
              onChange={(e) => setItems(items.map((i, ii) => ii === idx ? { ...i, menu_item_id: e.target.value } : i))}
            >
              {data.menu.map((m) => <option key={m.id} value={m.id}>{m.name} — {cur(m.price)}</option>)}
            </select>
           <input
  type="text"
  inputMode="decimal"
  className="qty"
  placeholder="1"
  value={it.qty}
  onChange={(e) => {
    const raw = e.target.value.replace(",", ".");
    setItems(items.map((i, ii) => ii === idx ? { ...i, qty: raw } : i));
  }}
  onBlur={(e) => {
    const val = parseFloat(String(e.target.value).replace(",", ".")) || 0.5;
    setItems(items.map((i, ii) => ii === idx ? { ...i, qty: val } : i));
  }}
/>
            <button className="icon-btn danger" onClick={() => setItems(items.filter((_, ii) => ii !== idx))}>
              <CloseIcon />
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 4 }}
         onClick={() => setItems([...items, { menu_item_id: data.menu[0]?.id, qty: 0.5 }])}
        >＋ Добавить</button>
      </div>

      <div className="fg">
        <label>Скидка</label>
        <div className="disc-row">
          <select value={discType} onChange={(e) => setDiscType(e.target.value)}>
            <option value="none">Нет</option>
            <option value="percent">%</option>
            <option value="amount">QAR</option>
          </select>
          <input type="number" value={discValue} onChange={(e) => setDiscValue(e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="fg"><label>Примечание</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Адрес, пожелания..." /></div>

      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div className="price-line"><span>Подытог</span><span>{cur(sub)}</span></div>
        {disc > 0 && <div className="price-line"><span>Скидка</span><span style={{ color: "var(--purple)" }}>−{cur(disc)}</span></div>}
        <div className="price-line total"><span>Итого</span><span>{cur(total)}</span></div>
      </div>

      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}

// ─── TRANSFER MODAL ─────────────────────────────────────────────────────────
function TransferModal({ order, onClose, onSaved }) {
  const [date, setDate] = useState(order.delivery_date);
  const [time, setTime] = useState(order.delivery_time || "");
  const [saving, setSaving] = useState(false);

  function shift(days) {
    const d = new Date(date + "T12:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  async function save() {
    setSaving(true);
    await db.transferOrder(order.id, date, time);
    setSaving(false);
    onSaved(date);
  }

  return (
    <Modal title="Перенести заказ" onClose={onClose}>
      <div className="fg">
        <label>Текущая дата</label>
        <div style={{ padding: "8px 0", fontWeight: 700 }}>
          {fmtFull(order.delivery_date)}{order.delivery_time && ` в ${order.delivery_time}`}
        </div>
      </div>
      <div className="form-row">
        <div className="fg"><label>Новая дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="fg"><label>Новое время</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => shift(1)}>+1 день</button>
        <button className="btn btn-ghost btn-sm" onClick={() => shift(2)}>+2 дня</button>
        <button className="btn btn-ghost btn-sm" onClick={() => shift(7)}>+1 неделя</button>
        <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)}>Вчера</button>
      </div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "📅 Перенести"}</button>
      </div>
    </Modal>
  );
}

// ─── PAYMENT MODAL ──────────────────────────────────────────────────────────
function PaymentModal({ order, data, onClose, onSaved }) {
  const total = orderTotal(order, data.menu);
  const paid = orderPaymentsTotal(order, data.payments);
  const debt = orderDebt(order, data.menu, data.payments);
  const cl = data.clients.find((c) => c.id === order.client_id);

  const [amount, setAmount] = useState(debt);
  const [method, setMethod] = useState("madina");
  const [saving, setSaving] = useState(false);

  const payHistory = data.payments.filter((p) => p.order_id === order.id);

  async function save() {
    if (Number(amount) <= 0) return alert("Введите сумму");
    setSaving(true);
    await db.addPayment({ order_id: order.id, amount: Number(amount), method });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Получить оплату" onClose={onClose}>
      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{cl?.name || "—"}</div>
        <div className="price-line"><span>Сумма заказа</span><span>{cur(total)}</span></div>
        <div className="price-line"><span>Уже оплачено</span><span style={{ color: "var(--green)", fontWeight: 800 }}>{cur(paid)}</span></div>
        <div className="price-line total"><span>К оплате</span><span style={{ color: "var(--red)" }}>{cur(debt)}</span></div>
        {payHistory.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text2)" }}>
            {payHistory.map((p) => (
              <div key={p.id}>• {cur(p.amount)} {SOURCE_LABEL[p.method]} · {fmt(p.paid_at)}</div>
            ))}
          </div>
        )}
      </div>

      <div className="fg">
        <label>Сумма доплаты (QAR)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(debt)}>Вся сумма</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAmount(Math.round(debt / 2))}>Половина</button>
      </div>

      <div className="fg">
        <label>Куда зачислить</label>
        <div className="pay-method-grid three">
          {[["madina","💵","Мадина"],["moldir","💵","Молдир"],["card","💳","Карта"]].map(([s,ico,lbl]) => (
            <button key={s} className={`pay-method-btn ${method === s ? "active" : ""}`} onClick={() => setMethod(s)}>
              <span style={{fontSize:20}}>{ico}</span>{lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Принять"}</button>
      </div>
    </Modal>
  );
}

// ─── EDIT PAYMENT MODAL ─────────────────────────────────────────────────────
function EditPaymentModal({ payment, onClose, onSaved }) {
  const [amount, setAmount] = useState(payment.amount);
  const [method, setMethod] = useState(payment.method === "cash" ? "madina" : payment.method);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!Number(amount)) return alert("Введите сумму");
    setSaving(true);
    await supabase.from("payments").update({
      amount: Number(amount),
      method,
    }).eq("id", payment.id);
    setSaving(false);
    onSaved();
  }

  async function del() {
    if (!confirm("Удалить этот платёж?")) return;
    setSaving(true);
    await supabase.from("payments").delete().eq("id", payment.id);
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Редактировать оплату" onClose={onClose}>
      <div className="fg">
        <label>Сумма (QAR)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="fg">
        <label>Метод оплаты</label>
        <div className="pay-method-grid three">
          {[["madina","💵","Мадина"],["moldir","💵","Молдир"],["card","💳","Карта"]].map(([s,ico,lbl]) => (
            <button key={s} className={`pay-method-btn ${method === s ? "active" : ""}`} onClick={() => setMethod(s)}>
              <span style={{fontSize:20}}>{ico}</span>{lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-acts">
        <button className="btn" style={{background:"var(--red)",flex:"0 0 auto",padding:"10px 14px"}} onClick={del} disabled={saving}>🗑</button>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}
