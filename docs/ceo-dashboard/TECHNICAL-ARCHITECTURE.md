# CEO BUSINESS DASHBOARD — STAGE 2 TECHNICAL ARCHITECTURE
Raudhah Tech Build Framework — Layers 4, 5, 6, 7
Build target: Flagship module inside aiforceo (confirmed at Stage 1 sign-off)
Pilot entity: Ahmad's HotChicken
Date: 8 July 2026
Status: Stage 2 Complete — ready for Stage 3 Cowork handoff

---

# CONFIRMED DECISIONS CARRIED FROM STAGE 1

1. Built as a module inside aiforceo, not a standalone codebase. Lives in the aiforceo repo under the ariavibecoderlab GitHub org. Uses aiforceo's existing auth, workspaces, and billing.
2. P&L supports two views: Management View (Sales − COGS = GP − OPEX = EBITDA − Interest = EBIT) and Statutory View (EBITDA − Depreciation = EBIT − Interest = PBT − Tax = PAT). Same underlying data, two presentations.
3. Rollout order: Ahmad's HotChicken → DRE Coffee → group-wide.
4. MVP data input: manual forms + CSV import. First live integration post-MVP: EzPOS sales feed.

---

# LAYER 4 — BACKEND LAYER

## Runtime and Framework

- Next.js 14 App Router route handlers (TypeScript) inside the aiforceo codebase
- Supabase Postgres as the database, accessed via Supabase JS client with Row Level Security enforced
- Heavy calculations (KPI evaluation, aging, roll-ups) done in Postgres views and functions, not in application code, so all clients see identical numbers

## Module Structure Inside aiforceo

- apps/web/app/(modules)/ceo-dashboard/ — all routes and screens
- packages/ceo-dashboard/ — shared logic: formula engine, KPI evaluator, CSV parsers, export builders
- supabase/migrations/ceo_*.sql — all module tables prefixed ceo_

## API Endpoints

Group and entity overview
- GET /api/ceo/group/overview — all ventures with health status, headline numbers, red count
- GET /api/ceo/entities — list entities the user can access
- GET /api/ceo/entities/:id/dashboard?period=&granularity= — one venture, all four tabs summarised

Financial
- GET/POST/PATCH /api/ceo/entities/:id/pnl
- GET/POST/PATCH /api/ceo/entities/:id/balance-sheet
- GET/POST /api/ceo/entities/:id/cashflow
- GET/POST /api/ceo/entities/:id/capex
- GET/POST/PATCH /api/ceo/entities/:id/ar and /ap (with ?aging=true for bucket view)
- GET/POST/PATCH /api/ceo/entities/:id/debts and /bank-facilities
- GET /api/ceo/group/debt-service — consolidated monthly repayment commitment

Sales and marketing
- GET/POST /api/ceo/entities/:id/funnel (POST also accepts what-if payloads without saving)
- GET/POST/PATCH /api/ceo/entities/:id/strategies (server enforces the minimum-10 red flag)
- GET/POST /api/ceo/entities/:id/channels

Operations
- GET/POST /api/ceo/entities/:id/staff-happiness
- GET/POST /api/ceo/entities/:id/customer-happiness
- GET/POST /api/ceo/entities/:id/ops-metrics

KPI and actions
- GET /api/ceo/entities/:id/kpi — current snapshot with traffic lights
- GET/POST/PATCH /api/ceo/kpi-definitions (admin only)
- POST /api/ceo/kpi/evaluate — recompute snapshots (also run by cron)
- GET/POST/PATCH /api/ceo/red-actions — the red KPI action log

Data pipeline
- POST /api/ceo/imports — upload CSV, returns parse preview with row-level errors
- POST /api/ceo/imports/:id/commit — write validated rows
- GET /api/ceo/reports/:type/export?format=pdf|xlsx

## Business Logic Rules (Formula Engine)

- COGS = opening_stock + purchases − closing_stock
- Gross Profit = sales − COGS; GP% = GP / sales
- EBITDA = GP − sum of OPEX categories
- Management EBIT = EBITDA − interest; Statutory: EBIT = EBITDA − depreciation, PBT = EBIT − interest, PAT = PBT − tax
- Balance check: total_assets must equal equity + current_year_pl + total_liabilities; unbalanced saves require an override flag and note
- Funnel: prospects = reach × cr1; customers = prospects × cr2; sales = customers × avg_sale × transactions; gp = sales × gp_pct; ebitda = gp − opex
- Traffic light: attainment = actual / target (inverted for lower-is-better KPIs). Green ≥ green_threshold (default 100%), Yellow ≥ yellow_threshold (default 70%), else Red. Thresholds configurable per KPI.
- Venture Health Score = weighted average of KPI attainment; badge shows worst of (score band, any red critical KPI)
- Strategy rule: fewer than 10 active strategies for an entity raises a red marketing KPI automatically

