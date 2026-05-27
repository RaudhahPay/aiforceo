# Runbook · Boardroom AI

How to operate, observe, and recover the system. Per SOP §10 + §13.

## Daily
- Cloudflare → Workers & Pages → boardroom-ai → Analytics — check request volume, error rate
- Supabase → Reports → check error rate and slow query log
- Anthropic console → Usage → confirm daily spend within projection (alert if > 1.3× projection)
- Stripe → Dashboard → confirm no failed webhook attempts in last 24h

## Common operational tasks

### Manual token grant for a workspace (support case)
```sql
-- Supabase SQL editor; run with care.
insert into public.credit_ledger (workspace_id, delta_tokens, reason)
values ('<workspace-id>', 100000, 'manual_grant');
```

### Promote workspace tier without Stripe (founding-member comp)
```sql
update public.workspaces
   set tier = 'growth', monthly_token_quota = 2000000
 where id = '<workspace-id>';
```

### Force-delete a workspace and its data (right-to-be-forgotten)
```sql
-- Cascade deletes everything via foreign keys.
delete from public.workspaces where id = '<workspace-id>';
-- Then: Anthropic deletion request via support email (manual at v0.1).
-- Then: Stripe customer.delete via Stripe dashboard.
```

## Incident response (SOP §13)
1. **Named human leads.** AI diagnoses; CEO owns the response.
2. **Contain first.** Roll back Cloudflare deploy via `wrangler` or dashboard. If a secret leaked: rotate it before anything else.
3. **Communicate.** If user data is affected, email the cohort honestly within 24h.
4. **Root cause + post-mortem.** Blameless write-up filed at `docs/incidents/YYYY-MM-DD-<slug>.md`.
5. **Prevent recurrence.** Post-mortem produces a concrete change — new check, new test, new SOP line.

## Known gaps (close before launch)
- [ ] Email transactional service (Resend) not yet wired
- [ ] No automated daily cost report (manual check until v0.2)
- [ ] No PostHog product analytics
- [ ] Connector OAuth UI is placeholder only

## Rollback
- `wrangler pages deployment list --project-name=boardroom-ai`
- `wrangler pages deployment retry <id>` for known-good deploy
- Supabase PITR (Pro plan): 7-day recovery window
