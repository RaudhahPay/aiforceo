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

## Same evening, second sweep (this session, commits 6eea47c / 6ec0940 / 889c8a8)
TWO ARIA SESSIONS worked this repo in parallel; coordinated via session message.
Split: "CEO Dashboard project" session owns ALL of src/app/ceo/ (UI); this session took everything else.

Done by this session:
- Commit 6eea47c: Stage 3 + formulas + evaluator + 28 server actions + docs (as recorded above)
- Commit 6ec0940: 0019_ceo_seed_packs migration (APPLIED to prod — 25 catalog metrics, 42 industry-default KPI defs, idempotent partial unique index); CSV import (papaparse lib, strict ISO dates, row-numbered errors, all-or-nothing; finance-gated POST /api/ceo/import; GET returns header templates); private ceo-imports bucket CREATED in prod; /api/cron/ceo-evaluate (all entities x 5 granularities + 48h escalation sweep) wired into src/cron-worker.ts hourly; PILOT ENTITY Ahmads HotChicken seeded in prod under Coach's own workspace e0942e54 (fadzil@brainybunch.com; re-parent later if a dedicated White Unicorn workspace is made)
- Commit 889c8a8: CF ai Phase 2 library — src/lib/cf-ai/ guardrails (tiers, people/deen force T3, kill-switch, spend cap, allowlist, advisor default, Malay-safe deen scan), analysts KIRA/JUAL/URUS (deterministic, missing-data = reporting finding), brief (composeGroupBrief + revenue-weighted group pulse + narrateBrief w/ deterministic fallback), getGroupBrief server action (owner/group_ceo/admin, audit-logged)
- Gates at each commit: typecheck + lint clean, tests now 69/69

## UI session landed (8 Jul 2026 — the "CEO Dashboard project" session)
ALL /ceo UI DONE, e2e-verified in browser, NOT yet committed (files in working tree):
- src/app/ceo/page.tsx — Group Overview per mockup, live data: headline stats (group sales MTD / cash / debt service / red KPIs), Group Pulse revenue-weighted strip, venture cards sorted red-first w/ worst-KPI flag line, Red KPI Action Log w/ 48h escalation display, empty state
- src/app/ceo/entities/ — Ventures & Roles admin (create/archive ventures, revenue weight, assign 6 roles by email, org-wide vs per-venture scoping)
- src/app/ceo/[entityId]/page.tsx — entity shell: D/W/M/Q/Y toggle + period prev/next + 4 tabs, all data fetched server-side after role check
- tabs/FinancialTab.tsx — P&L statement (Management/Statutory toggle) + entry form w/ live computePnl preview; P&L history; Balance Sheet (two-column, live balance check, override+note flow); Cash Flow (in−out=net + entries); CAPEX; AR + AP w/ aging strips (current/30/60/90/90+); Other Debts; Bank Repayment Table w/ total debt service
- tabs/MarketingTab.tsx — funnel chain (Reach×CR1=Prospects×CR2=Customers×AvgSale×Txn=Sales×GP%=GP−OPEX=EBITDA) as a LIVE what-if calculator + save; 10x10 strategy tracker w/ min-10 red badge + CPA/ROI; 12-channel analytics grid (FB/IG/LinkedIn/TikTok/Threads/Website/SEO/Email/WhatsApp/Telegram/Referral/Alliances) w/ CPL/ROI
- tabs/OperationsTab.tsx — Staff Happiness (aggregates only, PDPA note), Customer Happiness, industry-generic ops metrics w/ inline entry + target coloring
- tabs/KpiTab.tsx — health score + badge + Evaluate now; traffic-light board (red-first) w/ attainment bars; red-action logging (owner + deadline); KPI definitions manager
- src/app/ceo/_components/ui.tsx shared primitives; Sidebar "CEO Dashboard" link (active key ceo-dashboard)
- papaparse + @types/papaparse installed (their import route needed it); typecheck fix in their tests/ceo-dashboard.import.test.ts
- 0020_ceo_user_fk_set_null.sql WRITTEN + APPLIED to prod: ceo_ attribution FKs to profiles now ON DELETE SET NULL (user deletion was blocked by ceo_audit_log; found in e2e). ceo_entity_roles.user_id stays CASCADE
- E2E (isolated test user+workspace, both deleted after): venture create → P&L entry w/ live preview → statement + DB generated columns EXACT match to formula engine (COGS 30000/GP 70000/EBITDA 29000/EBIT 27500/26500/PBT 25000/PAT 22000) → KPI add → Evaluate → 83% YELLOW correct → health + group overview all live. Funnel what-if verified (90K sales / 18.5K EBITDA). Gates: typecheck/lint/tests 51 at the time (69 after their commits), build compiles all /ceo routes
- NOTE: pilot entity duplicated — this session seeded Ahmad's HotChicken + 11 KPI defs under Coach's beforeb76@gmail.com workspace (cbda7fab), the other session seeded it under fadzil@brainybunch.com (e0942e54). Both are real; Coach to say which account he uses for the group view, then delete the other.