## Background Jobs

- 00:30 MYT nightly (pg_cron): evaluate all KPIs, write ceo_kpi_snapshots, compute venture health
- Hourly: escalation sweep — red actions past 48 hours without status change are marked escalated and surfaced on the Group CEO view
- Monday 08:00 MYT: reporting-compliance check — entities with no data entered in 7 days are flagged yellow on the group grid
- Post-MVP: EzPOS nightly sales sync; WhatsApp/Telegram alert dispatch

## File Handling

- CSV templates downloadable per report type; uploads stored in Supabase Storage bucket ceo-imports (private), parsed server-side with papaparse, validated with zod schemas, previewed before commit
- PDF/Excel exports generated server-side and returned as signed URLs with 1-hour expiry

---

# LAYER 5 — DATABASE LAYER

## Database

Supabase PostgreSQL (shared aiforceo project). All module tables prefixed ceo_. Entities link to aiforceo workspaces via org_id. All money stored as numeric(14,2), currency per entity (MYR default). All tables carry created_by, created_at, updated_at.

## Schema

ceo_entities
- id uuid PK, org_id uuid FK (aiforceo workspace), name text, industry_type enum (fnb, education, healthcare, tech_saas, retail_ecommerce, other), currency char(3) default 'MYR', is_active bool, sort_weight numeric (revenue share for group pulse display)

ceo_entity_roles
- user_id uuid FK aiforceo users, entity_id uuid FK (null = org-wide), role enum (group_ceo, venture_ceo, finance, marketing, ops, admin)
- group_ceo and admin are org-wide (entity_id null); others are per entity

ceo_pnl_entries
- entity_id, period_start date, granularity enum (daily, weekly, monthly, quarterly, yearly)
- sales, opening_stock, purchases, closing_stock
- opex_rental, opex_salaries, opex_utilities, opex_marketing, opex_admin, opex_other
- interest, depreciation, tax, notes
- Generated columns: cogs, gross_profit, ebitda, ebit_mgmt, ebit_stat, pbt, pat
- Unique (entity_id, period_start, granularity)

ceo_balance_sheet_entries
- entity_id, period_start, granularity (monthly, quarterly, yearly)
- fixed_assets, cash_bank, accounts_receivable, stock_value, deposits_prepayments
- accounts_payable, bank_loans_current, bank_loans_longterm, other_debts_total
- paid_up_capital, retained_earnings, current_year_pl
- Generated: total_assets, total_liabilities, total_equity, is_balanced bool
- override_unbalanced bool, override_note text

ceo_cashflow_entries
- entity_id, txn_date, direction enum (in, out), category enum (operating, investing, financing), description, amount

ceo_capex_items
- entity_id, spend_date, category, description, amount, budget_line text

ceo_ar_invoices / ceo_ap_invoices
- entity_id, counterparty_name, invoice_no, invoice_date, due_date, amount, amount_paid, status enum (open, partial, paid, disputed)
- View ceo_ar_aging / ceo_ap_aging: buckets current, d30, d60, d90, d90_plus per entity

ceo_other_debts
- entity_id, lender, debt_type enum (director_loan, shareholder_advance, hire_purchase, other), amount_outstanding, monthly_commitment, notes

ceo_bank_facilities
- entity_id, bank, facility_type, original_amount, interest_rate, monthly_instalment, start_date, tenure_months, instalments_paid, outstanding_balance, next_payment_date, maturity_date
- View ceo_group_debt_service: total monthly commitment across facilities + other debts, by entity and group

ceo_funnel_entries
- entity_id, period_start, granularity, total_reach, cr1, cr2, avg_sale, txn_per_customer, gp_pct, opex_ref numeric
- Generated: prospects, customers, sales, gross_profit, ebitda

ceo_marketing_strategies
- entity_id, name, channel, owner_id, budget, start_date, end_date, target_leads, target_sales, actual_leads, actual_sales, cost_spent, status enum (planned, active, paused, completed, killed)
- Generated: cpa, roi
- View ceo_strategy_count: active count per entity (feeds the minimum-10 rule)

