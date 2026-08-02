# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Домашняя кухня CRM — a single-page React app (Vite) for tracking home-kitchen food orders: calendar of orders, clients, menu, warehouse (purchases/write-offs), and finances (account balances, payments, husband's credit). Built for one user (no auth), backed by Supabase (Postgres) as the only data store. Static build is auto-deployed to GitHub Pages.

## Commands

```bash
npm install       # install deps
npm run dev        # start Vite dev server (http://localhost:5173/kitchen-crm/)
npm run build       # production build to dist/
npm run preview      # preview the production build
```

There is no test suite and no linter configured in this repo.

Local dev requires a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Without them, `src/db.js` logs a warning and `isConfigured` is `false`, so `App.jsx` skips loading data.

Deployment is automatic via `.github/workflows/deploy.yml` on push to `main`: it builds with the two Supabase secrets injected from GitHub Actions secrets and publishes `dist/` to GitHub Pages. `vite.config.js`'s `base` must match the GitHub repo name (currently `/kitchen-crm/`) or the deployed site is a blank page.

## Architecture

**Data flow is single-directional and centralized in `App.jsx`.** `App` loads all tables in one `loadAll()` call (`src/db.js`) into a single `data` state object (`clients, menu, orders, payments, purchases, withdrawals, repayments, ingredients`), then passes `{ data, refresh }` down to whichever view tab is active. There is no per-view fetching and no client-side cache/store — any mutation (`upsertOrder`, `addPayment`, etc.) is followed by calling `refresh()` to reload everything from Supabase. Keep this pattern when adding features: add a CRUD function to `db.js`, call it from the view, then `refresh()`.

**`src/db.js` is the only place that talks to Supabase.** Every table read/write goes through named exports here (e.g. `upsertClient`, `upsertOrder`, `addPayment`). `orders` are joined client-side with `order_items` in `loadAll()` — Supabase queries stay flat/per-table, joins happen in JS.

**`src/helpers.js` is the business-logic layer** — order totals/discounts/debt, payment state, and account balances are all *derived*, not stored. Key thing to understand: money is tracked as a ledger, not a stored balance column. `accountBalance(data, account)` computes a balance by summing `payments` (in) minus `purchases` (out, where `type === "buy"`) minus `withdrawals` minus `repayments`, all filtered by matching `method`/`source` to the account name. Accounts in use: `madina`, `moldir`, `card`, `husband` (`cash` is a legacy alias kept for backward compatibility with old records — `cashBalance` sums `madina + moldir`). `husbandDebt` similarly nets purchases sourced from `husband` against `repayments`. Any new money-affecting feature should extend these derivations rather than introduce a stored balance.

**Views (`src/views/*.jsx`) are self-contained tab screens**, each receiving `data` and `refresh` as props from `App.jsx` and rendering its own modals via the shared `Modal` component (`src/components/Modal.jsx`, also holds shared icon components). There's no router — `App.jsx` holds `tab` state and conditionally renders one view at a time; navigation is the bottom nav bar built from a hardcoded `tabs` array with inline SVG icons.

**Database schema** lives in `supabase/schema.sql` — the single source of truth for tables, indexes, and RLS policies, meant to be run manually in the Supabase SQL editor (there's no migration tool). RLS policies are `allow_all` (`using (true)`) on every table, since the anon key is the only credential and the app assumes a single trusted user. If auth is ever added, `schema.sql` and every `supabase.from(...)` call in `db.js` need to move to `user_id`-scoped policies together.

Statuses (`STATUS`) and payment-method labels (`SOURCE_LABEL`) are defined once in `helpers.js` — add new statuses/sources there, not inline in views.
