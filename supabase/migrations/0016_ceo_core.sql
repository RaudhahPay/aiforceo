-- =========================================================
-- 0016_ceo_core.sql — CEO Business Dashboard module: core
-- Entities, roles, access helpers, metric + KPI definitions,
-- module audit log. Spec: docs/ceo-dashboard/TECHNICAL-ARCHITECTURE.md
-- Additive only.
-- =========================================================

-- =========================================================
-- ceo_entities — a venture under a workspace (org)
-- =========================================================
create table if not exists public.ceo_entities (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.workspaces(id) on delete cascade,
  name           text not null,
  industry_type  text not null default 'other'
                   check (industry_type in ('fnb','education','healthcare','tech_saas','retail_ecommerce','other')),
  currency       char(3) not null default 'MYR',
  is_active      boolean not null default true,
  sort_weight    numeric not null default 0, -- revenue share for group pulse width
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ceo_entities_org_idx on public.ceo_entities(org_id);

-- =========================================================
-- ceo_entity_roles — who can see/do what
-- group_ceo and admin are org-wide (entity_id null); others per entity
-- =========================================================
create table if not exists public.ceo_entity_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  org_id     uuid not null references public.workspaces(id) on delete cascade,
  entity_id  uuid references public.ceo_entities(id) on delete cascade,
  role       text not null check (role in ('group_ceo','venture_ceo','finance','marketing','ops','admin')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint ceo_roles_scope check (
    (role in ('group_ceo','admin') and entity_id is null)
    or (role in ('venture_ceo','finance','marketing','ops') and entity_id is not null)
  ),
  unique (user_id, org_id, entity_id, role)
);
create index if not exists ceo_entity_roles_user_idx on public.ceo_entity_roles(user_id);
create index if not exists ceo_entity_roles_entity_idx on public.ceo_entity_roles(entity_id);

-- =========================================================
-- Access helpers — the single source of RLS truth for ceo_ tables.
-- SECURITY DEFINER + pinned search_path (SOP §5); EXECUTE revoked
-- from public/anon below (Raudhah standard).
-- The workspace owner has implicit org-admin access (bootstrap).
-- =========================================================

create or replace function public.ceo_is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_org_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.ceo_entity_roles r
    where r.user_id = auth.uid() and r.org_id = p_org_id
      and r.entity_id is null and r.role = 'admin'
  );
$$;

-- true if the caller holds ANY of p_roles for the entity
-- (per-entity role, or the same role org-wide, or implicit owner-admin)
create or replace function public.ceo_has_entity_role(p_entity_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ceo_entities e
    join public.ceo_entity_roles r on r.org_id = e.org_id
    where e.id = p_entity_id
      and r.user_id = auth.uid()
      and (r.entity_id = e.id or r.entity_id is null)
      and r.role = any(p_roles)
  ) or (
    'admin' = any(p_roles)
    and exists (
      select 1
      from public.ceo_entities e
      join public.workspaces w on w.id = e.org_id
      where e.id = p_entity_id and w.owner_id = auth.uid()
    )
  );
$$;

-- true if the caller holds any role at all on the entity (read access)
create or replace function public.ceo_has_entity_access(p_entity_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.ceo_has_entity_role(
    p_entity_id,
    array['group_ceo','venture_ceo','finance','marketing','ops','admin']
  );
$$;

revoke execute on function public.ceo_is_org_admin(uuid) from public, anon;
revoke execute on function public.ceo_has_entity_role(uuid, text[]) from public, anon;
revoke execute on function public.ceo_has_entity_access(uuid) from public, anon;
grant execute on function public.ceo_is_org_admin(uuid) to authenticated, service_role;
grant execute on function public.ceo_has_entity_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.ceo_has_entity_access(uuid) to authenticated, service_role;

-- =========================================================
-- updated_at touch trigger for module tables
-- =========================================================
create or replace function public.ceo_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ceo_entities_touch before update on public.ceo_entities
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_metric_definitions — industry ops metric catalog (global)
-- =========================================================
create table if not exists public.ceo_metric_definitions (
  code           text primary key,   -- e.g. fnb_food_cost_pct
  name           text not null,
  industry_type  text not null check (industry_type in ('fnb','education','healthcare','tech_saas','retail_ecommerce','other')),
  unit           text not null default '%',
  direction      text not null default 'higher_better' check (direction in ('higher_better','lower_better')),
  default_target numeric,
  created_at     timestamptz not null default now()
);

-- =========================================================
-- ceo_kpi_definitions — what gets a traffic light
-- entity_id null = group default for that industry
-- =========================================================
create table if not exists public.ceo_kpi_definitions (
  id                    uuid primary key default gen_random_uuid(),
  entity_id             uuid references public.ceo_entities(id) on delete cascade,
  industry_type         text check (industry_type in ('fnb','education','healthcare','tech_saas','retail_ecommerce','other')),
  name                  text not null,
  source_kind           text not null check (source_kind in ('pnl','bs','cashflow','funnel','channel','staff','customer','ops_metric','strategy_count')),
  source_ref            text,       -- column/metric code the evaluator reads
  target                numeric,
  direction             text not null default 'higher_better' check (direction in ('higher_better','lower_better')),
  green_threshold_pct   numeric not null default 100,
  yellow_threshold_pct  numeric not null default 70,
  weight                numeric not null default 1,
  is_critical           boolean not null default false,
  is_active             boolean not null default true,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint ceo_kpi_def_scope check (entity_id is not null or industry_type is not null)
);
create index if not exists ceo_kpi_definitions_entity_idx on public.ceo_kpi_definitions(entity_id);

create trigger ceo_kpi_definitions_touch before update on public.ceo_kpi_definitions
  for each row execute function public.ceo_touch_updated_at();

-- =========================================================
-- ceo_audit_log — module trail for financial writes/imports/exports
-- Written server-side (service role) only.
-- =========================================================
create table if not exists public.ceo_audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id),
  entity_id  uuid references public.ceo_entities(id) on delete set null,
  table_name text not null,
  record_id  uuid,
  action     text not null check (action in ('insert','update','delete','import','export')),
  diff       jsonb,
  at         timestamptz not null default now()
);
create index if not exists ceo_audit_log_entity_idx on public.ceo_audit_log(entity_id, at desc);

