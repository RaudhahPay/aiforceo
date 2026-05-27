-- =========================================================
-- Migration 0004 · Add is_admin flag to profiles
-- =========================================================
-- WHAT: Adds is_admin boolean (default false) to profiles.
-- WHY:  Powers the /admin panel — only accounts with is_admin=true
--       can access the admin CRM, token usage, and API settings.
-- HOW:  Set via Supabase SQL editor manually per SOP §4.2 (no bulk
--       grant from client side; admin client + service role only).
-- ROLLBACK: drop column public.profiles.is_admin
-- =========================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;
create index if not exists profiles_admin_idx on public.profiles(is_admin) where is_admin = true;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='is_admin'
  ) then
    raise exception 'Migration 0004 FAILED — is_admin column missing';
  end if;
  raise notice 'Migration 0004 PASSED — profiles.is_admin added.';
end $$;
