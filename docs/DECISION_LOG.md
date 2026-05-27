# Boardroom AI · Decision Log

Per SOP §10. Every architecturally significant choice is logged with its reasoning so it can be re-evaluated later. Append-only.

## D-001 · Next.js 15 + React 19 + @opennextjs/cloudflare
- **Decision**: build on the exact stack specified by Raudhah Tech SOP §4.1.
- **Why**: aligns this codebase with the rest of the org's projects, lets us share patterns / CI / vendor knowledge.
- **Reversal cost**: high once shipped — make this decision once.

## D-002 · Magic-link auth only at v0.1 (no password, no OAuth)
- **Decision**: ship with magic-link email only.
- **Why**: zero password storage = zero password breach risk; founder users prefer it.
- **Reversal cost**: low — Supabase Auth supports adding providers later without migrating users.

## D-003 · Server Actions for writes, Route Handlers only for external webhooks
- **Decision**: all internal mutations are `'use server'` actions; route handlers exist only for `/api/auth/callback` and `/api/stripe/webhook`.
- **Why**: SOP §4.3 mandates. Server actions are typed end-to-end; route handlers are not.
- **Reversal cost**: low per-action; high org-wide.

## D-004 · Service-role admin client for every write, gated by require* helpers
- **Decision**: every DB INSERT/UPDATE/DELETE uses `createSupabaseAdminClient()` inside a server action after `requireUser()` (or `requireWorkspaceOwner()` where workspace-scoped). The RLS-respecting client is reads-only in server components.
- **Why**: SOP §4.2 — the 18-file lesson. RLS-client writes silently match zero rows on Cloudflare Workers.
- **Reversal cost**: very high; this is fundamental.

## D-005 · Token quota enforced before model call
- **Decision**: chat server action checks `tokens_remaining()` before invoking Anthropic; if zero, return 402.
- **Why**: prevents a single runaway prompt from doubling a user's quota use.
- **Reversal cost**: low.

## D-006 · Trial = 100K tokens, hard-stop (no overage)
- **Decision**: free trial has a token cap; when hit, user must pay to continue. No surprise overage charges.
- **Why**: predictable cost ceiling; predictable price; converts trials faster than open-ended grace.
- **Reversal cost**: low.

## D-007 · No pgvector / long-term memory in v0.1
- **Decision**: agents have no persistent memory beyond the current conversation. Business context comes from workspace profile rehydrated into the system prompt on every request.
- **Why**: pgvector adds operational complexity for marginal value at low conversation volume.
- **Reversal cost**: low — additive change.

## D-008 · Stripe-hosted Checkout, not embedded Elements
- **Decision**: use the redirect-to-Stripe Checkout page; no card data touches our origin.
- **Why**: removes us from PCI scope; conversion penalty negligible at our price points.
- **Reversal cost**: low.

## D-009 · Single workspace per user in v0.1
- **Decision**: one workspace per user account even though schema supports many.
- **Why**: ships faster; multi-workspace adds UI complexity we can defer. Schema is forward-compatible.
- **Reversal cost**: zero — schema already supports many.

## D-010 · GitHub Actions CI from day one (not optional)
- **Decision**: CI runs `tsc --noEmit`, `eslint`, `vitest`, and a build check on every push. Merge to main blocked on green CI.
- **Why**: SOP §4.4 requires this. Cheap to set up; expensive to retrofit.
- **Reversal cost**: trivial.

## D-011 · `noUncheckedIndexedAccess` enabled in tsconfig
- **Decision**: strict-mode addition. Array and record accesses return `T | undefined`.
- **Why**: catches an entire class of "RLS query returned no rows but I treated it as a hit" bugs at compile time. Aligned with §4.2 lesson.
- **Reversal cost**: low.

## D-012 · `noEmit: true` — Next handles emit
- **Decision**: tsc is run only for type-checking; Next does the actual build emit.
- **Why**: standard Next.js pattern. Keeps CI fast.
- **Reversal cost**: trivial.

## D-013 · SECURITY DEFINER functions are server-role-only (no public EXECUTE)
- **Decision**: Migration 0002 revokes EXECUTE on `handle_new_user`, `is_owner`, `tokens_remaining` from `anon`, `authenticated`, and `public`. Functions remain SECURITY DEFINER with pinned `search_path` (D-004).
- **Why**: Supabase Security Advisor (run live on 17 May 2026 against the boardroom-ai project) flagged the three as exposed via `/rest/v1/rpc/<fn>`. `handle_new_user` runs only from the `auth.users` trigger, `is_owner` is invoked inside RLS policy expressions (the planner evaluates these as the table owner regardless of caller's EXECUTE grant), and `tokens_remaining` is called only from `src/lib/credits.ts` via the service role admin client which bypasses role-based grants. Removing the public RPC surface tightens least-privilege without breaking any code path.
- **Verified**: post-migration advisor returned `{lints: []}`.
- **Reversal cost**: trivial (re-grant EXECUTE in a follow-up migration).
