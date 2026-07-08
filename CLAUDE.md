# Boardroom AI — Claude Code Guide

## Project Overview
"The AI C-Suite for every business owner." Multi-persona AI assistant (CEO, CFO, CMO, COO) with credit-based access, Stripe billing, and PDPA compliance.

Built for **Raudhah Tech / Brainy Bunch** per SOP v1.0. AI autonomy = **Level 2**: AI writes code and opens PRs, but a human approves every merge.

## Tech Stack
- **Framework**: Next.js 15, React 19, TypeScript (strict)
- **Styling**: Tailwind CSS
- **Database/Auth**: Supabase (Postgres + RLS + Auth)
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`)
- **Payments**: Stripe
- **Deploy**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Package manager**: pnpm 9.12.0 (always use `pnpm`, never `npm`/`yarn`)

## Local Dev
```bash
pnpm dev          # http://localhost:3000
```
`.env.local` must have all keys from `.env.example` filled in.

## Quality Gates (must all pass before any PR)
```bash
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest
pnpm build        # Next.js production build
pnpm ci           # all four in order
```

## Architecture Rules (from README + docs/ARCHITECTURE.md)
- **Reads** in server components → `createSupabaseServerClient()` (RLS-respecting)
- **Every write** → `createSupabaseAdminClient()` (service role) inside a `'use server'` action that has already called `requireUser()` or `requireWorkspaceOwner()`
- Never trust `workspace_id` from a client payload — always re-derive ownership server-side
- Only two exceptions for route handlers: `/api/auth/callback` and `/api/stripe/webhook`

## Key Files
| Path | Purpose |
|------|---------|
| `src/lib/prompts/index.ts` | AI persona definitions + system prompt builder |
| `src/lib/credits.ts` | Token-to-credit accounting logic |
| `src/lib/auth/require.ts` | `requireUser()`, `requireWorkspaceOwner()` |
| `src/server/actions/chat.ts` | Streaming chat server action |
| `src/server/actions/billing.ts` | Stripe checkout session |
| `supabase/migrations/0001_init.sql` | Full schema + RLS + self-test |
| `docs/PRD.md` | Product requirements |
| `docs/ARCHITECTURE.md` | System design + decision rationale |
| `docs/DECISION_LOG.md` | Every non-obvious technical decision |
| `docs/ceo-dashboard/CLAUDE.md` | CEO Business Dashboard module guide (read before touching `src/app/ceo`, `src/lib/ceo-dashboard`, or `ceo_` migrations) |

## Working in This Repo
- One PR per small unit of work: branch → PR → CI green → human review → merge
- Every PR must run the [Pre-Ship Checklist](./docs/PRESHIP_CHECKLIST.md)
- Update [Decision Log](./docs/DECISION_LOG.md) for any non-obvious choices
- Merge to `main` is blocked on failing CI

## Personas (AI Agents)
Four C-suite roles, each with a distinct system prompt in `src/lib/prompts/index.ts`:
- **CEO** — strategy & vision
- **CFO** — financial analysis
- **CMO** — marketing & growth
- **COO** — operations & processes

## Database
Run `supabase/migrations/0001_init.sql` in Supabase SQL editor once. It includes a self-test that raises an exception if RLS is misconfigured.
