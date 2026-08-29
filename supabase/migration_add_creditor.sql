-- ============================================================
-- Миграция: второй кредитор (Асхат / Азамат)
-- Запустить ОДИН РАЗ в: Supabase → SQL Editor → New query → Run
-- Безопасно для существующих данных: старые погашения получат
-- creditor='husband' (= Асхат), что сохраняет прежний баланс долга.
-- ============================================================

alter table repayments
  add column if not exists creditor text not null default 'husband';

-- (не обязательно, но полезно для скорости выборок)
create index if not exists idx_repayments_creditor on repayments(creditor);

-- Примечание: колонка purchases.source уже текстовая и без ограничений,
-- поэтому значение 'azamat' там можно использовать сразу, без миграции.

