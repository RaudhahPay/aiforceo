-- =========================================================
-- 0017_ceo_financial.sql — CEO Dashboard: financial tables
-- P&L, balance sheet, cashflow, capex, AR/AP + aging views,
-- other debts, bank facilities, group debt service view.
-- Depends on 0016_ceo_core.sql.
--
-- Formula rules mirror src/lib/ceo-dashboard/formulas.ts exactly.
-- Postgres generated columns cannot reference each other, so the
-- expressions are expanded inline.
-- =========================================================

-- =========================================================
-- ceo_pnl_entries
-- COGS = opening_stock + purchases - closing_stock
-- GP = sales - COGS ; EBITDA = GP - sum(OPEX)
-- Management: EBIT = EBITDA - interest
-- Statutory:  EBIT = EBITDA - depreciation ; PBT = EBIT - interest ; PAT = PBT - tax
-- =========================================================
create table if not exists public.ceo_pnl_entries (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references public.ceo_entities(id) on delete cascade,
  period_start   date not null,
  granularity    text not null check (granularity in ('daily','weekly','monthly','quarterly','yearly')),
  sales          numeric(14,2) not null default 0,
  opening_stock  numeric(14,2) not null default 0,
  purchases      numeric(14,2) not null default 0,
  closing_stock  numeric(14,2) not null default 0,
  opex_rental    numeric(14,2) not null default 0,
  opex_salaries  numeric(14,2) not null default 0,
  opex_utilities numeric(14,2) not null default 0,
  opex_marketing numeric(14,2) not null default 0,
  opex_admin     numeric(14,2) not null default 0,
  opex_other     numeric(14,2) not null default 0,
  interest       numeric(14,2) not null default 0,
  depreciation   numeric(14,2) not null default 0,
  tax            numeric(14,2) not null default 0,
  notes          text,
  cogs numeric(14,2) generated always as (opening_stock + purchases - closing_stock) stored,
  gross_profit numeric(14,2) generated always as (sales - (opening_stock + purchases - closing_stock)) stored,
  ebitda numeric(14,2) generated always as (
    sales - (opening_stock + purchases - closing_stock)
    - (opex_rental + opex_salaries + opex_utilities + opex_marketing + opex_admin + opex_other)
  ) stored,
  ebit_mgmt numeric(14,2) generated always as (
    sales - (opening_stock + purchases - closing_stock)
    - (opex_rental + opex_salaries + opex_utilities + opex_marketing + opex_admin + opex_other)
    - interest
  ) stored,
  ebit_stat numeric(14,2) generated always as (
    sales - (opening_stock + purchases - closing_stock)
    - (opex_rental + opex_salaries + opex_utilities + opex_marketing + opex_admin + opex_other)
    - depreciation
  ) stored,
  pbt numeric(14,2) generated always as (
    sales - (opening_stock + purchases - closing_stock)
    - (opex_rental + opex_salaries + opex_utilities + opex_marketing + opex_admin + opex_other)
    - depreciation - interest
  ) stored,
  pat numeric(14,2) generated always as (
    sales - (opening_stock + purchases - closing_stock)
    - (opex_rental + opex_salaries + opex_utilities + opex_marketing + opex_admin + opex_other)
    - depreciation - interest - tax
  ) stored,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (entity_id, period_start, granularity)
);
create index if not exists ceo_pnl_entity_period_idx on public.ceo_pnl_entries(entity_id, period_start, granularity);
create trigger ceo_pnl_touch before update on public.ceo_pnl_entries
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_balance_sheet_entries
-- Balance check: total_assets = total_liabilities + total_equity
-- (equity already includes current_year_pl). Unbalanced saves need
-- override_unbalanced + a note (enforced by check constraint).
-- =========================================================
create table if not exists public.ceo_balance_sheet_entries (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references public.ceo_entities(id) on delete cascade,
  period_start          date not null,
  granularity           text not null check (granularity in ('monthly','quarterly','yearly')),
  fixed_assets          numeric(14,2) not null default 0,
  cash_bank             numeric(14,2) not null default 0,
  accounts_receivable   numeric(14,2) not null default 0,
  stock_value           numeric(14,2) not null default 0,
  deposits_prepayments  numeric(14,2) not null default 0,
  accounts_payable      numeric(14,2) not null default 0,
  bank_loans_current    numeric(14,2) not null default 0,
  bank_loans_longterm   numeric(14,2) not null default 0,
  other_debts_total     numeric(14,2) not null default 0,
  paid_up_capital       numeric(14,2) not null default 0,
  retained_earnings     numeric(14,2) not null default 0,
  current_year_pl       numeric(14,2) not null default 0,
  total_assets numeric(14,2) generated always as (
    fixed_assets + cash_bank + accounts_receivable + stock_value + deposits_prepayments
  ) stored,
  total_liabilities numeric(14,2) generated always as (
    accounts_payable + bank_loans_current + bank_loans_longterm + other_debts_total
  ) stored,
  total_equity numeric(14,2) generated always as (
    paid_up_capital + retained_earnings + current_year_pl
  ) stored,
  is_balanced boolean generated always as (
    abs(
      (fixed_assets + cash_bank + accounts_receivable + stock_value + deposits_prepayments)
      - ((accounts_payable + bank_loans_current + bank_loans_longterm + other_debts_total)
         + (paid_up_capital + retained_earnings + current_year_pl))
    ) < 0.01
  ) stored,
  override_unbalanced   boolean not null default false,
  override_note         text,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (entity_id, period_start, granularity),
  constraint ceo_bs_override_needs_note check (override_unbalanced = false or override_note is not null)
);
create index if not exists ceo_bs_entity_period_idx on public.ceo_balance_sheet_entries(entity_id, period_start, granularity);
create trigger ceo_bs_touch before update on public.ceo_balance_sheet_entries
  for each row execute function public.ceo_touch_updated_at();

