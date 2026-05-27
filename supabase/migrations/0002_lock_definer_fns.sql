-- =========================================================
-- Migration 0002 · Lock down SECURITY DEFINER functions
-- =========================================================
-- WHAT: revoke EXECUTE on handle_new_user, is_owner, tokens_remaining
--       from the public-facing roles (anon, authenticated, public).
-- WHY:  Supabase security advisor flagged these as exposed via
--       /rest/v1/rpc/<fn>. We only ever call them:
--         * handle_new_user — from the auth.users INSERT trigger
--         * is_owner       — internally from RLS policies (the planner
--                            evaluates these as the table owner regardless
--                            of caller grants, so revoking EXECUTE does
--                            not break RLS)
--         * tokens_remaining — from src/lib/credits.ts via the service
--           role admin client, which bypasses all role-based EXECUTE checks
--       Removing the public RPC surface area follows SOP §5's "PII scoped
--       to owner-or-staff" intent for RPC too.
-- DELIBERATELY NOT CHANGED: the function bodies, the search_path pins,
-- the SECURITY DEFINER attribute. Only the EXECUTE grant.
-- ROLLBACK: write a follow-up migration that re-grants EXECUTE.
-- =========================================================

revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.is_owner(uuid)         from public, anon, authenticated;
revoke execute on function public.tokens_remaining(uuid) from public, anon, authenticated;

-- Self-test: confirm the revokes landed.
do $$
declare
  has_grant int;
begin
  select count(*) into has_grant
    from information_schema.routine_privileges
   where routine_schema = 'public'
     and routine_name in ('handle_new_user','is_owner','tokens_remaining')
     and grantee in ('anon','authenticated','PUBLIC');
  if has_grant > 0 then
    raise exception 'EXECUTE revoke FAILED — % residual grants remain', has_grant;
  end if;
  raise notice 'Migration 0002 self-test PASSED — definer fns are server-only.';
end $$;
