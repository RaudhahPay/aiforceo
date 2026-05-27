# Boardroom AI

The AI C-Suite for every business owner. Built for Raudhah Tech / Brainy Bunch per the Software Development SOP v1.0.

> **Canonical project docs live in [`/docs`](./docs).** Start there: [PRD](./docs/PRD.md), [Architecture](./docs/ARCHITECTURE.md), [PDPA](./docs/PDPA.md), [Decision Log](./docs/DECISION_LOG.md), [SOP Compliance Map](./docs/SOP_COMPLIANCE.md), [Pre-Ship Checklist](./docs/PRESHIP_CHECKLIST.md), [Runbook](./docs/RUNBOOK.md). The signed approval packet is in [`/docs/approval`](./docs/approval).

## Stack
Next.js 15 · React 19 · TypeScript strict · Tailwind · Supabase (Postgres + Auth + Storage) · Anthropic Claude · Stripe · Cloudflare Workers via `@opennextjs/cloudflare`. CI: GitHub Actions (typecheck + lint + test + build).

## Local dev
```bash
pnpm install
cp .env.example .env.local        # fill in keys
pnpm dev                          # http://localhost:3000
```

## Quality gates
```bash
pnpm typecheck    # tsc --noEmit — must be clean
pnpm lint         # eslint — must pass
pnpm test         # vitest — must pass
pnpm build        # Next.js production build
pnpm ci           # all of the above in order
```
CI runs all four on every push. Merge to `main` is blocked on green CI.

## Deploy
```bash
pnpm cf:build     # opennextjs-cloudflare build → .open-next
pnpm cf:preview   # local preview against Workers
pnpm cf:deploy    # deploy to Cloudflare
```
Production secrets are set via `pnpm wrangler secret put NAME` (see `.env.example` for the list). The anon Supabase key is public by design and lives in `wrangler.jsonc`.

## Apply the database migration
1. In the Supabase SQL editor, run `supabase/migrations/0001_init.sql`. The migration includes a self-test block that `raise exception`s if RLS is off or function `search_path` is unpinned — so a green run guarantees the security baseline.
2. Run the Supabase Security Advisor — confirm no ERROR-level findings.
3. In Auth → Policies → enable leaked-password protection.

## How writes work (read this before opening a PR)
Per SOP §4.2 + decision **D-004**:
- **Reads** in server components use `createSupabaseServerClient()` (RLS-respecting).
- **Every write** uses `createSupabaseAdminClient()` (service role) inside a `'use server'` action that has already called `requireUser()` (or `requireWorkspaceOwner()`).
- Never trust a `workspace_id` from a client payload — always re-derive ownership server-side.
- The single permitted exceptions for route handlers are `/api/auth/callback` and `/api/stripe/webhook` (external callbacks only).

## File map
```
boardroom-ai/
├── README.md                        ← you are here
├── docs/
│   ├── PRD.md                       ← what we're building
│   ├── ARCHITECTURE.md              ← how, with rollback plan
│   ├── PDPA.md                      ← data protection
│   ├── DECISION_LOG.md              ← every "why"
│   ├── SOP_COMPLIANCE.md            ← row-by-row SOP map
│   ├── PRESHIP_CHECKLIST.md         ← run before any production deploy
│   ├── RUNBOOK.md                   ← daily ops, incidents, rollback
│   └── approval/
│       └── Boardroom_AI_v01_Approval_Packet.docx
├── package.json
├── next.config.mjs · wrangler.jsonc · tsconfig.json · tailwind.config.ts
├── eslint.config.mjs · vitest.config.ts · postcss.config.mjs
├── .env.example
├── .github/workflows/ci.yml
├── supabase/
│   └── migrations/0001_init.sql     ← schema + RLS + self-test
├── src/
│   ├── middleware.ts                ← auth gate (edge)
│   ├── app/
│   │   ├── layout.tsx · globals.css
│   │   ├── page.tsx                 ← marketing landing
│   │   ├── login/page.tsx           ← magic-link
│   │   ├── api/auth/callback/route.ts
│   │   ├── api/stripe/webhook/route.ts
│   │   ├── onboarding/page.tsx      ← 5-step wizard
│   │   ├── pricing/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── agent/[role]/page.tsx + ChatClient.tsx
│   │   └── _components/Sidebar.tsx + CreditMeter.tsx
│   ├── server/actions/
│   │   ├── auth.ts                  ← signOut
│   │   ├── onboarding.ts            ← saveOnboarding
│   │   ├── chat.ts                  ← sendChatMessage (streams)
│   │   └── billing.ts               ← createCheckoutSession
│   └── lib/
│       ├── auth/require.ts          ← requireUser, requireWorkspaceOwner
│       ├── supabase/
│       │   ├── browser.ts           ← client components
│       │   ├── server.ts            ← RLS-respecting reads
│       │   ├── admin.ts             ← service-role writes
│       │   └── middleware.ts        ← edge session refresh
│       ├── prompts/index.ts         ← 4 personas + system prompt builder
│       ├── anthropic.ts
│       ├── credits.ts               ← token accounting
│       ├── stripe.ts
│       └── workspace.ts             ← current workspace reader
└── tests/
    ├── ci.smoke.test.ts
    ├── credits.test.ts
    ├── prompts.test.ts
    ├── auth.errors.test.ts
    └── stripe.prices.test.ts
```

## Bringing this online — 60-minute path
See [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for the full operational guide. Short version:
1. Supabase project → run `0001_init.sql` → confirm self-test passes
2. Anthropic console → create API key
3. Stripe dashboard → create 5 products (setup, starter, growth, scale, topup) → grab price IDs
4. GitHub → push the repo → connect to Cloudflare Pages (preset: Next.js, build: `pnpm cf:build`, output: `.open-next`)
5. Cloudflare env vars + `wrangler secret put` for the secrets in `.env.example`
6. Open production URL → magic-link in → onboarding → chat → checkout (Stripe test mode) → confirm webhook fires

## Working in this repo
- One PR per small unit of work. Branch → PR → CI green → human review → merge to `main` (Cloudflare auto-deploys).
- Every PR runs the [Pre-Ship Checklist](./docs/PRESHIP_CHECKLIST.md) and updates the [Decision Log](./docs/DECISION_LOG.md) if any non-obvious choice was made.
- AI autonomy = Level 2 (SOP §11.3): the AI may write code and open PRs, but a human approves every merge.
