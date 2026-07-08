-- =========================================================
-- 0020_ceo_user_fk_set_null.sql — CEO Dashboard fix.
-- All ceo_ references to profiles(id) (created_by / user_id /
-- owner_id attribution columns) must not BLOCK user deletion —
-- found when a deleted account was rejected by ceo_audit_log's
-- default RESTRICT FK. Attribution outlives the account: SET NULL.
-- (ceo_entity_roles.user_id keeps ON DELETE CASCADE from 0016 —
-- a deleted user's roles should vanish, not linger as nulls.)
-- =========================================================

do $$
declare
  r record;
begin
  for r in
    select tc.table_name, tc.constraint_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
    where tc.table_schema = 'public'
      and tc.constraint_type = 'FOREIGN KEY'
      and tc.table_name like 'ceo\_%' escape '\'
      and ccu.table_name = 'profiles'
      and kcu.column_name in ('created_by', 'user_id', 'owner_id')
      and not (tc.table_name = 'ceo_entity_roles' and kcu.column_name = 'user_id')
  loop
    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.table_name, r.constraint_name, r.column_name);
  end loop;
end $$;