## UI COMMITTED (3836762, local, not pushed)
Per cross-session coordination + Coach's GO: full /ceo UI + Sidebar link + 0020 FK-fix
migration landed as commit 3836762 (13 files, ~6.9k lines). Gates at commit: typecheck
clean, 69/69 tests. Working tree is now clean for the CF-ai session to deploy safely.

## DEPLOYED TO PRODUCTION (8 Jul 2026, Coach said deploy)
- Main app: boardroom-ai worker, version 8a8720ea — https://aiforceo.app (CEO Dashboard live at /ceo)
- Cron worker: boardroom-ai-cron, version 345323ae, schedule 0 * * * * (hourly KPI evaluate + 48h escalation sweep)
- Verified live: home 200, /ceo logged-out -> 307 /login?next=/ceo, login 200, cron endpoint 401 without secret
- Commits deployed: 6eea47c..2bccb4d (still LOCAL only — not pushed to remote)

## HQ FIX DEPLOYED (8 Jul, after Coach saw "WAROBOT" header)
- Root cause: /ceo followed the SELECTED workspace (getCurrentWorkspace) — Coach was on
  WAROBOT (0 ventures) while the pilot lives in White Unicorn Ventures HQ. Fixed with
  resolveGroupHq (access.ts): among workspaces the user owns/has ceo roles in, pick the
  one with most active ventures; fallback = selected workspace. Applied to /ceo,
  /ceo/entities, createEntity, assignRole. Commit cf89900, deployed c26ef4bf, verified
  with a 2-workspace test user (deleted). NOTE for CF-ai session: the CF ai brief page
  still scopes by getCurrentWorkspace — apply resolveGroupHq there too.

## AHMAD FEED CONNECTION LIVE (8 Jul, Coach: "build a connection to Ahmads Ai CEO")
- POST /api/ceo/feed (commit faffc12, deployed efdcdef5): HMAC-signed venture data
  ingestion — daily P&L partial merge + auto MTD monthly rollup + ops metrics
  (daily + monthly buckets) + audit log. CEO_FEED_SECRET set on the worker
  (value also in boardroom .env.local + ahmad-ai-ceo .env.local).
- MIDDLEWARE FIX: /api/ceo/feed AND /api/cron/ceo-evaluate added to PUBLIC_PATHS —
  the session gate was silently 401-ing the hourly cron (CF-ai session: your cron
  never ran against prod until this deploy).
- AHMAD side (~/Code/ahmad-ai-ceo, UNCOMMITTED — needs Coach commit go):
  connectors/ceo-feed.ts (HMAC push, fail-open), wired into runLoop post-ingest,
  CLI pnpm agents:report-ceo [date], env contract in .env.example, .env.local
  configured (URL + secret + entity 90128463 Ahmads HotChicken).
- E2E PROVEN on prod: mock day pushed to 2026-01-15 (RM 54k + 4 food-cost metrics,
  daily row + monthly rollup + per-outlet/All-outlets ops metrics all verified in
  DB, notes tagged feed:ahmad-ai-ceo-mock) then deleted. Audit row retained.
- HONEST LIMIT: AHMAD is unprovisioned (no Supabase, mock POS). The pipe carries
  REAL data only after AHMAD gets its Supabase + a real POS/sales-sheet adapter.

## Deploy 162541a6 (8 Jul, later)
Shipped the CF-ai session's sidebar rename (old "Dashboard" -> "Business KPIs",
commit cd4e0e3) live; tree was clean (feed work committed as faffc12/6353b95).

