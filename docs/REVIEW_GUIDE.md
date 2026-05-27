# Review Guide

Per SOP §11.3, AI autonomy is Level 2 — a human approves every merge. To make review tractable, this single push is structured as 8 logical "PRs" that can be reviewed and reasoned about independently. Each PR-sized chunk has its own diff scope, its own SOP-compliance hook, and its own merge gate.

Review them in the listed order. Each chunk is self-contained: if you reject one mid-stream, the next is still valid in isolation.

| # | "PR" | Diff scope | SOP gate | Merge requires |
|---|---|---|---|---|
| 1 | **Scaffold + CI** | `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `wrangler.jsonc`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `.github/workflows/ci.yml`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder), `tests/ci.smoke.test.ts` | §4.1 stack lock; §4.4 CI; D-010 | Green CI on a placeholder build |
| 2 | **Docs as source of truth** | `README.md`, `docs/*.md`, `docs/approval/*` | §10 doc artifacts; §14.1 PDPA note in repo | CEO confirms `docs/` matches the approved packet |
| 3 | **Database migration** | `supabase/migrations/0001_init.sql` | §5 RLS + pinned `search_path`; §8 self-documenting migration with verify-step | Migration applied to staging; self-test `raise notice PASSED`; Security Advisor green |
| 4 | **Auth: Supabase clients + require* helpers + middleware + login** | `src/lib/supabase/{browser,server,admin,middleware}.ts`, `src/lib/auth/require.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/auth/callback/route.ts`, `src/server/actions/auth.ts` | §4.2 admin-client + require* gate; §4.3 server-action discipline; D-004 | `tests/auth.errors.test.ts` green; manual magic-link signin in preview env |
| 5 | **Lib: prompts, anthropic, credits, stripe, workspace** | `src/lib/prompts/index.ts`, `src/lib/anthropic.ts`, `src/lib/credits.ts`, `src/lib/stripe.ts`, `src/lib/workspace.ts` | §4.4 typed boundaries; D-005, D-006 | `tests/credits.test.ts`, `tests/prompts.test.ts`, `tests/stripe.prices.test.ts` green |
| 6 | **Onboarding wizard + saveOnboarding action** | `src/app/onboarding/page.tsx`, `src/server/actions/onboarding.ts` | §4.2 write via admin client; §4.3 zod-validated input | End-to-end: signup → wizard → workspace + business_profile + brand_voice rows exist in staging DB; credit_ledger has +100K trial grant |
| 7 | **Dashboard + agent chat (streaming via server action)** | `src/app/dashboard/page.tsx`, `src/app/agent/[role]/page.tsx`, `src/app/agent/[role]/ChatClient.tsx`, `src/app/_components/Sidebar.tsx`, `src/app/_components/CreditMeter.tsx`, `src/server/actions/chat.ts` | §4.2 admin client for message+ledger writes; D-005 token-quota check before model call | Manual: send a chat to each of the 4 agents; verify `messages` rows persist, `credit_ledger` debits the workspace; check `tokens_remaining()` decreases |
| 8 | **Marketing + pricing + billing + webhook** | `src/app/page.tsx` (real landing), `src/app/pricing/page.tsx`, `src/server/actions/billing.ts`, `src/app/api/stripe/webhook/route.ts` | §4.3 server action for checkout; route handler permitted only for the Stripe webhook (D-003); idempotent webhook | Stripe test card → checkout completes → webhook fires → workspace.tier updates → credit_ledger grants monthly quota |

## How to actually do a review

1. **Read PR #N's row above.** That's the diff scope to look at.
2. **Run `pnpm ci` locally** before approving each PR (CI also runs it, but a local pass is the fastest signal).
3. **Confirm the SOP gate column.** That's the single hook from the SOP you're guarding for this PR.
4. **Confirm the merge requires column.** That's what has to be true in *staging* — not just CI — before you merge.
5. **Stop and re-spec** the moment a PR violates SOP §4.2 (any write outside the admin-client + require* pattern). Don't accept "I'll fix it next PR".

## Closing the loop

After all 8 are merged and the Pre-Ship Checklist (`docs/PRESHIP_CHECKLIST.md`) is green, the v0.1 release is ready to open to founding members. Cut the release tag, push to production, and post the launch summary in the Boardroom AI workspace.