-- =========================================================
-- RLS
-- =========================================================
alter table public.ceo_entities enable row level security;
alter table public.ceo_entity_roles enable row level security;
alter table public.ceo_metric_definitions enable row level security;
alter table public.ceo_kpi_definitions enable row level security;
alter table public.ceo_audit_log enable row level security;

-- entities: anyone with a role on the entity reads; org admins manage
create policy ceo_entities_select on public.ceo_entities
  for select using (public.ceo_has_entity_access(id) or public.ceo_is_org_admin(org_id));
create policy ceo_entities_insert on public.ceo_entities
  for insert with check (public.ceo_is_org_admin(org_id));
create policy ceo_entities_update on public.ceo_entities
  for update using (public.ceo_is_org_admin(org_id)) with check (public.ceo_is_org_admin(org_id));
create policy ceo_entities_delete on public.ceo_entities
  for delete using (public.ceo_is_org_admin(org_id));

-- roles: read own rows or org admin; only org admin writes
create policy ceo_entity_roles_select on public.ceo_entity_roles
  for select using (user_id = auth.uid() or public.ceo_is_org_admin(org_id));
create policy ceo_entity_roles_write on public.ceo_entity_roles
  for all using (public.ceo_is_org_admin(org_id)) with check (public.ceo_is_org_admin(org_id));

-- metric catalog: readable by any signed-in user; writes via service role only
create policy ceo_metric_definitions_select on public.ceo_metric_definitions
  for select using (auth.role() = 'authenticated');

-- kpi definitions: industry defaults readable by all; entity rows by entity access.
-- Targets/definitions managed by group_ceo + admin.
create policy ceo_kpi_definitions_select on public.ceo_kpi_definitions
  for select using (entity_id is null or public.ceo_has_entity_access(entity_id));
create policy ceo_kpi_definitions_write on public.ceo_kpi_definitions
  for all
  using (entity_id is not null and public.ceo_has_entity_role(entity_id, array['group_ceo','admin']))
  with check (entity_id is not null and public.ceo_has_entity_role(entity_id, array['group_ceo','admin']));

-- audit log: org execs read; nobody writes from the client
create policy ceo_audit_log_select on public.ceo_audit_log
  for select using (
    entity_id is not null
    and public.ceo_has_entity_role(entity_id, array['group_ceo','admin'])
  );

-- =========================================================
-- Seed — pilot KPI catalog entries (from Layer 5 seed spec).
-- Full industry metric sets come from the Stage 1 brief (open item).
-- =========================================================
insert into public.ceo_metric_definitions (code, name, industry_type, unit, direction, default_target) values
  ('fnb_food_cost_pct',   'Food cost %',            'fnb',        '%',      'lower_better',  30),
  ('fnb_labour_cost_pct', 'Labour cost %',          'fnb',        '%',      'lower_better',  25),
  ('edu_enrolment_pct',   'Enrolment vs capacity',  'education',  '%',      'higher_better', 90),
  ('edu_fee_collection',  'Fee collection %',       'education',  '%',      'higher_better', 90),
  ('hc_occupancy_pct',    'Bed occupancy %',        'healthcare', '%',      'higher_better', 75),
  ('saas_churn_pct',      'Monthly churn %',        'tech_saas',  '%',      'lower_better',  3),
  ('saas_uptime_pct',     'Uptime %',               'tech_saas',  '%',      'higher_better', 99.9),
  ('retail_return_pct',   'Return rate %',          'retail_ecommerce', '%','lower_better',  5),
  ('any_cash_runway_m',   'Cash runway (months)',   'other',      'months', 'higher_better', 6)
on conflict (code) do nothing;
