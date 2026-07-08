# aiforceo (boardroom-ai-v01) — Aria Project State

Updated: 8 July 2026

## Live status
- Product LIVE at https://aiforceo.app (CF Workers via OpenNext), Supabase boardroom-ai (tfduiiiiezpepzhyagwf), migrations 0001-0015 applied.
- NEW: CEO Business Dashboard module started (Stage 3 complete, first Stage 4 brick done).

## CEO Business Dashboard module (8 Jul 2026 session)
Source: Coach's handoff zip (~/Downloads/CEODashboard.zip) — Stage 2 tech architecture + group-overview mockup. Pilot entity Ahmad's HotChicken; rollout Ahmad's -> DRE Coffee -> group.

Done this session (all local, NOT committed):
- docs/ceo-dashboard/ — TECHNICAL-ARCHITECTURE.md + mockup + module CLAUDE.md + BUILD_CHECKLIST.md
- supabase/migrations/0016_ceo_core.sql (entities, roles, RLS helpers, KPI/metric definitions, audit log, seed)
- supabase/migrations/0017_ceo_financial.sql (P&L w/ generated columns, balance sheet w/ balance gate, cashflow, capex, AR/AP + aging views, debts, facilities, group debt service view, finance-only write RLS)
- supabase/migrations/0018_ceo_growth_ops.sql (funnel, strategies + min-10 view, channels, staff/customer happiness, ops metrics, KPI snapshots, red actions, imports, role-matrix RLS)
- src/lib/ceo-dashboard/formulas.ts — pure formula engine (P&L both views, balance check, funnel, traffic light, venture health, strategy rule, 48h escalation)
- tests/ceo-dashboard.formulas.test.ts — 33 tests, all green; pnpm typecheck + lint clean
- .env.example + root CLAUDE.md updated

Key decisions:
- FKs: org_id -> workspaces(id), user_id -> profiles(id); workspace owner = implicit org admin (bootstrap)
- Repo conventions override spec: Next 15 + flat src/, server actions for CRUD, route handlers only for imports/exports/cron
- Coexists with (does not touch) workspace_kpi_months + src/lib/kpi
- Marketing role excluded from P&L/BS RLS; sales headline via dedicated helper (to build)

## GO given 8 Jul 2026 (evening session)
- Coach approved Gate 0 + full plan: docs/ceo-dashboard/CF-AI-GROUP-PLAN.md (dashboard Phase 1 -> CF ai Advisor -> Recommends -> Executes later)
- Migrations 0016-0018 verified APPLIED on prod (ceo_core/ceo_financial/ceo_growth_ops, 22 tables + 4 views, RLS on) — an earlier session applied them
- KPI evaluator (src/lib/ceo-dashboard/evaluator.ts) + full server actions (src/server/actions/ceo.ts, 28 actions) also already written by earlier session
- Fixed typecheck (periods.ts destructure default) + lint (evaluator prefer-const); typecheck/lint/test all green (45 tests)
- Committed Stage 3 + evaluator + actions (local, NOT pushed)
- Supabase advisors: 3 WARNs on ceo_ helper fns are intentional (RLS needs authenticated EXECUTE; fns only reveal caller's own access). Pre-existing ERROR: brain_score SECURITY DEFINER view — fix exists in boss-unified (0035_fix_brain_score_security_invoker) but was never applied to prod; belongs to that thread, flagged to Coach

## Next task
1. Group overview screen /ceo per mockup (Group Pulse strip, red-first cards, red action log)
2. Entity dashboard /ceo/[entityId] — 4 tabs (Financial / S&M / Ops / KPIs) + D/W/M/Q/Y switcher
3. CSV import (papaparse) + ceo-imports bucket + 6 industry seed packs + pg_cron (rollups, 48h escalation) + pilot seed Ahmads HotChicken
4. Then CF ai Phase 2 (Advisor): port AHMAD guardrail lib, KIRA/JUAL/URUS cabinet, Daily Brief, Ask CF ai

## Open questions
- Stage 1 Product Brief not in the zip — need it for full industry metric seed sets
- Which accounting software each venture exports from (CSV templates)
- MFA for group_ceo/admin/finance — confirm auth support
- brain_score SECURITY DEFINER view (boss-unified object) — apply their fix migration or leave to that thread?

## Other repo threads (pre-existing)
- CI auto-deploy blocked on CLOUDFLARE_API_TOKEN in GitHub Secrets
- aiforceo Autonomous Marketing lives in ~/Code/boss-unified branch feat/marketing-phase0 (pushed, not merged)