ceo_channel_metrics
- entity_id, channel enum (facebook, instagram, linkedin, tiktok, threads, website, seo, email, whatsapp, telegram, referral, alliances), period_start, granularity
- reach, followers, engagement_rate, clicks, leads, cost, customers, revenue
- extras jsonb (channel-specific: open_rate, keyword_rankings, active_referrers, etc.)
- Generated: cpl, roi

ceo_staff_happiness
- entity_id, location text, period_start, enps int, pulse_score numeric, turnover_rate, absenteeism_rate, training_hours
- Individual survey responses are NOT stored here — aggregates only (see Layer 7, PDPA)

ceo_customer_happiness
- entity_id, location, period_start, nps, csat, google_rating, google_review_count, complaints_count, avg_resolution_hours, unresolved_48h_count, repeat_rate

ceo_metric_definitions
- code PK (e.g. fnb_food_cost_pct), name, industry_type, unit, direction enum (higher_better, lower_better), default_target
- Seeded with the full industry metric sets from Stage 1 (F&B, education, healthcare, tech, retail)

ceo_ops_metrics
- entity_id, metric_code FK, location, period_start, value

ceo_kpi_definitions
- id, entity_id (null = group default for that industry), name, source_kind enum (pnl, bs, cashflow, funnel, channel, staff, customer, ops_metric, strategy_count), source_ref text, target numeric, direction, green_threshold_pct default 100, yellow_threshold_pct default 70, weight numeric default 1, is_critical bool

ceo_kpi_snapshots
- kpi_id, period_start, granularity, actual, attainment_pct, status enum (green, yellow, red), computed_at

ceo_red_actions
- kpi_snapshot_id, owner_id, action_note, deadline, status enum (open, in_progress, done, escalated), escalated_at

ceo_imports
- entity_id, import_type, filename, storage_path, status enum (uploaded, validated, committed, failed), row_count, error_report jsonb

ceo_audit_log
- user_id, entity_id, table_name, record_id, action enum (insert, update, delete, import, export), diff jsonb, at timestamptz

## Indexes

- Every fact table: (entity_id, period_start, granularity) or (entity_id, txn_date)
- ceo_ar_invoices/ceo_ap_invoices: (entity_id, status, due_date)
- ceo_kpi_snapshots: (kpi_id, period_start), partial index on status = 'red'
- ceo_red_actions: partial index on status in ('open','escalated')

## Data Retention

- Financial records: retained 7 years (Malaysian statutory requirement), no auto-deletion
- Import files: purged from storage after 90 days (parsed data remains)
- Audit log: 3 years

## Seed Data

- ceo_metric_definitions seeded for all 5 industry types
- Ahmad's HotChicken created as pilot entity with default KPI set: sales vs target, GP%, food cost % (lower better), labour cost % (lower better), cash runway months, AR overdue %, active strategies ≥ 10, eNPS, NPS, Google rating
- Demo dataset for staging: 3 months of realistic figures for training the team

---

# LAYER 6 — INFRASTRUCTURE LAYER

## Hosting

- Frontend + API: Cloudflare (aiforceo's existing deployment via @cloudflare/next-on-pages)
- Database, auth, storage: Supabase (aiforceo project)
- Scheduled jobs: Supabase pg_cron for in-database jobs; Cloudflare Cron Triggers for jobs needing external calls (post-MVP alerts, EzPOS sync)

## Environments

- local → staging (staging Supabase branch + Cloudflare preview) → production
- Feature branches deploy as Cloudflare preview URLs automatically

## CI/CD

- GitHub repo: ariavibecoderlab/aiforceo (module lives inside; no new repo)
- GitHub Actions: on PR — typecheck, lint, unit tests on the formula engine (every P&L, funnel, and traffic-light formula has test coverage), Supabase migration dry-run; on merge to main — deploy staging; production deploy on tagged release with manual approval
- Formula engine tests are mandatory: the numbers on this dashboard drive real decisions, so a broken formula is a release blocker

## Environment Variables

- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only, never exposed)
- ANTHROPIC_API_KEY (post-MVP AI briefing)
- EXPORT_SIGNING_SECRET (report export URLs)
- Post-MVP: EZPOS_API_KEY, META_ACCESS_TOKEN, WHATSAPP_API_KEY, TELEGRAM_BOT_TOKEN
- .env.example committed with every key documented

## Scaling Triggers

