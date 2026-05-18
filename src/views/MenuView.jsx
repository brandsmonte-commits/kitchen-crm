import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import { cur } from "../helpers";
import * as db from "../db";

export default function MenuView({ data, refresh }) {
  const [editing, setEditing] = useState(null);

  async function handleDelete(id) {
    if (!confirm("Удалить позицию?")) return;
    await db.deleteMenu(id);
    refresh();
  }

  const cats = [...new Set(data.menu.map((m) => m.category || "Другое"))];

  return (
    <div className="view">
      <div className="view-header">
        <h2>Меню</h2>
        <button className="btn btn-sm" onClick={() => setEditing({})}>＋ Позиция</button>
      </div>
      {cats.length === 0 && <p className="empty-msg">Добавьте позиции</p>}
      {cats.map((cat) => (
        <div key={cat}>
          <div className="cat-label">{cat}</div>
          {data.menu
            .filter((m) => (m.category || "Другое") === cat)
            .map((m) => {
              const margin = m.cost ? Math.round(((m.price - m.cost) / m.price) * 100) : null;
              return (
                <div key={m.id} className="menu-card">
                  <div>
                    <div className="menu-name">{m.name}</div>
                    <div className="menu-meta">
                      {m.unit} {m.cost ? `· Себест: ${cur(m.cost)}` : ""}
                      {margin !== null && ` · Наценка ${margin}%`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="menu-price">{cur(m.price)}</div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                      <button className="icon-btn" onClick={() => setEditing(m)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDelete(m.id)}><TrashIcon size={15} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ))}

      {editing !== null && (
        <MenuModal item={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function MenuModal({ item, onClose, onSaved }) {
  const [name, setName] = useState(item?.name || "");
  const [price, setPrice] = useState(item?.price || "");
  const [cost, setCost] = useState(item?.cost || "");
  const [category, setCategory] = useState(item?.category || "");
  const [unit, setUnit] = useState(item?.unit || "шт");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !price) return alert("Заполните название и цену");
    setSaving(true);
    await db.upsertMenu({
      id: item?.id,
      name,
      price: Number(price),
      cost: cost ? Number(cost) : null,
      category: category || "Другое",
      unit,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={item ? "Редактировать позицию" : "Новая позиция"} onClose={onClose}>
      <div className="fg"><label>Название *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Манты..." /></div>
      <div className="form-row">
        <div className="fg"><label>Цена (QAR) *</label><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="fg"><label>Себестоимость</label><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="fg"><label>Категория</label><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Горячее" /></div>
        <div className="fg">
          <label>Ед. изм.</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>шт</option><option>порция</option><option>кг</option><option>лоток</option><option>упак</option>
          </select>
        </div>
      </div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}
