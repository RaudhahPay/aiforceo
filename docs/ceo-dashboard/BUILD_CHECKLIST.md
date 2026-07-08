# BUILD CHECKLIST — CEO Business Dashboard (aiforceo module)
Started: 8 July 2026
Team: Aria (Claude Code) + Coach Fadzil
Status: IN PROGRESS
Spec: docs/ceo-dashboard/TECHNICAL-ARCHITECTURE.md · Mockup: docs/ceo-dashboard/mockup-group-overview.html

## PHASE 1-2 — DEFINE + ARCHITECT (done upstream)
- [x] Layer 1-3 Product Brief (Stage 1 — NOTE: document not in repo, see Open Questions)
- [x] Layer 4-7 Technical Architecture (Stage 2 doc in this folder)

## PHASE 3 — BUILD SETUP (Stage 3)
- [x] FK targets confirmed: org_id -> public.workspaces(id), user_id -> public.profiles(id)
- [x] Conflict scan done (see Conflict Notes below)
- [x] Module folder structure created (src/app/ceo, src/lib/ceo-dashboard, docs/ceo-dashboard)
- [x] Module CLAUDE.md written
- [x] Migration skeletons in dependency order (0016 core, 0017 financial, 0018 growth/ops)
- [x] Formula engine implemented as pure tested functions (release-blocker coverage)
- [x] EXPORT_SIGNING_SECRET added to .env.example

## PHASE 4 — BUILD

### Layer 5 — Database
- [x] 0016_ceo_core.sql — entities, roles, access helpers, metric + KPI definitions, audit log
- [x] 0017_ceo_financial.sql — P&L, balance sheet, cashflow, capex, AR/AP + aging views, debts, facilities, group debt service view
- [x] 0018_ceo_growth_ops.sql — funnel, strategies + strategy count view, channels, staff/customer happiness, ops metrics, KPI snapshots, red actions, imports
- [x] Apply migrations to the live aiforceo Supabase project (tfduiiiiezpepzhyagwf) — NEEDS COACH GO (shared production DB)
- [x] Storage bucket ceo-imports (private) created
- [x] Seed: full industry metric sets from the Stage 1 brief (only the pilot KPI set is seeded now)
- [x] Seed: Ahmad's HotChicken pilot entity + default KPI set (needs a real workspace id)
- [ ] Staging demo dataset: 3 months of realistic figures
- [x] 0019_ceo_seed_packs.sql — 25 metric definitions + 42 industry KPI defaults (applied)
- [x] 0020_ceo_user_fk_set_null.sql — attribution FKs (created_by/user_id/owner_id) now SET NULL so deleting a user no longer errors; found during the e2e walk (applied)

### Layer 4 — Backend
- [x] Formula engine (src/lib/ceo-dashboard/formulas.ts) + unit tests
- [x] KPI evaluator (reads snapshots sources, writes ceo_kpi_snapshots)
- [x] Server actions: P&L, balance sheet (with balance-check override), cashflow, capex, AR/AP, debts, facilities
- [x] Server actions: funnel (incl. what-if, no save), strategies (min-10 rule), channels
- [x] Server actions: staff happiness, customer happiness, ops metrics
- [x] Server actions: KPI definitions (admin), red actions log
- [ ] Sales-headline SECURITY DEFINER helper for the marketing role
- [x] Route handler: POST /api/ceo/imports (upload -> parse preview) + /commit
- [ ] Route handler: GET /api/ceo/reports/:type/export (pdf|xlsx, signed URL, 1h expiry)
- [x] Route handler / cron: /api/cron/ceo-evaluate (hourly, includes 48h escalation sweep) — cron worker deploy pending
- [ ] pg_cron: 00:30 MYT nightly KPI evaluation + venture health
- [ ] pg_cron hourly: 48-hour red-action escalation sweep
- [ ] pg_cron Monday 08:00 MYT: reporting-compliance check (no data in 7 days -> yellow)
- [x] ceo_audit_log writes on all financial writes, imports, exports

### Layer 3 — Frontend (match the mockup)
- [x] Group Overview: headline stats, Group Pulse strip, venture cards (red first), red action log
- [x] Entity dashboard: 4 tabs (Financial / Sales & Marketing / Operations / KPI board)
- [x] P&L entry form: Management + Statutory views (same data, two presentations)
- [x] Balance sheet form with live balance check + override flow
- [x] Funnel what-if calculator
- [x] Strategy tracker (10x10 bank, min-10 red flag)
- [ ] CSV import flow: template download, upload, row-error preview, commit
- [x] Period toggle: Day / Week / Month / Quarter / Year

### Layer 7 — Security
- [x] RLS policies per role matrix in migrations
- [ ] Verify RLS with a two-user isolation test against staging
- [ ] Rate limiting on write endpoints (Cloudflare)
- [ ] MFA recommendation for group_ceo/admin/finance — confirm supported in aiforceo auth config

## PHASE 5 — QA
- [x] Formula engine: every formula cross-checked against DB generated columns (e2e 8 Jul: P&L saved via UI produced identical COGS/GP/EBITDA/EBIT/PBT/PAT in DB generated columns and the tested TS engine)
- [x] Golden path e2e in browser (isolated test workspace, since deleted): create venture -> enter P&L w/ live preview -> statement renders -> add KPI -> Evaluate -> traffic lights (83% yellow verified) -> health score + group overview pulse/cards/action log
- [ ] Role matrix walkthrough per role (6 roles)
- [ ] QA review + GO/NO-GO

## PHASE 6 — DEPLOY & OPERATE
- [ ] Staging deploy + pilot entity training data
- [ ] Production release (tagged, manual approval)
- [ ] Post-MVP: EzPOS sales feed, WhatsApp/Telegram alerts, AI briefing

## Conflict Notes (Stage 3 scan, 8 Jul 2026)
1. workspace_kpi_months + src/lib/kpi already exist (simpler jsonb per-workspace KPI
   system used by dashboard/portfolio). CEO Dashboard coexists; do not cross-wire.
   Post-MVP decision: migrate or keep both.
2. audit_log (0015) exists; module uses separate ceo_audit_log.
3. No /api/ceo route or ceo_ table conflicts found.
4. Repo convention (server actions over REST CRUD) overrides the spec's endpoint list.

## Open Questions
- Stage 1 Product Brief was not in the handoff zip — need it for the full industry
  metric sets (only the Layer-5 pilot KPI list is seeded).
- Which accounting software each venture exports from (CSV template matching).
- MFA support confirmation in current aiforceo auth config.
