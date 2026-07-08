# CF ai — Group CEO Dashboard + AI CEO of the Group

Date: 8 July 2026
Status: PLAN (approved scope pending Coach's go)
Owner: Aria
Home: this repo (boardroom-ai-v01 / aiforceo), CEO Dashboard module

## 1. What Coach asked for

A Group CEO Dashboard covering the three things a CEO must know, plus an AI CEO
for the whole group named CF ai (Coach Fadzil, the AI version), learning from
AHMAD (the AI CEO built for Ahmads HotChicken).

1. Financial Statement — P&L, Balance Sheet, CAPEX, AR/AP, other debts,
   bank repayment table, cash flow. Daily/weekly/monthly/quarterly/yearly.
2. Sales & Marketing Report — funnel formula (Reach x CR = Prospects x CR =
   Customers x Avg Sale x Txn = Sales - GP% = GP - OPEX = EBITDA), 10x10
   strategy list (minimum 10 active), channel analytics (FB, IG, LinkedIn,
   TikTok, Threads, Website, SEO, Email, WhatsApp, Telegram, Referral/
   Affiliate, Strategic Alliances).
3. Operations Report — Staff Happiness metric, Customer Happiness metric,
   industry-generic ops reports, overall KPI traffic lights (Green/Yellow/Red).

## 2. Where we already are (do not rebuild)

The CEO Business Dashboard module in this repo already covers most of the spec.
Stage 3 is done, formula engine tested (33 tests green), all local/uncommitted.

Coverage map, spec item -> what exists:

- P&L (Sales - COGS[open+purch-close] = GP - OPEX = EBITDA - Interest = EBIT)
  -> 0017_ceo_financial.sql, management view exactly this formula, plus a
  statutory view (EBITDA - depreciation = EBIT - interest = PBT - tax = PAT).
- Balance Sheet (Assets = Equity + P/L + Liabilities)
  -> 0017, with a balance gate: must balance or require override + note,
  audit-logged.
- Total CAPEX, AR listings, AP listings, other debts, bank repayment table
  -> 0017: capex, AR/AP tables + aging views, debts, facilities, group debt
  service view.
- Cash flow (money in - money out) -> 0017 cashflow.
- Funnel formula -> 0018 funnel table + src/lib/ceo-dashboard/formulas.ts
  (prospects = reach*cr1, customers = *cr2, sales = *avg_sale*txn).
- 10x10 strategies, minimum 10 -> 0018 strategies + min-10 enforcement view.
- Channel analytics -> 0018 channels table (all 12 channels as rows; manual/
  CSV entry in v1, auto-pull later).
- Staff Happiness + Customer Happiness -> 0018 happiness tables.
- KPI traffic lights -> formula engine: attainment = actual/target (inverted
  for lower-better), green >= 100, yellow >= 70, configurable; venture health
  = weighted attainment; every red KPI gets an owner + deadline, 48h untouched
  escalates to the group log.
- Multi-entity -> ceo_entities under workspaces; 6 roles (group_ceo/admin
  org-wide, venture_ceo/finance/marketing/ops per entity). Pilot = Ahmads
  HotChicken, then DRE Coffee, then group-wide.

Periodicity decision (new, from this request): entry grain is monthly for P&L/
BS and daily for cash flow and sales; weekly/quarterly/yearly are computed
rollups, never separately entered. One source of truth, five views.

Gaps the spec adds that are NOT yet designed:

- Industry-generic ops report packs (F&B, retail, services, education,
  healthcare, SaaS) — seed metric sets per industry. This fills the missing
  Stage 1 gap noted in STATE.md.
- Daily view surfaces (current design leaned monthly-first).
- CF ai itself.

## 3. CF ai — the AI CEO of the Group

Positioning: AHMAD runs ONE venture. CF ai sits one level above — the group
brain that reads every entity's dashboard and thinks like Coach: turnaround
lens, cash-first, deen-guarded, red-first attention.

Decision: CF ai lives INSIDE this repo, not a new one. Reasons: all the data
(ceo_ tables) is here, auth + workspaces + AI chat infra is here, aiforceo is
already the AI C-Suite product. AHMAD's proven patterns get ported as a
library, not forked as an app.

What we reuse from AHMAD (~/Code/ahmad-ai-ceo):

- Governance-first: guardrails enforced in CODE not prompts.
- Decision tiers: Tier 1 auto-executable (within caps), Tier 2 needs approval,
  Tier 3 people/deen NEVER auto-executes (advisory only).
- Advisor mode ON by default — CF ai builds a track record before any
  auto-execution is even discussed.
- Kill switch halting all autonomous action.
- Append-only audit log (ceo_audit_log already exists in 0016).
- Cabinet pattern: specialist agents propose, one arbiter decides.
- Deterministic heuristic fallback so the loop runs even without an API key.

CF ai cabinet (maps to data we already capture):

- KIRA (finance) — reads P&L/BS/cashflow/debt service, flags cash runway,
  balance-gate breaches, covenant risk.
- JUAL (sales & marketing) — reads funnel + channels + 10x10, flags CR drops,
  strategy count below 10, dead channels.
- URUS (operations) — reads happiness metrics + ops KPIs, flags red staff/
  customer scores.
- CF ai (arbiter) — weighs cabinet inputs, produces the group view: what
  matters today, in Coach's priority order, with a recommended action and an
  owner for every red.

## 4. Build plan (phased, commit per phase)

Gate 0 — COACH GO (blocks everything):
- Apply migrations 0016-0018 to prod Supabase tfduiiiiezpepzhyagwf (additive
  only, but shared with the boss-unified fork — coordinate first).
- Commit Stage 3 + formula engine (needs Coach's explicit commit go).

Phase 1 — Dashboard live (finish Stage 4, already sequenced):
1. KPI evaluator (traffic light engine over snapshots).
2. Server actions for all CRUD (repo convention: writes via admin client
   inside 'use server' after requireUser/requireWorkspaceOwner).
3. Group Overview screen per the approved dark ink/gold mockup (Group Pulse
   strip, red-first venture cards, red action log).
4. Entity dashboard, 4 tabs: Financial / Sales & Marketing / Operations /
   KPIs, each with the D/W/M/Q/Y period switcher.
5. CSV import (papaparse) + industry metric seed packs (the 6 packs above).
6. pg_cron: rollups, 48h red-action escalation, snapshot builder.
7. Pilot: seed Ahmads HotChicken entity with real numbers.

Phase 2 — CF ai Advisor (read-only intelligence, no execution):
1. Port AHMAD guardrail/tier types into src/lib/cf-ai/ (pure lib + tests).
2. Cabinet analysts KIRA/JUAL/URUS as Anthropic tool-use calls over the ceo_
   tables, with deterministic fallbacks.
3. CF ai Daily Brief: one screen + one morning message — group pulse, top 3
   issues, every red with owner/deadline/age, cash position across entities.
4. Ask CF ai: chat grounded in dashboard data (reuse existing aiforceo chat
   infra + personas plumbing).
5. Everything CF ai says is logged to ceo_audit_log.

Phase 3 — CF ai Recommends (still advisor mode):
1. Structured recommendations with tier labels and expected impact.
2. Approve/reject console (port AHMAD's Approval Console pattern); approvals
   create tracked red-actions/tasks, not external side effects.
3. Weekly board pack auto-draft (group P&L summary, funnel, traffic lights,
   decisions taken vs pending).

Phase 4 — CF ai Executes (LATER, needs separate Coach go + track record):
- Connectors (accounting export ingestion, WhatsApp nudges to venture CEOs via
  the WaroBot bridge, marketing actions via the aiforceo marketing pod).
- Auto-exec only Tier 1 within spend caps, kill switch live, advisor mode
  flipped consciously. Not in scope until Phases 1-3 have run for real.

## 5. Honest flags

- The prod DB is shared with boss-unified. Migrations are additive but we
  coordinate before applying. This is the single riskiest step; everything
  else is normal build work.
- Channel analytics auto-pull (FB/IG/TikTok APIs) is a rabbit hole; v1 is
  manual + CSV. Hire Aria's bundle.social snapshot pattern is the proven path
  when we automate later — do not hand-roll platform APIs.
- Staff/Customer happiness needs a capture method (monthly pulse form is the
  default: eNPS for staff, NPS for customers, 0-10, one question each).
- CF ai must not become a second AHMAD for Ahmads — AHMAD keeps venture-level
  duty; CF ai consumes the same numbers at group level. Clear boundary.
- Daily P&L is not real accounting practice; daily = cash + sales only,
  P&L/BS monthly. The dashboard should say so rather than fake daily EBITDA.

## 6. Next action

Waiting on Gate 0: Coach says GO to apply 0016-0018 to prod and commit
Stage 3. Then Aria runs Phase 1 without further questions.