## Next task
1. (CF-ai session) Daily Brief panel + Ask CF ai on /ceo — tree is clear
2. Coach: log in at aiforceo.app -> sidebar "CEO Dashboard" -> enter real Ahmads numbers
3. Coach: pick group HQ account (beforeb76 vs fadzil@brainybunch) so the duplicate pilot entity can be deleted; say "push" to push main
2. CF ai UI: Daily Brief panel on /ceo + Ask CF ai (grounded chat) — AFTER the UI session lands, to avoid collisions
3. Deploy: main app (new routes/actions) + cron worker redeploy (pnpm wrangler deploy --config wrangler-cron.jsonc) — do NOT deploy while the UI session has uncommitted files in the tree
4. Coach enters real Ahmads numbers (or finance CSV import) → first real Daily Brief
5. Phase 3 per CF-AI-GROUP-PLAN.md: recommendations + approval console + weekly board pack

## Open questions
- Stage 1 Product Brief not in the zip — need it for full industry metric seed sets
- Which accounting software each venture exports from (CSV templates)
- MFA for group_ceo/admin/finance — confirm auth support
- brain_score SECURITY DEFINER view (boss-unified object) — apply their fix migration or leave to that thread?

## Other repo threads (pre-existing)
- CI auto-deploy blocked on CLOUDFLARE_API_TOKEN in GitHub Secrets
- aiforceo Autonomous Marketing lives in ~/Code/boss-unified branch feat/marketing-phase0 (pushed, not merged)

## CF ai IS NOW TALKABLE (8 Jul 2026, this session, commit 1611108, deployed 53a51e15)
- /ceo/cf-ai LIVE on aiforceo.app: Today's Brief (AI narrative, ANTHROPIC_API_KEY confirmed set on worker), group pulse / cash / ventures stats, top priorities, cabinet findings per venture, Ask CF ai chat (grounded only in fresh brief data, advisor-mode persona, audit-logged, org-admin/owner/group_ceo gated)
- Gold "Talk to CF ai" button on /ceo header
- Verified live: route 307s to login when unauthenticated; build/typecheck/lint/tests 69 all green
- Commits on main NOT pushed: 6eea47c, 6ec0940, 889c8a8, 2bccb4d, 1611108 (+ this STATE update)

## HQ DECISION EXECUTED (8 Jul 2026, Coach said "HQ")
- Workspace e0942e54 (fadzil@brainybunch.com) RENAMED "Ahmads HotChicken" -> "White Unicorn Ventures HQ" — the one group org; all ventures go under it
- Duplicate pilot entity b13c6abb (beforeb76's workspace cbda7fab) DELETED (had only 11 auto KPI defs, zero data; cascade cleaned them)
- Single source of truth now: entity 90128463 "Ahmads HotChicken" (fnb) under HQ; F&B industry-default KPI defs apply automatically
- WHY COACH SAW "WAROBOT — CEO Command Center": /ceo is workspace-scoped via ai4c_active_ws cookie (last-used workspace). He must switch workspace to White Unicorn Ventures HQ at /workspaces

## v2 TOPOLOGY LOCKED (8 Jul 2026 — Coach: "AI CEOs live independently, aiforceo is just the reporting dashboard")
- Plan updated: docs/ceo-dashboard/CF-AI-GROUP-PLAN.md §7 (federation: independent AI CEO apps per venture on the AHMAD template -> HMAC feed -> one dashboard; standalone CF ai app reads via group-brief API; migration without demolition)
- WRITE seam: /api/ceo/feed (other session, faffc12) + AHMAD's ceo-feed connector (AHMAD session) — contract verified matching (hex HMAC x-feed-signature; entity_id/source/date/pnl/ops_metrics; sen->RM; fail-open)
- READ seam: GET /api/ceo/group-brief SHIPPED this session (783d2c2, deployed f3359623, verified 401 unauth): Bearer CEO_BRIEF_SECRET, auto-resolves HQ org, returns composeGroupBrief JSON, audit-logged; .env.example updated
- Sidebar rename Dashboard->Business KPIs deployed by other session (d81b612)
- NEXT (Phase B, needs Coach go): scaffold standalone CF ai app (fork AHMAD architecture, repo RaudhahPay/cf-ai, lift src/lib/cf-ai wholesale, poll read seam, own chat + WhatsApp via WaroBot later); generate CEO_BRIEF_SECRET when it exists. Before venture #2: per-entity feed keys (single CEO_FEED_SECRET is a one-key-writes-all risk, flagged in plan)
