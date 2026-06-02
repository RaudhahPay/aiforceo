-- Phase 5: CEO Task Manager
-- Stores action items surfaced by AI agents or created manually by the CEO.

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  title         text not null,
  description   text,
  type          text not null default 'action'
                check (type in ('approval', 'review', 'follow-up', 'alert', 'action')),
  status        text not null default 'open'
                check (status in ('open', 'in_progress', 'done', 'dismissed')),
  priority      integer not null default 2 check (priority between 1 and 3), -- 1=low, 2=medium, 3=high
  source_agent  text,           -- which agent created this task
  source_msg_id uuid,           -- linked message
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_ws_idx on public.tasks(workspace_id, status, priority desc, created_at desc);

alter table public.tasks enable row level security;

create policy tasks_owner_all on public.tasks
  for all using (public.is_owner(workspace_id))
  with check (public.is_owner(workspace_id));
