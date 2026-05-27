# Pre-Ship Checklist · Boardroom AI

Run row-by-row before any production deploy. Per SOP §14.3.

- [ ] `pnpm typecheck` clean (no `any` to paper over real errors)
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] Every write reviewed against `src/lib/auth/require.ts` gating + admin client (SOP §4.2)
- [ ] All inputs zod-validated; security-relevant values re-derived server-side
- [ ] No secret committed (grep for `sk-ant-`, `sk_live`, `service_role`)
- [ ] New tables have RLS; PII is scoped via `is_owner()`, not `using (true)`
- [ ] DB migrations applied to staging; verified via `select schemaname, tablename, rowsecurity from pg_tables` and Supabase Advisor
- [ ] No half-wired feature — every added column has the UI that uses it
- [ ] Mobile responsive — landing, login, onboarding, dashboard, chat all tested at 375px width
- [ ] Deployed to Cloudflare preview env; smoke test the magic-link → onboarding → chat → checkout happy path
- [ ] `docs/RUNBOOK.md` updated with any new operational concerns
- [ ] `docs/DECISION_LOG.md` updated with any non-obvious decision made during this release
- [ ] CEO sign-off in the PR thread before merging to `main`
