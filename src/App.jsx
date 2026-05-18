import { useState, useEffect, useCallback } from "react";
import { isConfigured, loadAll } from "./db";
import CalendarView from "./views/CalendarView";
import ClientsView from "./views/ClientsView";
import MenuView from "./views/MenuView";
import WarehouseView from "./views/WarehouseView";
import FinanceView from "./views/FinanceView";

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    clients: [],
    menu: [],
    orders: [],
    payments: [],
    purchases: [],
    withdrawals: [],
    repayments: [],
  });

  const refresh = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    try {
      const fresh = await loadAll();
      setData(fresh);
    } catch (e) {
      console.error("Load failed:", e);
      alert("Ошибка загрузки. Проверь Supabase ключи и SQL-схему.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isConfigured) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏠🍽️</div>
          <h1>Домашняя кухня CRM</h1>
          <p style={{ color: "var(--text2)", marginBottom: 14 }}>
            Не заданы Supabase-ключи. Создайте файл <code>.env</code>:
          </p>
          <div className="code-block">
            <code>VITE_SUPABASE_URL=https://xxx.supabase.co</code>
            <code>VITE_SUPABASE_ANON_KEY=eyJhbGc...</code>
          </div>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>
            Затем выполните <code>supabase/schema.sql</code> в SQL Editor.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">Загрузка...</div>;

  const tabs = [
    { id: "calendar", label: "Заказы", icon: "calendar" },
    { id: "clients", label: "Клиенты", icon: "users" },
    { id: "menu", label: "Меню", icon: "menu" },
    { id: "warehouse", label: "Склад", icon: "warehouse" },
    { id: "finance", label: "Финансы", icon: "finance" },
  ];

  return (
    <div className="app">
      <div className="content">
        {tab === "calendar" && <CalendarView data={data} refresh={refresh} />}
        {tab === "clients" && <ClientsView data={data} refresh={refresh} />}
        {tab === "menu" && <MenuView data={data} refresh={refresh} />}
        {tab === "warehouse" && <WarehouseView data={data} refresh={refresh} />}
        {tab === "finance" && <FinanceView data={data} refresh={refresh} />}
      </div>
      <nav className="bottom-nav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <NavIcon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavIcon({ name }) {
  const icons = {
    calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    menu: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>,
    warehouse: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="8" height="6" x="8" y="18" rx="1"/></svg>,
    finance: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  };
  return icons[name];
}
