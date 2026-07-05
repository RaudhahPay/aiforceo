import Link from "next/link";
import {
  createCheckoutSession,
  createTopupCheckoutSession,
} from "@/server/actions/billing";
import { isStripeConfigured, TOPUP_TOKENS } from "@/lib/stripe";

const TIERS = [
  {
    name: "Starter",
    price: "$79",
    color: "var(--primary)",
    plan: "starter",
    setup: "+ $297 one-time setup",
    feats: [
      "CMO + COO + CFO (3 execs)",
      "500K tokens / month",
      "3 connectors",
      "1 workspace",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "$197",
    color: "var(--accent)",
    plan: "growth",
    featured: true,
    setup: "+ $297 one-time setup",
    feats: [
      "All 6 executives incl. Aria",
      "2M tokens / month",
      "10 connectors",
      "3 workspaces",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: "$497",
    color: "var(--gold)",
    plan: "scale",
    setup: "+ $297 one-time setup",
    feats: [
      "All 6 + custom executives",
      "8M tokens / month",
      "Unlimited connectors",
      "10 workspaces",
      "Dedicated CSM",
    ],
  },
] as const;

export default function PricingPage() {
  const stripeReady = isStripeConfigured();

  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      <Link href="/" className="flex items-center gap-2.5 font-bold mb-12">
        <span className="logo-mark" />
        AI<span style={{ color: "var(--accent)" }}>for</span>CEO
      </Link>

      {/* ── Founding member banner ── */}
      <div
        className="mb-8 rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(197,165,114,0.12), rgba(197,165,114,0.04))",
          border: "1px solid rgba(197,165,114,0.4)",
        }}
      >
        <div>
          <p
            className="text-xs font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--gold)" }}
          >
            Founding Member Offer — First 30 Seats
          </p>
          <p className="font-bold text-xl" style={{ color: "var(--ink)" }}>
            $47 / month, locked for life
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Setup fee waived. Includes all 6 executives. Price never increases
            after you claim your seat.
          </p>
        </div>
        <Link
          href="/login"
          className="btn shrink-0"
          style={{
            background: "var(--gold)",
            color: "#0a0e1a",
            border: "none",
            textDecoration: "none",
          }}
        >
          Claim founding seat →
        </Link>
      </div>

      {/* ── Banners ── */}
      {!stripeReady && (
        <div
          className="mb-8 rounded-xl px-5 py-4 text-sm font-medium"
          style={{
            background: "rgba(197,165,114,0.1)",
            border: "1px solid rgba(197,165,114,0.3)",
            color: "var(--gold)",
          }}
        >
          ⚠ Billing is not yet configured. Plans are displayed for preview only
          — checkout is not active.
        </div>
      )}

      <span
        className="inline-block text-xs uppercase tracking-widest font-bold mb-3"
        style={{ color: "var(--accent)" }}
      >
        Pricing
      </span>
      <h1 className="serif text-5xl leading-tight max-w-3xl">
        Less than one junior employee.{" "}
        <em className="italic" style={{ color: "var(--primary)" }}>
          An entire executive team.
        </em>
      </h1>
      <p className="text-lg text-[var(--muted)] mt-4 max-w-2xl">
        One-time setup fee plus a monthly subscription that includes generous AI
        credits. Top up only if you use more.
      </p>

      {/* ── Subscription plans ── */}
      <div className="grid md:grid-cols-3 gap-5 mt-14">
        {TIERS.map((t) => {
          const featured = "featured" in t && t.featured;
          return (
            <div
              key={t.name}
              className="card relative flex flex-col gap-4"
              style={{
                border: featured
                  ? `2px solid ${t.color}`
                  : "1px solid var(--line)",
                boxShadow: featured
                  ? "0 20px 60px rgba(212,160,23,0.15)"
                  : undefined,
              }}
            >
              {featured ? (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  MOST POPULAR
                </span>
              ) : null}
              <p
                className="text-xs uppercase tracking-widest font-bold"
                style={{ color: t.color }}
              >
                {t.name}
              </p>
              <div
                className="serif text-5xl flex items-baseline gap-1.5"
                style={{ color: t.color }}
              >
                {t.price}
                <span className="text-sm font-sans text-[var(--muted)]">
                  / month
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">{t.setup}</p>
              <ul className="space-y-2 my-2">
                {t.feats.map((f) => (
                  <li key={f} className="text-sm flex gap-2">
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>
                      ✓
                    </span>{" "}
                    {f}
                  </li>
                ))}
              </ul>
              <form action={createCheckoutSession} className="mt-auto">
                <input type="hidden" name="plan" value={t.plan} />
                <button
                  type="submit"
                  disabled={!stripeReady}
                  className={`btn w-full justify-center ${featured ? "" : "btn-ghost"}`}
                  title={
                    !stripeReady ? "Billing not yet configured" : undefined
                  }
                >
                  {stripeReady ? `Choose ${t.name}` : "Coming soon"}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* ── Top-up pack ── */}
      <div
        className="mt-10 card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ border: "1px solid var(--line)", background: "var(--soft)" }}
      >
        <div>
          <p
            className="text-xs uppercase tracking-widest font-bold mb-1"
            style={{ color: "var(--muted)" }}
          >
            Token Top-up
          </p>
          <p className="font-bold text-xl">
            {(TOPUP_TOKENS / 1000).toFixed(0)}K tokens{" "}
            <span className="text-sm font-normal text-[var(--muted)]">
              — one-time, carry forward
            </span>
          </p>
          <p className="text-sm text-[var(--muted)] mt-1">
            Buy extra tokens any time. Unused top-up tokens never expire.
          </p>
        </div>
        <form action={createTopupCheckoutSession} className="shrink-0">
          <button
            type="submit"
            disabled={!stripeReady}
            className="btn btn-ghost"
            title={!stripeReady ? "Billing not yet configured" : undefined}
          >
            {stripeReady ? "Buy top-up →" : "Coming soon"}
          </button>
        </form>
      </div>

      {/* Done-For-You tier */}
      <div
        className="mt-8 card p-8"
        style={{
          background:
            "linear-gradient(135deg, rgba(197,165,114,0.08), rgba(197,165,114,0.03))",
          border: "1px solid rgba(197,165,114,0.25)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              Done For You
            </span>
            <h3 className="serif text-2xl mt-1 mb-2">
              We set it all up for you
            </h3>
            <p className="text-sm text-[var(--muted)] max-w-lg">
              Our team personally onboards your business — 60-minute strategy
              session, full C-suite configuration, custom agent personas, and a
              30-day check-in. Starting USD 2,000.
            </p>
            <ul className="mt-3 space-y-1">
              {[
                "White-glove onboarding by our team",
                "Custom agent personas built for your industry",
                "Dedicated Slack support channel (30 days)",
                "Monthly strategy call with AIforCEO team",
              ].map((f) => (
                <li key={f} className="text-sm flex gap-2">
                  <span style={{ color: "var(--gold)", fontWeight: 700 }}>
                    ✓
                  </span>{" "}
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0">
            <a
              href="mailto:hello@aiforceo.app?subject=Done-For-You%20Inquiry"
              className="btn"
              style={{
                background: "var(--gold)",
                color: "var(--bg)",
                border: "none",
                textDecoration: "none",
                display: "inline-flex",
              }}
            >
              Contact us →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