-- unbalanced saves without override are rejected server-side; belt-and-braces here
create or replace function public.ceo_bs_check_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not new.is_balanced and not new.override_unbalanced then
    raise exception 'Balance sheet does not balance; set override_unbalanced with a note';
  end if;
  return new;
end;
$$;
create trigger ceo_bs_balance_gate before insert or update on public.ceo_balance_sheet_entries
  for each row execute function public.ceo_bs_check_balance();

-- =========================================================
-- ceo_cashflow_entries
-- =========================================================
create table if not exists public.ceo_cashflow_entries (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.ceo_entities(id) on delete cascade,
  txn_date    date not null,
  direction   text not null check (direction in ('in','out')),
  category    text not null check (category in ('operating','investing','financing')),
  description text,
  amount      numeric(14,2) not null check (amount >= 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ceo_cashflow_entity_date_idx on public.ceo_cashflow_entries(entity_id, txn_date);
create trigger ceo_cashflow_touch before update on public.ceo_cashflow_entries
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_capex_items
-- =========================================================
create table if not exists public.ceo_capex_items (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.ceo_entities(id) on delete cascade,
  spend_date  date not null,
  category    text,
  description text,
  amount      numeric(14,2) not null check (amount >= 0),
  budget_line text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ceo_capex_entity_date_idx on public.ceo_capex_items(entity_id, spend_date);
create trigger ceo_capex_touch before update on public.ceo_capex_items
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_ar_invoices / ceo_ap_invoices + aging views
-- =========================================================
create table if not exists public.ceo_ar_invoices (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references public.ceo_entities(id) on delete cascade,
  counterparty_name  text not null,
  invoice_no         text,
  invoice_date       date not null,
  due_date           date not null,
  amount             numeric(14,2) not null check (amount >= 0),
  amount_paid        numeric(14,2) not null default 0 check (amount_paid >= 0),
  status             text not null default 'open' check (status in ('open','partial','paid','disputed')),
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ceo_ar_entity_status_due_idx on public.ceo_ar_invoices(entity_id, status, due_date);
create trigger ceo_ar_touch before update on public.ceo_ar_invoices
  for each row execute function public.ceo_touch_updated_at();

create table if not exists public.ceo_ap_invoices (
  id                 uuid primary key default gen_random_uuid(),
  entity_id          uuid not null references public.ceo_entities(id) on delete cascade,
  counterparty_name  text not null,
  invoice_no         text,
  invoice_date       date not null,
  due_date           date not null,
  amount             numeric(14,2) not null check (amount >= 0),
  amount_paid        numeric(14,2) not null default 0 check (amount_paid >= 0),
  status             text not null default 'open' check (status in ('open','partial','paid','disputed')),
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ceo_ap_entity_status_due_idx on public.ceo_ap_invoices(entity_id, status, due_date);
create trigger ceo_ap_touch before update on public.ceo_ap_invoices
  for each row execute function public.ceo_touch_updated_at();

-- security_invoker so the caller's RLS on the base table applies
create or replace view public.ceo_ar_aging
with (security_invoker = on) as
select
  entity_id,
  sum(case when due_date >= current_date then amount - amount_paid else 0 end) as current,
  sum(case when due_date < current_date and due_date >= current_date - 30 then amount - amount_paid else 0 end) as d30,
  sum(case when due_date < current_date - 30 and due_date >= current_date - 60 then amount - amount_paid else 0 end) as d60,
  sum(case when due_date < current_date - 60 and due_date >= current_date - 90 then amount - amount_paid else 0 end) as d90,
  sum(case when due_date < current_date - 90 then amount - amount_paid else 0 end) as d90_plus,
  sum(amount - amount_paid) as total_outstanding
from public.ceo_ar_invoices
where status in ('open','partial','disputed')
group by entity_id;

create or replace view public.ceo_ap_aging
with (security_invoker = on) as
select
  entity_id,
  sum(case when due_date >= current_date then amount - amount_paid else 0 end) as current,
  sum(case when due_date < current_date and due_date >= current_date - 30 then amount - amount_paid else 0 end) as d30,
  sum(case when due_date < current_date - 30 and due_date >= current_date - 60 then amount - amount_paid else 0 end) as d60,
  sum(case when due_date < current_date - 60 and due_date >= current_date - 90 then amount - amount_paid else 0 end) as d90,
  sum(case when due_date < current_date - 90 then amount - amount_paid else 0 end) as d90_plus,
  sum(amount - amount_paid) as total_outstanding
from public.ceo_ap_invoices
where status in ('open','partial','disputed')
group by entity_id;

-- =========================================================
-- ceo_other_debts + ceo_bank_facilities + group debt service
-- =========================================================
create table if not exists public.ceo_other_debts (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references public.ceo_entities(id) on delete cascade,
  lender              text not null,
  debt_type           text not null check (debt_type in ('director_loan','shareholder_advance','hire_purchase','other')),
  amount_outstanding  numeric(14,2) not null default 0,
  monthly_commitment  numeric(14,2) not null default 0,
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ceo_other_debts_entity_idx on public.ceo_other_debts(entity_id);
create trigger ceo_other_debts_touch before update on public.ceo_other_debts
  for each row execute function public.ceo_touch_updated_at();

create table if not exists public.ceo_bank_facilities (
  id                  uuid primary key default gen_random_uuid(),
  entity_id           uuid not null references public.ceo_entities(id) on delete cascade,
  bank                text not null,
  facility_type       text,
  original_amount     numeric(14,2) not null default 0,
  interest_rate       numeric,
  monthly_instalment  numeric(14,2) not null default 0,
  start_date          date,
  tenure_months       int,
  instalments_paid    int not null default 0,
  outstanding_balance numeric(14,2) not null default 0,
  next_payment_date   date,
  maturity_date       date,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ceo_bank_facilities_entity_idx on public.ceo_bank_facilities(entity_id);
create trigger ceo_bank_facilities_touch before update on public.ceo_bank_facilities
  for each row execute function public.ceo_touch_updated_at();

create or replace view public.ceo_group_debt_service
with (security_invoker = on) as
select
  e.org_id,
  e.id as entity_id,
  e.name as entity_name,
  coalesce(f.facilities_monthly, 0) as facilities_monthly,
  coalesce(d.other_debts_monthly, 0) as other_debts_monthly,
  coalesce(f.facilities_monthly, 0) + coalesce(d.other_debts_monthly, 0) as total_monthly_commitment
from public.ceo_entities e
left join (
  select entity_id, sum(monthly_instalment) as facilities_monthly
  from public.ceo_bank_facilities group by entity_id
) f on f.entity_id = e.id
left join (
  select entity_id, sum(monthly_commitment) as other_debts_monthly
  from public.ceo_other_debts group by entity_id
) d on d.entity_id = e.id
where e.is_active;

-- =========================================================
-- RLS — role matrix (Layer 7)
-- Financial read: group_ceo, admin, venture_ceo, finance
--   (marketing is EXCLUDED from full P&L/BS by design — sales headline
--    is served through a dedicated helper; ops has no financial read)
-- Financial write: finance only (separation of duty — group_ceo reads,
--   finance enters)
-- =========================================================

do $$
declare t text;
begin
  foreach t in array array[
    'ceo_pnl_entries','ceo_balance_sheet_entries','ceo_cashflow_entries',
    'ceo_capex_items','ceo_ar_invoices','ceo_ap_invoices',
    'ceo_other_debts','ceo_bank_facilities'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.ceo_has_entity_role(entity_id, array[''group_ceo'',''admin'',''venture_ceo'',''finance'']))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.ceo_has_entity_role(entity_id, array[''finance'']))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update using (public.ceo_has_entity_role(entity_id, array[''finance''])) with check (public.ceo_has_entity_role(entity_id, array[''finance'']))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete using (public.ceo_has_entity_role(entity_id, array[''finance'']))',
      t || '_delete', t);
  end loop;
end $$;
