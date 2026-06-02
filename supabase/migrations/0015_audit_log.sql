create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  actor_id      uuid,           -- user who triggered it (null = system/agent)
  actor_type    text not null default 'user'
                check (actor_type in ('user', 'agent', 'system')),
  agent_role    text,           -- which AI agent (if actor_type = 'agent')
  action        text not null,  -- e.g. 'kpi.update', 'task.create', 'task.status_change'
  entity_type   text,           -- 'kpi', 'task', 'conversation', 'workspace', 'memory'
  entity_id     text,           -- id of the affected record
  summary       text not null,  -- human-readable: "Aria updated April 2026 KPIs: revenue RM 43,154"
  metadata      jsonb default '{}'::jsonb,  -- extra context (old value, new value, etc.)
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_ws_idx on public.audit_log(workspace_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log(workspace_id, action, created_at desc);

-- Append-only: no UPDATE or DELETE allowed on audit_log
alter table public.audit_log enable row level security;
create policy audit_log_owner_select on public.audit_log
  for select using (public.is_owner(workspace_id));
-- No insert policy via RLS — only service role (admin client) can write
