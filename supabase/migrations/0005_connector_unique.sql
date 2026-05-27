-- Migration 0005: Add unique constraint on connectors(workspace_id, provider).
-- Required for the onConflict upsert used in OAuth callbacks.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connectors_workspace_provider_unique'
      and conrelid = 'public.connectors'::regclass
  ) then
    alter table public.connectors
      add constraint connectors_workspace_provider_unique unique (workspace_id, provider);
  end if;
end$$;
