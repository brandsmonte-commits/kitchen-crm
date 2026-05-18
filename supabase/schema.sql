-- ============================================================
-- Домашняя кухня CRM v3 — Supabase Schema
-- Запустить в: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  note text,
  created_at timestamptz default now()
);

-- Menu items
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  cost numeric,
  category text,
  unit text default 'шт',
  created_at timestamptz default now()
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  delivery_date date not null,
  delivery_time text,                          -- "14:30"
  status text not null default 'new',          -- new|confirmed|cooking|delivered|cancelled
  disc_type text default 'none',               -- none|percent|amount
  disc_value numeric default 0,
  note text,
  created_at timestamptz default now()
);

-- Order items (состав заказа)
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  qty integer not null default 1
);

-- Payments (оплаты клиентов, отдельные записи)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  amount numeric not null,
  method text not null,                        -- cash|card
  paid_at date default current_date,
  created_at timestamptz default now()
);

-- Purchases (закупки и списания)
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'buy',            -- buy|use
  ingredient text not null,
  qty numeric not null,
  unit text default 'кг',
  total_price numeric default 0,
  source text,                                 -- cash|card|husband (NULL для use)
  purchased_at date default current_date,
  created_at timestamptz default now()
);

-- Withdrawals (вывод средств)
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  source text not null,                        -- cash|card
  note text,
  withdrawn_at date default current_date,
  created_at timestamptz default now()
);

-- Husband credit repayments (погашение кредита мужа)
create table if not exists repayments (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  source text not null,                        -- cash|card (откуда возвращаем)
  note text,
  repaid_at date default current_date,
  created_at timestamptz default now()
);

-- ── INDEXES ──
create index if not exists idx_orders_date on orders(delivery_date);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_payments_order on payments(order_id);
create index if not exists idx_payments_date on payments(paid_at);
create index if not exists idx_purchases_date on purchases(purchased_at);
create index if not exists idx_order_items_order on order_items(order_id);

-- ── RLS (Row Level Security) ──
alter table clients enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table purchases enable row level security;
alter table withdrawals enable row level security;
alter table repayments enable row level security;

-- Для домашнего использования (один пользователь): разрешить всё
create policy "allow_all_clients"     on clients     for all using (true) with check (true);
create policy "allow_all_menu_items"  on menu_items  for all using (true) with check (true);
create policy "allow_all_orders"      on orders      for all using (true) with check (true);
create policy "allow_all_order_items" on order_items for all using (true) with check (true);
create policy "allow_all_payments"    on payments    for all using (true) with check (true);
create policy "allow_all_purchases"   on purchases   for all using (true) with check (true);
create policy "allow_all_withdrawals" on withdrawals for all using (true) with check (true);
create policy "allow_all_repayments"  on repayments  for all using (true) with check (true);

-- ── SEED DATA (тестовые данные, можно удалить позже) ──
insert into clients (name, phone, note) values
  ('Aisha Al-Mansoori', '+974 5512 3456', 'Al Sadd, Street 12'),
  ('Марина Иванова', '+974 7798 4321', 'Любит острое'),
  ('Бахыт Нурланов', '+974 3344 1122', 'West Bay');

insert into menu_items (name, price, cost, category, unit) values
  ('Манты (10 шт)', 50, 18, 'Горячее', 'порция'),
  ('Пельмени (0.5 кг)', 35, 12, 'Горячее', 'упак'),
  ('Самса (4 шт)', 25, 8, 'Выпечка', 'порция'),
  ('Беляши (5 шт)', 20, 6, 'Выпечка', 'порция'),
  ('Бешбармак', 110, 42, 'Горячее', 'порция'),
  ('Лагман', 35, 13, 'Горячее', 'порция');
