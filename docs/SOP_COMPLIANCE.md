# SOP Compliance Map · Boardroom AI v0.1

Tracks how every SOP section is satisfied by this build. Updated per release.

| SOP § | Requirement | Status | Evidence |
|---|---|---|---|
| §3.2 | PRD before code | ✓ | `docs/PRD.md` |
| §3.3 | Architecture note (data model, modules, risks, rollback) | ✓ | `docs/ARCHITECTURE.md` |
| §3.4 | CEO approval to proceed, scope frozen | ✓ | `docs/approval/Boardroom_AI_v01_Approval_Packet.docx` — CEO sign-off page |
| §4.1 | Next.js 15 / React 19 / TS / Tailwind / Supabase / Workers via @opennextjs/cloudflare | ✓ | `package.json`, `wrangler.jsonc` |
| §4.2 | All writes via admin client + `require*` gate; reads via RLS client | ✓ | `src/lib/auth/require.ts`, `src/lib/supabase/admin.ts`, every server action |
| §4.3 | `'use server'` files export only async; zod-validate; re-derive server-side | ✓ | `src/server/actions/*` |
| §4.4 | `tsc --noEmit` clean, no `any`, lint + test in CI | ✓ | `.github/workflows/ci.yml`, `eslint.config.mjs` |
| §4.5 | Service role key in Cloudflare secrets only | ✓ | `.env.example` notes; `wrangler.jsonc` does not list it |
| §5 | RLS on every table, PII scoped, pinned `search_path` on functions | ✓ | `supabase/migrations/0001_init.sql` |
| §5 | Supabase security advisor after every schema change | ✓ | Pre-Ship Checklist item; see `docs/PRESHIP_CHECKLIST.md` |
| §5 | Storage policies for sensitive uploads | N/A v0.1 | No uploads at v0.1 |
| §6 | Quality gates — type-check, lint, tests, no half-wired | ✓ | CI + Pre-Ship Checklist |
| §7 | Branch → PR → review → CI → auto-deploy → verify live | ✓ | GitHub flow + Cloudflare auto-deploy |
| §7 | Migration ordering, rollback known | ✓ | `docs/ARCHITECTURE.md` — Rollback plan |
| §8 | Numbered SQL migrations, additive only, self-documenting | ✓ | `supabase/migrations/0001_init.sql` header |
| §9 | AI agents briefed with PRD + arch note + §4 + §13.3 | ✓ | This packet is the brief |
| §10 | PRD, arch note, decision log, runbook, known gaps per project | ✓ | `docs/*` (runbook stub `docs/RUNBOOK.md`) |
| §11.3 | AI autonomy level — Observer / Reviewer / Engineer | Level 2 | CEO promotes based on track record |
| §13 | Incident response runbook | Stub | `docs/RUNBOOK.md` — fleshed out before launch day |
| §14.1 | PDPA / data note | ✓ | `docs/PDPA.md` |
| §14.3 | Pre-Ship Checklist | ✓ | `docs/PRESHIP_CHECKLIST.md` |
