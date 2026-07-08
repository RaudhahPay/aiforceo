-- =========================================================
-- 0018_ceo_growth_ops.sql — CEO Dashboard: sales & marketing,
-- operations, KPI snapshots, red actions, imports.
-- Depends on 0016_ceo_core.sql (+ 0017 for nothing directly).
--
-- Funnel maths (mirrors src/lib/ceo-dashboard/formulas.ts):
--   prospects = reach * cr1 ; customers = prospects * cr2
--   sales = customers * avg_sale * txn_per_customer
--   gp = sales * gp_pct ; ebitda = gp - opex_ref
-- =========================================================

-- =========================================================
-- ceo_funnel_entries
-- =========================================================
create table if not exists public.ceo_funnel_entries (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references public.ceo_entities(id) on delete cascade,
  period_start      date not null,
  granularity       text not null check (granularity in ('daily','weekly','monthly','quarterly','yearly')),
  total_reach       numeric not null default 0,
  cr1               numeric not null default 0 check (cr1 >= 0 and cr1 <= 1),
  cr2               numeric not null default 0 check (cr2 >= 0 and cr2 <= 1),
  avg_sale          numeric(14,2) not null default 0,
  txn_per_customer  numeric not null default 1,
  gp_pct            numeric not null default 0 check (gp_pct >= 0 and gp_pct <= 1),
  opex_ref          numeric(14,2) not null default 0,
  prospects numeric generated always as (total_reach * cr1) stored,
  customers numeric generated always as (total_reach * cr1 * cr2) stored,
  sales numeric(14,2) generated always as (
    round((total_reach * cr1 * cr2 * avg_sale * txn_per_customer)::numeric, 2)
  ) stored,
  gross_profit numeric(14,2) generated always as (
    round((total_reach * cr1 * cr2 * avg_sale * txn_per_customer * gp_pct)::numeric, 2)
  ) stored,
  ebitda numeric(14,2) generated always as (
    round((total_reach * cr1 * cr2 * avg_sale * txn_per_customer * gp_pct)::numeric, 2) - opex_ref
  ) stored,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (entity_id, period_start, granularity)
);
create index if not exists ceo_funnel_entity_period_idx on public.ceo_funnel_entries(entity_id, period_start, granularity);
create trigger ceo_funnel_touch before update on public.ceo_funnel_entries
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_marketing_strategies (the 10x10 bank)
-- =========================================================
create table if not exists public.ceo_marketing_strategies (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references public.ceo_entities(id) on delete cascade,
  name          text not null,
  channel       text,
  owner_id      uuid references public.profiles(id),
  budget        numeric(14,2) not null default 0,
  start_date    date,
  end_date      date,
  target_leads  numeric not null default 0,
  target_sales  numeric(14,2) not null default 0,
  actual_leads  numeric not null default 0,
  actual_sales  numeric(14,2) not null default 0,
  cost_spent    numeric(14,2) not null default 0,
  status        text not null default 'planned' check (status in ('planned','active','paused','completed','killed')),
  cpa numeric generated always as (
    case when actual_leads > 0 then round((cost_spent / actual_leads)::numeric, 2) end
  ) stored,
  roi numeric generated always as (
    case when cost_spent > 0 then round(((actual_sales - cost_spent) / cost_spent)::numeric, 4) end
  ) stored,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ceo_strategies_entity_status_idx on public.ceo_marketing_strategies(entity_id, status);
create trigger ceo_strategies_touch before update on public.ceo_marketing_strategies
  for each row execute function public.ceo_touch_updated_at();

-- feeds the minimum-10 red flag
create or replace view public.ceo_strategy_count
with (security_invoker = on) as
select entity_id, count(*) filter (where status = 'active') as active_count
from public.ceo_marketing_strategies
group by entity_id;

-- =========================================================
-- ceo_channel_metrics
-- =========================================================
create table if not exists public.ceo_channel_metrics (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid not null references public.ceo_entities(id) on delete cascade,
  channel          text not null check (channel in ('facebook','instagram','linkedin','tiktok','threads','website','seo','email','whatsapp','telegram','referral','alliances')),
  period_start     date not null,
  granularity      text not null check (granularity in ('daily','weekly','monthly','quarterly','yearly')),
  reach            numeric not null default 0,
  followers        numeric not null default 0,
  engagement_rate  numeric,
  clicks           numeric not null default 0,
  leads            numeric not null default 0,
  cost             numeric(14,2) not null default 0,
  customers        numeric not null default 0,
  revenue          numeric(14,2) not null default 0,
  extras           jsonb not null default '{}'::jsonb,
  cpl numeric generated always as (
    case when leads > 0 then round((cost / leads)::numeric, 2) end
  ) stored,
  roi numeric generated always as (
    case when cost > 0 then round(((revenue - cost) / cost)::numeric, 4) end
  ) stored,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (entity_id, channel, period_start, granularity)
);
create index if not exists ceo_channels_entity_period_idx on public.ceo_channel_metrics(entity_id, period_start, granularity);
create trigger ceo_channels_touch before update on public.ceo_channel_metrics
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_staff_happiness — AGGREGATES ONLY (PDPA: individual survey
-- responses never enter this database)
-- =========================================================
create table if not exists public.ceo_staff_happiness (
  id                uuid primary key default gen_random_uuid(),
  entity_id         uuid not null references public.ceo_entities(id) on delete cascade,
  location          text,
  period_start      date not null,
  enps              int,
  pulse_score       numeric,
  turnover_rate     numeric,
  absenteeism_rate  numeric,
  training_hours    numeric,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ceo_staff_entity_period_idx on public.ceo_staff_happiness(entity_id, period_start);
create trigger ceo_staff_touch before update on public.ceo_staff_happiness
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_customer_happiness
-- =========================================================
create table if not exists public.ceo_customer_happiness (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid not null references public.ceo_entities(id) on delete cascade,
  location              text,
  period_start          date not null,
  nps                   int,
  csat                  numeric,
  google_rating         numeric,
  google_review_count   int,
  complaints_count      int,
  avg_resolution_hours  numeric,
  unresolved_48h_count  int,
  repeat_rate           numeric,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists ceo_customer_entity_period_idx on public.ceo_customer_happiness(entity_id, period_start);
create trigger ceo_customer_touch before update on public.ceo_customer_happiness
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_ops_metrics — values against the industry metric catalog
-- =========================================================
create table if not exists public.ceo_ops_metrics (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references public.ceo_entities(id) on delete cascade,
  metric_code   text not null references public.ceo_metric_definitions(code),
  location      text,
  period_start  date not null,
  value         numeric not null,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entity_id, metric_code, location, period_start)
);
create index if not exists ceo_ops_metrics_entity_period_idx on public.ceo_ops_metrics(entity_id, period_start);
create trigger ceo_ops_metrics_touch before update on public.ceo_ops_metrics
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_kpi_snapshots — written by the evaluator (cron / service role)
-- =========================================================
create table if not exists public.ceo_kpi_snapshots (
  id              uuid primary key default gen_random_uuid(),
  kpi_id          uuid not null references public.ceo_kpi_definitions(id) on delete cascade,
  entity_id       uuid not null references public.ceo_entities(id) on delete cascade,
  period_start    date not null,
  granularity     text not null check (granularity in ('daily','weekly','monthly','quarterly','yearly')),
  actual          numeric,
  attainment_pct  numeric,
  status          text not null check (status in ('green','yellow','red')),
  computed_at     timestamptz not null default now(),
  unique (kpi_id, period_start, granularity)
);
create index if not exists ceo_kpi_snapshots_kpi_idx on public.ceo_kpi_snapshots(kpi_id, period_start);
create index if not exists ceo_kpi_snapshots_red_idx on public.ceo_kpi_snapshots(entity_id) where status = 'red';

-- =========================================================
-- ceo_red_actions — every red gets an owner and a 48-hour clock
-- =========================================================
create table if not exists public.ceo_red_actions (
  id               uuid primary key default gen_random_uuid(),
  kpi_snapshot_id  uuid not null references public.ceo_kpi_snapshots(id) on delete cascade,
  entity_id        uuid not null references public.ceo_entities(id) on delete cascade,
  owner_id         uuid references public.profiles(id),
  action_note      text not null,
  deadline         date,
  status           text not null default 'open' check (status in ('open','in_progress','done','escalated')),
  escalated_at     timestamptz,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ceo_red_actions_open_idx on public.ceo_red_actions(entity_id) where status in ('open','escalated');
create trigger ceo_red_actions_touch before update on public.ceo_red_actions
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_imports — CSV upload lifecycle (files in private bucket ceo-imports)
-- =========================================================
create table if not exists public.ceo_imports (
  id            uuid primary key default gen_random_uuid(),
  entity_id     uuid not null references public.ceo_entities(id) on delete cascade,
  import_type   text not null,
  filename      text not null,
  storage_path  text not null,
  status        text not null default 'uploaded' check (status in ('uploaded','validated','committed','failed')),
  row_count     int,
  error_report  jsonb,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ceo_imports_entity_idx on public.ceo_imports(entity_id, created_at desc);
create trigger ceo_imports_touch before update on public.ceo_imports
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- RLS — role matrix (Layer 7)
-- =========================================================

-- marketing tables: read incl. marketing + finance; write marketing
-- (venture_ceo also writes strategies — "strategy tracker" is theirs)
do $$
declare t text;
begin
  foreach t in array array['ceo_funnel_entries','ceo_channel_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.ceo_has_entity_role(entity_id, array[''group_ceo'',''admin'',''venture_ceo'',''finance'',''marketing'']))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for all using (public.ceo_has_entity_role(entity_id, array[''marketing''])) with check (public.ceo_has_entity_role(entity_id, array[''marketing'']))',
      t || '_write', t);
  end loop;
end $$;

alter table public.ceo_marketing_strategies enable row level security;
create policy ceo_strategies_select on public.ceo_marketing_strategies
  for select using (public.ceo_has_entity_role(entity_id, array['group_ceo','admin','venture_ceo','finance','marketing']));
create policy ceo_strategies_write on public.ceo_marketing_strategies
  for all using (public.ceo_has_entity_role(entity_id, array['marketing','venture_ceo']))
  with check (public.ceo_has_entity_role(entity_id, array['marketing','venture_ceo']));

-- ops tables: read excl. marketing; write ops
do $$
declare t text;
begin
  foreach t in array array['ceo_staff_happiness','ceo_customer_happiness','ceo_ops_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (public.ceo_has_entity_role(entity_id, array[''group_ceo'',''admin'',''venture_ceo'',''finance'',''ops'']))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for all using (public.ceo_has_entity_role(entity_id, array[''ops''])) with check (public.ceo_has_entity_role(entity_id, array[''ops'']))',
      t || '_write', t);
  end loop;
end $$;

-- KPI board: every role with entity access reads; snapshots written by
-- the evaluator only (service role — no client write policy)
alter table public.ceo_kpi_snapshots enable row level security;
create policy ceo_kpi_snapshots_select on public.ceo_kpi_snapshots
  for select using (public.ceo_has_entity_access(entity_id));

-- red actions: all entity roles read; group_ceo + venture_ceo create/manage,
-- and the assigned owner can update their own action's status
alter table public.ceo_red_actions enable row level security;
create policy ceo_red_actions_select on public.ceo_red_actions
  for select using (public.ceo_has_entity_access(entity_id));
create policy ceo_red_actions_insert on public.ceo_red_actions
  for insert with check (public.ceo_has_entity_role(entity_id, array['group_ceo','venture_ceo']));
create policy ceo_red_actions_update on public.ceo_red_actions
  for update using (
    public.ceo_has_entity_role(entity_id, array['group_ceo','venture_ceo'])
    or owner_id = auth.uid()
  )
  with check (
    public.ceo_has_entity_role(entity_id, array['group_ceo','venture_ceo'])
    or owner_id = auth.uid()
  );
create policy ceo_red_actions_delete on public.ceo_red_actions
  for delete using (public.ceo_has_entity_role(entity_id, array['group_ceo']));

-- imports: finance + admins see their entity's import history; the upload
-- and commit route handlers run on the service role with explicit checks
alter table public.ceo_imports enable row level security;
create policy ceo_imports_select on public.ceo_imports
  for select using (public.ceo_has_entity_role(entity_id, array['group_ceo','admin','venture_ceo','finance']));
