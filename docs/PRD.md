# Boardroom AI · v0.1 PRD

> One page. Scope discipline is the product. Approved by CEO 17 May 2026.

## Goal
Give a small-business owner the experience of having a four-person C-suite — Chief Marketing, Operating, Financial, and Strategy officers — for less than the cost of a single junior employee. The owner spends 30 minutes onboarding once and receives a customized executive team that operates on their actual business context.

## Primary user
Founder-operator of a 2–50 person business doing USD 50K–5M annual revenue. Is the bottleneck in their own business. Has no real C-suite and cannot afford one. Comfortable using consumer software (ChatGPT, Notion, Stripe, WhatsApp). Not technical.

## In scope for v0.1
- Magic-link email authentication (no passwords)
- 5-step onboarding wizard: business profile → brand voice sample → P&L paste → connector picker (UI only) → first-output selection
- Four agent chat pages, one per role (CMO / COO / CFO / CEO), each loaded with the workspace's business profile and brand voice in the system prompt
- Streaming chat against Claude Sonnet (latest) with persisted message history
- Token usage tracked per workspace; monthly quota enforced before each chat call
- Stripe-hosted checkout for one-time setup fee plus monthly subscription; webhook grants tokens and updates tier
- Marketing landing page at the root URL, pricing page, login page

## Explicitly OUT of scope for v0.1
- OAuth connectors to Gmail / Stripe / Xero / Meta / WhatsApp — placeholder UI only, no live data flow
- Scheduled morning briefs via Cloudflare Cron — agents respond on demand only
- Multi-workspace per user, team seats, role-based access control
- Custom agent builder, output marketplace, affiliate program
- Localization — English only at v0.1
- Native mobile app — responsive web only (PWA manifest deferred to v0.2)
- Long-term semantic memory via pgvector — system prompt rehydration is the memory layer for v0.1
- Done-For-You / consulting tier — handled out of band by CEO until v0.2

## Success criteria
- 100 founding members signed up within 30 days of launch, of whom ≥ 60 complete onboarding
- ≥ 70% of onboarded users send at least 5 chat messages in their first 7 days
- ≥ 30% of trial users convert to a paid tier within 14 days
- AI gross margin ≥ 60% at the average plan (Claude API spend per user ≤ USD 30/mo at Growth tier)
- Zero security incidents (data leak, RLS breach, secret exposure) before public launch

## Non-goals (failures we will accept in v0.1)
- Mobile-perfect — phones get a usable but unpolished experience
- Sub-second response — streaming target is first token in < 2s, full response in < 25s
- Multi-language support — English-only is fine for the founding cohort
