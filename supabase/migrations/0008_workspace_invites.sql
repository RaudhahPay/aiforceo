-- =========================================================
-- Migration 0008 · Workspace invites (Team Seats)
-- =========================================================
-- WHAT: Adds workspace_invites table so workspace owners can
--   invite team members by email. Each invite has a unique
--   token that the recipient uses to accept.
--
-- v0.1 of Team Seats: invite-by-email only. Full RBAC and
--   workspace_members table is Phase 3.
--
-- ROLLBACK: DROP TABLE public.workspace_invites;
-- =========================================================

create table if not exists public.workspace_invites (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'member'
                              check (role in ('member', 'manager')),
  token        text        unique not null default gen_random_uuid()::text,
  invited_by   uuid        not null references public.profiles(id),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days')
);

create index if not exists workspace_invites_ws_idx  on public.workspace_invites (workspace_id);
create index if not exists workspace_invites_tok_idx on public.workspace_invites (token);

alter table public.workspace_invites enable row level security;

-- Owner can see and manage invites for their workspaces
drop policy if exists workspace_invites_owner_all on public.workspace_invites;
create policy workspace_invites_owner_all on public.workspace_invites
  for all using (public.is_owner(workspace_id))
  with check (public.is_owner(workspace_id));

-- Self-test
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspace_invites'
  ) then
    raise exception 'Migration 0008 FAILED — workspace_invites table missing';
  end if;
  raise notice 'Migration 0008 PASSED — workspace invites ready.';
end $$;
