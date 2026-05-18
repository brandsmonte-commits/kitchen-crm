import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import { cur, fmt, todayStr, SOURCE_LABEL } from "../helpers";
import * as db from "../db";

export default function WarehouseView({ data, refresh }) {
  const [showModal, setShowModal] = useState(false);

  const totalBuy = data.purchases.filter((p) => p.type === "buy").reduce((s, p) => s + Number(p.total_price || 0), 0);

  const stock = {};
  data.purchases.forEach((p) => {
    if (!stock[p.ingredient]) stock[p.ingredient] = { bought: 0, used: 0, unit: p.unit };
    if (p.type === "buy") stock[p.ingredient].bought += Number(p.qty);
    else stock[p.ingredient].used += Number(p.qty);
  });

  async function handleDelete(id) {
    if (!confirm("Удалить запись?")) return;
    await db.deletePurchase(id);
    refresh();
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Склад</h2>
        <button className="btn btn-sm" onClick={() => setShowModal(true)}>＋ Запись</button>
      </div>

      <div className="sum-card">
        <span className="sum-label">Потрачено на закупки</span>
        <span className="sum-value">{cur(totalBuy)}</span>
      </div>

      <div className="cat-label">Остатки</div>
      {Object.keys(stock).length === 0 && <p className="empty-msg">Добавьте первую закупку</p>}
      {Object.entries(stock).map(([ing, { bought, used, unit }]) => {
        const left = bought - used;
        const pct = bought > 0 ? Math.max(0, Math.min(100, (left / bought) * 100)) : 0;
        const cls = pct > 50 ? "ok" : pct > 20 ? "low" : "out";
        return (
          <div key={ing} className="stock-row">
            <div className="stock-name">{ing}</div>
            <div className="bar-wrap"><div className={`bar ${cls}`} style={{ width: `${pct}%` }} /></div>
            <div className="stock-qty">{left.toFixed(1)}/{bought.toFixed(1)} {unit}</div>
          </div>
        );
      })}

      <div className="cat-label" style={{ marginTop: 20 }}>История</div>
      {data.purchases.map((p) => (
        <div key={p.id} className={`purchase-row ${p.type}`}>
          <div>
            <strong>{p.type === "buy" ? "📦" : "🍳"} {p.ingredient}</strong>
            {" · "}{p.qty} {p.unit}
            {p.total_price > 0 && ` · ${cur(p.total_price)}`}
            {p.source && <span className={`pr-source ${p.source}`}>{SOURCE_LABEL[p.source]}</span>}
          </div>
          <div className="pr-right">
            <span className="pr-date">{fmt(p.purchased_at)}</span>
            <button className="icon-btn danger" onClick={() => handleDelete(p.id)}><TrashIcon /></button>
          </div>
        </div>
      ))}

      {showModal && <PurchaseModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); refresh(); }} />}
    </div>
  );
}

function PurchaseModal({ onClose, onSaved }) {
  const [type, setType] = useState("buy");
  const [ingredient, setIngredient] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("кг");
  const [price, setPrice] = useState("");
  const [source, setSource] = useState("cash");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ingredient.trim() || !qty) return alert("Заполните ингредиент и количество");
    setSaving(true);
    await db.addPurchase({
      type,
      ingredient,
      qty: Number(qty),
      unit,
      total_price: type === "buy" ? Number(price) || 0 : 0,
      source: type === "buy" ? source : null,
      purchased_at: date,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Запись склада" onClose={onClose}>
      <div className="fg">
        <label>Тип</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn${type === "buy" ? "" : " btn-ghost"}`} style={{ flex: 1, justifyContent: "center" }} onClick={() => setType("buy")}>📦 Закупка</button>
          <button className={`btn${type === "use" ? "" : " btn-ghost"}`} style={{ flex: 1, justifyContent: "center" }} onClick={() => setType("use")}>🍳 Списание</button>
        </div>
      </div>
      <div className="fg"><label>Ингредиент</label><input value={ingredient} onChange={(e) => setIngredient(e.target.value)} placeholder="Мука, мясо..." /></div>
      <div className="form-row">
        <div className="fg"><label>Количество</label><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="5" /></div>
        <div className="fg">
          <label>Ед. изм.</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>кг</option><option>г</option><option>л</option><option>шт</option><option>упак</option>
          </select>
        </div>
      </div>
      {type === "buy" && (
        <>
          <div className="fg"><label>Сумма закупки (QAR)</label><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></div>
          <div className="fg">
            <label>Откуда оплачено</label>
            <div className="pay-method-grid three">
              {["cash", "card", "husband"].map((s) => (
                <button
                  key={s}
                  className={`pay-method-btn ${s === "husband" ? "husband" : ""} ${source === s ? "active" : ""}`}
                  onClick={() => setSource(s)}
                >
                  <span style={{ fontSize: 24 }}>{s === "cash" ? "💵" : s === "card" ? "💳" : "🤝"}</span>
                  {s === "cash" ? "Наличные" : s === "card" ? "Карта" : "Кредит мужа"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="fg"><label>Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}
