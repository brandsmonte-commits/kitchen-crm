import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import { cur, fmt, todayStr } from "../helpers";
import { supabase } from "../db";

const SOURCE_OPTIONS = [
  ["madina", "💵", "Мадина"],
  ["moldir", "💵", "Молдир"],
  ["card", "💳", "Карта"],
  ["husband", "🤝", "Кредит"],
];

export default function WarehouseView({ data, refresh }) {
  const [showModal, setShowModal] = useState(false);
  const [showIngModal, setShowIngModal] = useState(false);

  const ingredients = data.ingredients || [];

  // Aggregate stock per ingredient
  const stock = {};
  ingredients.forEach(ing => {
    stock[ing.id] = { name: ing.name, unit: ing.unit, bought: 0, used: 0 };
  });
  data.purchases.forEach(p => {
    if (!stock[p.ingredient]) return; // old text-based entries
    if (p.type === "buy") stock[p.ingredient].bought += Number(p.qty);
    else stock[p.ingredient].used += Number(p.qty);
  });

  const totalBuy = data.purchases
    .filter(p => p.type === "buy")
    .reduce((s, p) => s + Number(p.total_price || 0), 0);

  async function deleteIngredient(id) {
    if (!confirm("Удалить ингредиент? Все записи склада по нему останутся.")) return;
    await supabase.from("ingredients").delete().eq("id", id);
    refresh();
  }

  async function deletePurchase(id) {
    if (!confirm("Удалить запись?")) return;
    await supabase.from("purchases").delete().eq("id", id);
    refresh();
  }

  // Only show ingredients that have stock activity or exist in ingredients table
  const activeStock = Object.entries(stock).filter(([id, s]) => s.bought > 0 || s.used > 0);
  const emptyIngredients = Object.entries(stock).filter(([id, s]) => s.bought === 0 && s.used === 0);

  return (
    <div className="view">
      <div className="view-header">
        <h2>Склад</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowIngModal(true)}>+ Ингред.</button>
          <button className="btn btn-sm" onClick={() => setShowModal(true)}>+ Запись</button>
        </div>
      </div>

      <div className="sum-card">
        <span className="sum-label">Потрачено на закупки</span>
        <span className="sum-value">{cur(totalBuy)}</span>
      </div>

      {/* Stock levels */}
      {activeStock.length > 0 && (
        <>
          <div className="cat-label">Остатки</div>
          {activeStock.map(([id, s]) => {
            const left = s.bought - s.used;
            const pct = s.bought > 0 ? Math.max(0, Math.min(100, (left / s.bought) * 100)) : 0;
            const cls = pct > 50 ? "ok" : pct > 20 ? "low" : "out";
            const leftDisplay = left % 1 === 0 ? left : left.toFixed(1);
            const boughtDisplay = s.bought % 1 === 0 ? s.bought : s.bought.toFixed(1);
            return (
              <div key={id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div className="bar-wrap"><div className={`bar ${cls}`} style={{ width: `${pct}%` }} /></div>
                <div style={{ fontSize: 11, color: left < 0 ? "var(--red)" : "var(--text2)", textAlign: "right", fontWeight: 600 }}>
                  {leftDisplay}/{boughtDisplay} {s.unit}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Empty ingredients list */}
      {emptyIngredients.length > 0 && (
        <>
          <div className="cat-label">Ингредиенты (без движения)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {emptyIngredients.map(([id, s]) => (
              <span key={id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {s.name} ({s.unit})
                <button className="icon-btn danger" style={{ padding: 0 }} onClick={() => deleteIngredient(id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {/* History */}
      <div className="cat-label" style={{ marginTop: 16 }}>История закупок</div>
      {data.purchases.length === 0 && <p className="empty-msg">Нет записей</p>}
      {data.purchases.map(p => {
        const ing = ingredients.find(i => i.id === p.ingredient);
        const ingName = ing ? ing.name : p.ingredient;
        const srcLabel = { madina: "💵М", moldir: "💵Мол", card: "💳", husband: "🤝", cash: "💵" }[p.source] || "";
        return (
          <div key={p.id} className={`purchase-row ${p.type}`}>
            <div style={{ minWidth: 0 }}>
              <strong>{p.type === "buy" ? "📦" : "🍳"} {ingName}</strong>
              <span style={{ color: "var(--text2)" }}> · {p.qty} {ing?.unit || p.unit}</span>
              {p.total_price > 0 && <span style={{ color: "var(--accent)" }}> · {cur(p.total_price)}</span>}
              {p.source && <span className={`pr-source ${p.source}`} style={{ marginLeft: 4 }}>{srcLabel}</span>}
            </div>
            <div className="pr-right">
              <span className="pr-date">{fmt(p.purchased_at)}</span>
              <button className="icon-btn danger" onClick={() => deletePurchase(p.id)}><TrashIcon /></button>
            </div>
          </div>
        );
      })}

      {showModal && (
        <PurchaseModal
          ingredients={ingredients}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refresh(); }}
        />
      )}
      {showIngModal && (
        <IngredientModal
          onClose={() => setShowIngModal(false)}
          onSaved={() => { setShowIngModal(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ── PURCHASE MODAL ────────────────────────────────────────────────────────────
function PurchaseModal({ ingredients, onClose, onSaved }) {
  const [type, setType] = useState("buy");
  const [ingId, setIngId] = useState(ingredients[0]?.id || "");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [source, setSource] = useState("madina");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const selectedIng = ingredients.find(i => i.id === ingId);

  async function save() {
    if (!ingId || !qty) return alert("Выберите ингредиент и количество");
    setSaving(true);
    await supabase.from("purchases").insert({
      type,
      ingredient: ingId,
      qty: Number(String(qty).replace(",", ".")),
      unit: selectedIng?.unit || "кг",
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

      <div className="fg">
        <label>Ингредиент</label>
        <select value={ingId} onChange={e => setIngId(e.target.value)}>
          <option value="">— выберите —</option>
          {ingredients.map(i => (
            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="fg">
          <label>Количество {selectedIng && `(${selectedIng.unit})`}</label>
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={e => setQty(e.target.value.replace(",", "."))}
            placeholder="1"
          />
        </div>
        <div className="fg">
          <label>Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {type === "buy" && (
        <>
          <div className="fg">
            <label>Сумма (QAR)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
          </div>
          <div className="fg">
            <label>Откуда оплачено</label>
            <div className="pay-method-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {SOURCE_OPTIONS.map(([s, ico, lbl]) => (
                <button key={s} className={`pay-method-btn ${s === "husband" ? "husband" : ""} ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>
                  <span style={{ fontSize: 18 }}>{ico}</span>{lbl}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}

// ── INGREDIENT MODAL ──────────────────────────────────────────────────────────
function IngredientModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("кг");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return alert("Введите название");
    setSaving(true);
    await supabase.from("ingredients").insert({ name: name.trim(), unit });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Новый ингредиент" onClose={onClose}>
      <div className="fg">
        <label>Название</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Мука, мясо..." autoFocus />
      </div>
      <div className="fg">
        <label>Единица измерения</label>
        <select value={unit} onChange={e => setUnit(e.target.value)}>
          <option value="кг">кг</option>
          <option value="г">г</option>
          <option value="л">л</option>
          <option value="шт">шт</option>
          <option value="упак">упак</option>
          <option value="пач">пач</option>
        </select>
      </div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Добавить"}</button>
      </div>
    </Modal>
  );
}