- MVP load is small (dozens of users, thousands of rows). Watch: Supabase connection pool at 80%, KPI evaluation job exceeding 5 minutes, dashboard queries over 1 second p95. Materialise the group overview into a cached view if the entity count passes 30.

---

# LAYER 7 — SECURITY LAYER

## Authentication

- aiforceo's existing Supabase Auth (email + password, magic link). No separate login for this module.
- Session policy inherited from aiforceo; recommend enforcing MFA for group_ceo, admin, and finance roles given the sensitivity of consolidated financials.

## Authorisation — Role and Permission Matrix

Roles and what they can do:

group_ceo (org-wide)
- Read: everything, all entities. Write: red action assignments, KPI targets. Cannot edit raw financial entries (separation of duty — the CEO reads, finance enters).

admin (org-wide)
- Manage entities, users, roles, KPI definitions, metric definitions. No special access to enter financials unless also holding a finance role.

venture_ceo (per entity)
- Read: everything for their entity. Write: red actions for their entity, strategy tracker.

finance (per entity)
- Read/write: P&L, balance sheet, cash flow, CAPEX, AR, AP, debts, bank facilities, financial CSV imports. Read: rest of their entity.

marketing (per entity)
- Read/write: funnel, strategies, channel metrics. Read: sales headline only (no full P&L).

ops (per entity)
- Read/write: staff happiness, customer happiness, ops metrics. Read: KPI board for their entity.

Enforcement: Postgres Row Level Security on every ceo_ table, keyed on ceo_entity_roles. No client-side-only checks. The service role key is used only inside server route handlers for imports and exports, with explicit entity checks.

## Data Protection

- Encryption in transit: TLS everywhere (Cloudflare + Supabase default)
- Encryption at rest: Supabase managed
- Staff happiness: only aggregated scores stored; individual survey responses live in the survey tool, never in this database — keeps PDPA exposure minimal
- Audit log on all financial writes, imports, and exports (who, what, when, diff)
- Export URLs signed and expiring; exports logged

## Input Validation and Abuse Prevention

- zod validation on every endpoint; money fields positive decimals; dates within sane ranges; enum whitelisting on all category fields
- CSV imports: size cap 10 MB, row cap 50,000, formula-injection stripping (leading =, +, -, @ in text cells), full row-level error report before commit
- Rate limiting at Cloudflare (per-IP and per-user on write endpoints)
- Balance sheet override requires a note and is audit-logged

## Compliance

- PDPA Malaysia: personal data limited to user accounts and AR/AP counterparty names (business contact data); privacy notice inherited from aiforceo; data processing register entry added for this module
- Financial record retention 7 years as per Layer 5

---

# HANDOFF NOTE — STAGE 2 TO STAGE 3

WHAT WAS COMPLETED:
Full Technical Architecture for the CEO Business Dashboard module covering Layers 4 (Backend), 5 (Database), 6 (Infrastructure), and 7 (Security), aligned with the locked Raudhah stack and the aiforceo foundation.

DOCUMENTS PRODUCED:
- CEO-Business-Dashboard-Product-Brief.md (Stage 1)
- CEO-Business-Dashboard-Technical-Architecture.md (this document)
- ceo-dashboard-group-overview-mockup.html (visual mockup of the Group Overview screen)

DECISIONS MADE:
- Module inside aiforceo repo, tables prefixed ceo_, RLS-enforced multi-entity access
- Formula engine as a tested shared package; formula test coverage is a release blocker
- Aggregate-only storage of staff happiness data for PDPA safety
- pg_cron nightly KPI evaluation + hourly 48-hour escalation sweep

OPEN QUESTIONS / ASSUMPTIONS:
- Assumed aiforceo's workspace and user tables are stable; Stage 3 should confirm exact FK names against the live schema
- MFA enforcement for sensitive roles needs confirmation it is supported in current aiforceo auth config
- Confirm which accounting software each venture exports from, so CSV templates match their export format exactly

NEXT STAGE INSTRUCTIONS (Claude Cowork, Stage 3):
1. Read the aiforceo codebase and confirm FK targets for org_id and user_id
2. Create the module folder structure per Layer 4
3. Write CLAUDE.md for the module (context, conventions, formula rules, RLS policy patterns)
4. Generate BUILD_CHECKLIST.md across all 10 layers from these two documents
5. Produce the migration file skeletons for all ceo_ tables in dependency order
6. Flag any conflicts with existing aiforceo tables or routes before Claude Code begins Stage 4
