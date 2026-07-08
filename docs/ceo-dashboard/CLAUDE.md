# CEO Business Dashboard — Module Guide

Read this before touching anything under the CEO Dashboard module. It supplements
the root CLAUDE.md; where the two disagree on module matters, this file wins.

## What this module is

The group CEO command center for White Unicorn Ventures inside aiforceo. Multi-entity
(venture) financial + marketing + operations dashboard with a KPI traffic-light engine,
venture health scores, and a red-KPI action log with 48-hour escalation.
Pilot entity: Ahmad's HotChicken. Rollout: Ahmad's -> DRE Coffee -> group-wide.

Source spec: docs/ceo-dashboard/TECHNICAL-ARCHITECTURE.md (Stage 2, Layers 4-7).
Visual reference: docs/ceo-dashboard/mockup-group-overview.html (dark ink + gold,
Archivo + Spline Sans Mono, green/amber/red traffic lights).

## Where the module lives

- src/app/ceo/                 — all screens (group overview, entity dashboard tabs)
- src/app/api/ceo/             — route handlers ONLY where server actions cannot work
                                 (CSV import upload, report export, cron evaluate)
- src/lib/ceo-dashboard/       — formula engine, KPI evaluator, CSV parsers, exports
- supabase/migrations/00NN_ceo_*.sql — all module tables, prefixed ceo_
- tests/ceo-dashboard.*.test.ts — formula engine tests (MANDATORY, release blocker)

## Adaptations from the Stage 2 spec (decided at Stage 3, 8 Jul 2026)

1. The spec said Next.js 14 + @cloudflare/next-on-pages and apps/web/ + packages/
   monorepo paths. The live repo is Next.js 15 + @opennextjs/cloudflare and flat
   src/. Module follows the repo, not the spec.
2. The spec listed REST endpoints for all CRUD. The repo convention is server
   actions for writes (admin client after requireUser/role check) and RLS-respecting
   server components for reads. Follow the repo convention; keep route handlers only
   for imports, exports, and cron — same trust model as the existing exceptions.
3. org_id FK target confirmed: public.workspaces(id). user_id FK target confirmed:
   public.profiles(id) (1:1 with auth.users).
4. aiforceo already has workspace_kpi_months (jsonb monthly KPIs) + src/lib/kpi
   (rollup engine + benchmarks). DO NOT extend those for this module and do not
   duplicate their logic into it. The CEO Dashboard is its own structured system
   (ceo_ tables). A post-MVP decision will reconcile the two.
5. Repo already has audit_log (0015). The module uses its own ceo_audit_log for
   financial write/import/export trails — do not mix the two.

## Non-negotiable rules

- Every P&L, funnel, traffic-light, and health-score formula lives in
  src/lib/ceo-dashboard/formulas.ts as a pure function with test coverage.
  DB generated columns must match these formulas exactly. A formula change without
  a matching test change is a release blocker.
- All money numeric(14,2). Currency per entity, MYR default.
- RLS on every ceo_ table keyed on ceo_entity_roles; the workspace owner has
  implicit org-admin access. No client-side-only checks. Never trust entity_id
  from a client payload — re-derive access server-side.
- Separation of duty: group_ceo reads everything but cannot edit raw financial
  entries. finance enters financials. marketing must not read full P&L (sales
  headline only — enforced by excluding marketing from pnl/balance-sheet RLS and
  serving the headline through a SECURITY DEFINER helper).
- All SECURITY DEFINER functions: pinned search_path = public AND
  revoke execute from public, anon (SOP §5 + Raudhah standard).
- Staff happiness: aggregates only. Individual survey responses never enter this
  database (PDPA).
- Balance-sheet saves that do not balance require override_unbalanced = true plus
  a note, and are audit-logged.
- CSV imports: 10 MB cap, 50k row cap, strip leading = + - @ in text cells
  (formula injection), full row-level error preview before commit.

## Traffic-light + health rules (canonical)

- attainment = actual / target (higher_better) or target / actual (lower_better)
- green >= green_threshold_pct (default 100), yellow >= yellow_threshold_pct
  (default 70), else red. Thresholds configurable per KPI.
- Venture health = weight-averaged attainment across the entity's KPIs; badge
  shows the WORST of (score band, any red critical KPI).
- Fewer than 10 active marketing strategies for an entity = automatic red
  marketing KPI (ceo_strategy_count view feeds this).
- Every red KPI gets an owner + action + deadline (ceo_red_actions); reds
  untouched for 48h are escalated by the hourly sweep and surfaced group-wide.

## Build order

Work through docs/ceo-dashboard/BUILD_CHECKLIST.md top to bottom. Migrations are
already skeletoned in dependency order: 0016 core -> 0017 financial -> 0018
growth/ops. Commit at the end of every layer.
