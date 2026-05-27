# Boardroom AI · Architecture Note

Approved by CEO 17 May 2026. Changes to this file are themselves reviewed PRs.

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router + React 19, TypeScript strict |
| Hosting adapter | `@opennextjs/cloudflare` → Cloudflare Workers (SOP §4.1) |
| Database | Supabase Postgres 15. RLS on every workspace-scoped table |
| Auth | Supabase Auth, magic-link email (no passwords in v0.1) |
| AI | Anthropic Claude (`claude-sonnet-4-6` default), streaming |
| Billing | Stripe Checkout + Webhooks (subscription + setup + metered top-up) |
| File store | Supabase Storage — private bucket; not used in v0.1 |
| Styling | Tailwind CSS, Instrument Serif + Inter |
| Observability | Cloudflare Workers Analytics + Sentry (errors) |
| CI | GitHub Actions: typecheck, lint, test, build on every push |

## Data model
Every workspace-scoped table has RLS enforced by the helper `public.is_owner(workspace_id)` which checks `auth.uid()` against `workspaces.owner_id`.

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`; auto-created on signup via trigger |
| `workspaces` | `owner_id` → profiles. tier, Stripe IDs, monthly quota |
| `business_profiles` | 1:1 with workspace. industry, size, challenges[], 90-day goal |
| `brand_voice` | 1:1 with workspace. raw sample + AI-extracted summary, tone[], words to use/avoid |
| `financial_snapshots` | 1:N. P&L paste + AI analysis per period |
| `connectors` | 1:N. Placeholder rows in v0.1; OAuth wiring in v0.2 |
| `conversations` | 1:N per workspace per agent role |
| `messages` | 1:N per conversation. content, input/output token counts |
| `credit_ledger` | Append-only token ledger. Negative on chat, positive on renewal / top-up |

## Modules
- Public: `/` (landing), `/pricing`, `/login`
- Onboarding: `/onboarding` (client wizard) + `saveOnboarding` server action
- App shell: `/dashboard`, `/agent/[role]` — server components reading via RLS-respecting client
- Server actions (`src/server/actions/`): `saveOnboarding`, `sendChatMessage`, `createCheckoutSession`, `signOut`
- Webhooks (only external callbacks): `/api/auth/callback`, `/api/stripe/webhook`
- Lib: `src/lib/{supabase, anthropic, credits, stripe, prompts}`
- Auth helpers: `src/lib/auth/require.ts` — `requireUser()`, `requireWorkspaceOwner()`

## The data-write rule (SOP §4.2)
- **Reads** in server components: `createSupabaseServerClient()` (RLS-respecting)
- **Every write**: `createSupabaseAdminClient()` (service role) inside a `'use server'` action, after `requireUser()` (or `requireWorkspaceOwner()` for workspace-scoped writes)
- **Why**: RLS-respecting client UPDATE silently matches zero rows on Cloudflare Workers because `auth.uid()` can fail to reach Postgres. The `require*` gate is the security boundary; the admin client is the reliable write path. This is the 18-file lesson from the SOP.

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| AI cost blow-up (Claude pricing changes mid-month) | Per-workspace ledger + hard cap before each call. Cap returns 402 with upgrade link before model call is made. Daily cost report. |
| Brand voice extraction unreliable | Onboarding step 2 saves raw sample even on failure. CMO agent falls back to neutral professional voice. |
| Stripe webhook drops a payment event | Idempotent handler. Stripe retries automatically. Daily reconciliation job (v0.2) checks subscription state vs workspace tier. |
| Founding member churn after first session | Activation gate: every user receives one useful, branded deliverable before leaving step 5. Outputs persisted so they can return. |
| First-time RLS misconfiguration | Migration includes `is_owner()` helper used by every policy. Migration includes a self-test query block. Supabase security advisor run after every schema change. |

## Rollback plan
1. Cloudflare Pages keeps every previous deployment. Rollback = one click or `wrangler pages deployment retry`. < 2 minutes.
2. DB migrations are numbered and additive only. Schema rollback requires writing a reverse migration; no DROP COLUMN on live data without CEO sign-off (SOP §8).
3. Stripe is in test mode until launch day. Cutover from test to live keys is one env-var change in Cloudflare; reversible the same way.
4. Supabase project has Point-in-Time Recovery enabled (Pro plan). Recovery window: 7 days. Tested once before launch.

## What is deliberately not in this build
- pgvector / semantic memory
- Real connector OAuth (UI placeholder only)
- Cron-triggered morning briefs
- Team / multi-seat
