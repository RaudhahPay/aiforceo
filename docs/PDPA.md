# Boardroom AI · PDPA / Data Protection Note

Per SOP §5 + §14.1. Boardroom AI v0.1 does not knowingly collect data from minors — target users are adult business owners. PDPA (Malaysia) and equivalents (GDPR EU, CCPA California) still apply.

## What personal data we store
| Category | Specifics | Sensitivity |
|---|---|---|
| Identity | Email, optional full name. `auth.users` + `public.profiles`. | PII — moderate |
| Business profile | Business name, industry, team size, top challenges, 90-day goals. | Commercial-confidential |
| Brand voice sample | User-pasted writing sample. | Commercial-confidential |
| Financial snapshots | Pasted P&L numbers and AI analysis. | Commercial-sensitive — **HIGH** |
| Chat history | User prompts + assistant responses, all agents. May contain employee names, customer details, financial figures. | Mixed — potentially **HIGH** |
| Billing | Stripe customer ID, subscription state. Card details at Stripe, never us. | Financial — moderate |
| Operational metadata | Token usage, login timestamps, login IP (Supabase). | Low |

## Where the data lives
- **Supabase Postgres** (ap-southeast-1, Singapore). Encrypted at rest (AES-256). Encrypted in transit (TLS 1.3).
- **Supabase Storage** — private bucket reserved for v0.2 file uploads. None in v0.1.
- **Anthropic API** — every chat message sent to Anthropic. Per Anthropic enterprise terms (to be signed before launch), inputs/outputs are not used to train and are deleted after 30 days.
- **Stripe** — only payment metadata. PCI scope handled by Stripe.
- **Cloudflare logs** — request metadata (IP, timestamp, path). Cloudflare default retention (~7 days).

## Who can read what
- Workspace owner can read everything in their workspace. Enforced by RLS — Postgres returns zero rows for any other authenticated user.
- The `service_role` key — held only in Cloudflare secret store; used only by server actions and webhook handlers. Never sent to the browser. Anthropic and Stripe keys are also server-only.
- CEO + AI CTO have administrative access via Supabase dashboard for support and incident response. All admin access is logged.
- Third-party processors: Supabase (storage + auth), Anthropic (AI), Stripe (billing), Cloudflare (hosting). Documented in the Privacy Policy.

## Deletion + data subject rights
- Workspace owner can request deletion via in-product link (v0.2; v0.1 = email-to-support).
- Deletion cascades: `ON DELETE CASCADE` from `profiles` → `workspaces` → all child tables. Tested in migration.
- Anthropic / Stripe deletion handled via their APIs as part of the deletion job (v0.2 cron; v0.1 manual).
- PDPA / GDPR / CCPA right-to-access requests: respond within 30 days. CEO acknowledges in writing.

## Risk acknowledgements
- **Risk**: users paste sensitive financial data into chat that we cannot meaningfully control.
- **Mitigation**: in-product disclaimer at first CFO chat. Privacy policy explicit. Anthropic data-retention terms make this acceptable for the founding-member cohort.
- **Risk**: AI generates incorrect financial or operational advice that the user acts on.
- **Mitigation**: every CFO output cites input numbers. T&Cs make clear AI outputs are not professional advice. CFO system prompt instructs the agent to flag uncertainty.
