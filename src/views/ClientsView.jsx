import { useState } from "react";
import Modal, { TrashIcon } from "../components/Modal";
import { cur, orderDebt, orderPaid } from "../helpers";
import * as db from "../db";

export default function ClientsView({ data, refresh }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | {} | client

  const filtered = data.clients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  async function handleDelete(id) {
    if (!confirm("Удалить клиента?")) return;
    await db.deleteClient(id);
    refresh();
  }

  return (
    <div className="view">
      <div className="view-header">
        <h2>Клиенты</h2>
        <button className="btn btn-sm" onClick={() => setEditing({})}>＋ Клиент</button>
      </div>
      <input
        className="search"
        placeholder="Поиск..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="empty-msg">Клиентов не найдено</p>
      ) : (
        filtered.map((c) => {
          const orders = data.orders.filter((o) => o.client_id === c.id);
          const spent = orders.reduce((s, o) => s + orderPaid(o, data.menu, data.payments), 0);
          const debt = orders.reduce((s, o) => s + orderDebt(o, data.menu, data.payments), 0);
          return (
            <div key={c.id} className="client-card">
              <div className="client-top">
                <div>
                  <div className="client-name">{c.name}</div>
                  {c.phone && <a className="client-phone" href={`tel:${c.phone}`}>📞 {c.phone}</a>}
                </div>
                <button className="icon-btn danger" onClick={() => handleDelete(c.id)}>
                  <TrashIcon size={16} />
                </button>
              </div>
              <div className="client-stats">
                <div className="stat"><span className="stat-l">Заказов</span><span className="stat-v">{orders.length}</span></div>
                <div className="stat"><span className="stat-l">Оплачено</span><span className="stat-v">{cur(spent)}</span></div>
                {debt > 0 && <div className="debt-badge">Долг {cur(debt)}</div>}
              </div>
              {c.note && <div className="order-note">{c.note}</div>}
            </div>
          );
        })
      )}

      {editing !== null && (
        <ClientModal
          client={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ClientModal({ client, onClose, onSaved }) {
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [note, setNote] = useState(client?.note || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return alert("Введите имя");
    setSaving(true);
    await db.upsertClient({ id: client?.id, name, phone, note });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={client ? "Редактировать клиента" : "Новый клиент"} onClose={onClose}>
      <div className="fg"><label>Имя *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" /></div>
      <div className="fg"><label>Телефон</label><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+974 XXXX XXXX" /></div>
      <div className="fg"><label>Адрес</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Район, улица..." /></div>
      <div className="modal-acts">
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "✓ Сохранить"}</button>
      </div>
    </Modal>
  );
}
