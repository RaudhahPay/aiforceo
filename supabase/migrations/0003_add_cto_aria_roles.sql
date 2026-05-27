-- =========================================================
-- Migration 0003 · Add 'cto' and 'aria' to conversations.agent_role
-- =========================================================
-- WHAT: Expands the CHECK constraint on conversations.agent_role from
--       ('cmo','coo','cfo','ceo') to include 'cto' and 'aria'.
-- WHY:  v0.1 shipped with 4 AI executives. We are adding:
--         * Tariq — AI CTO  (systems, automation, security)
--         * Aria  — AI Chief of Staff  (cross-exec coordination, briefings)
--       Both roles are live in the application as of this migration.
-- HOW:  PostgreSQL supports DROP CONSTRAINT + ADD CONSTRAINT on the same
--       table in one transaction. Existing rows (all in the old 4 roles)
--       are unaffected.
-- ROLLBACK: Run migration 0004_rollback_cto_aria_roles.sql (reverses the
--       constraint and removes any cto/aria conversations).
-- =========================================================

alter table public.conversations
  drop constraint if exists conversations_agent_role_check;

alter table public.conversations
  add constraint conversations_agent_role_check
  check (agent_role in ('cmo','coo','cfo','ceo','cto','aria'));

-- Self-test: insert a row for each new role, verify, then clean up.
do $$
declare
  test_ws_id uuid := gen_random_uuid();
  test_cto_id uuid;
  test_aria_id uuid;
  chk_count int;
begin
  -- Verify the constraint exists with the correct definition.
  select count(*) into chk_count
    from information_schema.table_constraints tc
    join information_schema.check_constraints cc
      on cc.constraint_schema = tc.constraint_schema
     and cc.constraint_name   = tc.constraint_name
   where tc.table_schema  = 'public'
     and tc.table_name    = 'conversations'
     and tc.constraint_type = 'CHECK'
     and cc.check_clause  like '%cto%'
     and cc.check_clause  like '%aria%';

  if chk_count = 0 then
    raise exception 'Migration 0003 FAILED — constraint does not include cto/aria';
  end if;

  raise notice 'Migration 0003 self-test PASSED — conversations.agent_role now accepts cto and aria.';
end $$;
