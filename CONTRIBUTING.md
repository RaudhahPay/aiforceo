# Contributing to AIforCEO

> **Live site:** https://aiforceo.app  
> **Stack:** Next.js 15 · Cloudflare Workers · Supabase · Tailwind CSS · TypeScript

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| Git | any | https://git-scm.com |

---

## 2. First-time setup

```bash
# Clone
git clone https://github.com/ariavibecoderlab/aiforceo.git
cd aiforceo

# Install dependencies
pnpm install

# Copy env file — ask @coachfadzil for the real values
cp .env.example .env.local
```

Fill in `.env.local` with the keys provided by the team lead. You need:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase dashboard
- `SUPABASE_SERVICE_ROLE_KEY` — **secret**, never commit
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — optional (only needed for Google Sheets connector)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — optional (only needed for billing work)

---

## 3. Run locally

```bash
pnpm dev
# → http://localhost:3000
```

---

## 4. Branch workflow

```
main          ← protected, always deployable
  └── feat/your-feature    ← your work goes here
  └── fix/bug-description
```

**Never push directly to `main`.** Always open a Pull Request.

```bash
# Start a new feature
git checkout -b feat/my-feature

# Push and open PR
git push -u origin feat/my-feature
# Then open a PR on GitHub → get 1 approval → merge
```

---

## 5. Deploy to production

Only the team lead deploys. After a PR is merged to `main`:

```bash
pnpm build          # Next.js build
pnpm cf:build       # Cloudflare bundle
pnpm cf:deploy      # Push to aiforceo.app
```

⚠️ Always run all three steps in order — deploying with `cf:deploy` alone uploads a stale bundle.

---

## 6. Project structure

```
src/
  app/               # Next.js App Router pages
    _components/     # Shared UI (Sidebar, ProspectChat, etc.)
    api/             # API routes (chat, auth callback, connectors)
    dashboard/       # Main dashboard
    reports/         # Investor Pack, future reports
    workspaces/      # Multi-company management
  lib/               # Utilities, Supabase clients, prompts
    investor-pack/   # Excel + PDF generation engine
    prompts/         # AI executive personas
  server/
    actions/         # Next.js Server Actions (DB writes, AI calls)

supabase/
  migrations/        # All DB schema changes (run in order)
```

---

## 7. Key conventions

- **Server Actions** for all DB writes and AI calls — never call Supabase directly from client components
- **Admin client** (`createSupabaseAdminClient`) for server-side writes — bypasses RLS
- **Browser client** (`createSupabaseBrowserClient`) for client-side auth only
- No `console.log` left in PRs
- TypeScript strict — no `any` without a comment explaining why

---

## 8. Environment tiers

| Env | URL | Deployed via |
|-----|-----|--------------|
| Local | http://localhost:3000 | `pnpm dev` |
| Production | https://aiforceo.app | `pnpm cf:deploy` |

There is no staging environment yet. Test thoroughly locally before merging to main.
