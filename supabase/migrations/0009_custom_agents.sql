-- =========================================================
-- Migration 0009 · Custom Agent Builder
-- =========================================================
-- WHAT:
--   * Adds custom_agents table so workspace owners can create
--     additional AI executives beyond the default 6.
--   * Relaxes conversations.agent_role CHECK constraint to allow
--     custom agent IDs (UUIDs) alongside the built-in roles.
--   * Adds starred column to messages for saved outputs.
--   * Adds full-text search index on messages for conversation search.
--
-- ROLLBACK:
--   * DROP TABLE public.custom_agents;
--   * ALTER TABLE public.conversations DROP CONSTRAINT ...;
--   * ALTER TABLE public.messages DROP COLUMN starred;
--   * DROP INDEX messages_fts_idx;
-- =========================================================

-- ── Custom agents ──────────────────────────────────────────
create table if not exists public.custom_agents (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  name          text        not null,
  title         text        not null default 'AI Specialist',
  description   text        not null default '',
  system_prompt text        not null,
  gradient_from text        not null default '#6366F1',
  gradient_to   text        not null default '#8B5CF6',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists custom_agents_ws_idx
  on public.custom_agents (workspace_id);

alter table public.custom_agents enable row level security;

drop policy if exists custom_agents_owner_all on public.custom_agents;
create policy custom_agents_owner_all on public.custom_agents
  for all using (public.is_owner(workspace_id))
  with check (public.is_owner(workspace_id));

-- ── Relax conversations.agent_role to allow custom agent UUIDs ──
alter table public.conversations
  drop constraint if exists conversations_agent_role_check;

alter table public.conversations
  add constraint conversations_agent_role_check
  check (agent_role ~ '^[a-z]{2,5}$' or agent_role ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- ── Starred messages (saved outputs) ──────────────────────
alter table public.messages
  add column if not exists starred boolean not null default false;

create index if not exists messages_starred_idx
  on public.messages (workspace_id, starred) where starred = true;

-- ── Full-text search index on messages ────────────────────
-- Uses PostgreSQL's tsvector for fast full-text search across conversation content.
alter table public.messages
  add column if not exists content_tsv tsvector
    generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists messages_fts_idx
  on public.messages using gin(content_tsv);

-- Self-test
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'custom_agents'
  ) then
    raise exception 'Migration 0009 FAILED — custom_agents table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'starred'
  ) then
    raise exception 'Migration 0009 FAILED — starred column missing from messages';
  end if;
  raise notice 'Migration 0009 PASSED — custom agents, starred messages, FTS ready.';
end $$;
