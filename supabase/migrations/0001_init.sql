-- =========================================================
-- Migration 0001 · Boardroom AI initial schema
-- =========================================================
-- WHAT this migration does:
--   * Creates the v0.1 data model: profiles, workspaces, business_profiles,
--     brand_voice, financial_snapshots, connectors, conversations, messages,
--     credit_ledger.
--   * Sets RLS on every workspace-scoped table.
--   * Defines three SECURITY DEFINER helper functions with PINNED search_path
--     per SOP §5 (prevents search_path attacks):
--        - handle_new_user()
--        - is_owner(p_workspace_id uuid)
--        - tokens_remaining(p_workspace_id uuid)
--   * Includes a self-test block at the end that verifies RLS is on for every
--     table created here and that the helper functions exist with pinned
--     search_path. The migration FAILS if any check fails.
--
-- WHY this shape:
--   * One workspace per user at v0.1 (D-009), but schema supports many.
--   * Append-only credit ledger so usage is auditable and unambiguous.
--   * Helper is_owner() centralizes the RLS predicate so policies stay
--     uniform across tables.
--
-- WHAT WAS DELIBERATELY NOT INCLUDED:
--   * pgvector (D-007) — context lives in the system prompt for v0.1.
--   * Storage policies — no file uploads in v0.1.
--   * Multi-seat / team RBAC — single owner per workspace.
--
-- ROLLBACK:
--   * Additive only. To revert, write a follow-up migration that drops
--     these tables — but only after CEO sign-off per SOP §8.
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- profiles (1:1 with auth.users)
-- =========================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public          -- SOP §5: pinned search_path
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- workspaces (a business that gets a customized C-suite)
-- =========================================================
create table if not exists public.workspaces (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references public.profiles(id) on delete cascade,
  name                     text not null,
  slug                     text unique,
  tier                     text not null default 'trial'
                                  check (tier in ('trial','starter','growth','scale')),
  setup_fee_paid           boolean not null default false,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  monthly_token_quota      bigint not null default 100000,
  onboarded                boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);

-- =========================================================
-- is_owner() — the single source of RLS truth.
-- Marked SECURITY DEFINER so the policy check itself can run regardless
-- of the calling user's other grants, but pinned search_path so it
-- cannot be tricked into reading a shadow table in another schema.
-- =========================================================
create or replace function public.is_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public          -- SOP §5: pinned search_path
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  );
$$;

-- =========================================================
-- business_profiles
-- =========================================================
create table if not exists public.business_profiles (
  workspace_id    uuid primary key references public.workspaces(id) on delete cascade,
  industry        text,
  size            text,
  revenue_range   text,
  primary_offer   text,
  target_customer text,
  challenges      text[],
  goals_90d       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =========================================================
-- brand_voice
-- =========================================================
create table if not exists public.brand_voice (
  workspace_id      uuid primary key references public.workspaces(id) on delete cascade,
  source_text       text,
  voice_summary     text,
  tone_attributes   text[],
  words_to_use      text[],
  words_to_avoid    text[],
  reading_level     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =========================================================
-- financial_snapshots
-- =========================================================
create table if not exists public.financial_snapshots (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  period        text,
  revenue       numeric,
  cogs          numeric,
  opex          numeric,
  net_profit    numeric,
  cash_on_hand  numeric,
  raw_text      text,
  ai_analysis   text,
  created_at    timestamptz not null default now()
);
create index if not exists fin_snap_ws_idx on public.financial_snapshots(workspace_id, created_at desc);

-- =========================================================
-- connectors (placeholder for v0.1)
-- =========================================================
create table if not exists public.connectors (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  provider      text not null,
  status        text not null default 'pending',
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists connectors_ws_idx on public.connectors(workspace_id);

-- =========================================================
-- conversations
-- =========================================================
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  agent_role    text not null check (agent_role in ('cmo','coo','cfo','ceo')),
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists conversations_ws_idx on public.conversations(workspace_id, updated_at desc);

-- =========================================================
-- messages
-- =========================================================
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system','tool')),
  content         text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  model           text,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- =========================================================
-- credit_ledger (append-only)
-- =========================================================
create table if not exists public.credit_ledger (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  delta_tokens      bigint not null,
  reason            text not null,
  message_id        uuid references public.messages(id) on delete set null,
  stripe_invoice_id text,
  created_at        timestamptz not null default now()
);
create index if not exists credit_ws_idx on public.credit_ledger(workspace_id, created_at desc);

-- =========================================================
-- tokens_remaining() — sums the ledger for the current calendar month.
-- =========================================================
create or replace function public.tokens_remaining(p_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public          -- SOP §5: pinned search_path
as $$
  select coalesce(sum(delta_tokens), 0)
  from public.credit_ledger
  where workspace_id = p_workspace_id
    and created_at >= date_trunc('month', now());
$$;

-- =========================================================
-- ROW-LEVEL SECURITY
-- =========================================================
alter table public.profiles            enable row level security;
alter table public.workspaces          enable row level security;
alter table public.business_profiles   enable row level security;
alter table public.brand_voice         enable row level security;
alter table public.financial_snapshots enable row level security;
alter table public.connectors          enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.credit_ledger       enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

drop policy if exists workspaces_owner_all on public.workspaces;
create policy workspaces_owner_all on public.workspaces
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists business_profiles_owner_all on public.business_profiles;
create policy business_profiles_owner_all on public.business_profiles
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists brand_voice_owner_all on public.brand_voice;
create policy brand_voice_owner_all on public.brand_voice
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists financial_snapshots_owner_all on public.financial_snapshots;
create policy financial_snapshots_owner_all on public.financial_snapshots
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists connectors_owner_all on public.connectors;
create policy connectors_owner_all on public.connectors
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists conversations_owner_all on public.conversations;
create policy conversations_owner_all on public.conversations
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists messages_owner_all on public.messages;
create policy messages_owner_all on public.messages
  for all using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

drop policy if exists credit_ledger_owner_select on public.credit_ledger;
create policy credit_ledger_owner_select on public.credit_ledger
  for select using (public.is_owner(workspace_id));
-- Writes to credit_ledger happen via service role only.

-- =========================================================
-- POST-APPLY MANUAL STEPS (do once in Supabase dashboard)
-- =========================================================
-- 1. Authentication → Providers → Email → "Confirm email" ON, "Secure email
--    change" ON.
-- 2. Authentication → Policies → "Leaked password protection" ON.
-- 3. Database → Roles → confirm `authenticated` role has no direct INSERT/
--    UPDATE/DELETE grants — writes must come from service role only.

-- =========================================================
-- SELF-TEST — fails the migration if anything is misconfigured.
-- Per SOP §8: "Verify after applying."
-- =========================================================
do $$
declare
  expected_tables text[] := array[
    'profiles','workspaces','business_profiles','brand_voice',
    'financial_snapshots','connectors','conversations','messages','credit_ledger'
  ];
  t text;
  has_rls boolean;
  fn_count int;
begin
  -- 1. Every expected table exists AND has RLS enabled.
  foreach t in array expected_tables loop
    select c.relrowsecurity into has_rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t;
    if not coalesce(has_rls, false) then
      raise exception 'RLS check FAILED for public.%', t;
    end if;
  end loop;

  -- 2. Helper functions exist with pinned search_path.
  select count(*) into fn_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('handle_new_user','is_owner','tokens_remaining')
     and exists (
       select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
       where cfg like 'search_path=%'
     );
  if fn_count < 3 then
    raise exception 'Helper-function search_path pin check FAILED (% of 3 OK)', fn_count;
  end if;

  raise notice 'Migration 0001 self-test PASSED.';
end $$;
