import Link from "next/link";
import { createCheckoutSession } from "@/server/actions/billing";

const TIERS = [
  {
    name: "Starter", price: "$79", color: "var(--primary)", plan: "starter",
    setup: "+ $297 one-time setup",
    feats: ["CMO + COO + CFO (3 execs)", "500K tokens / month", "3 connectors", "1 workspace", "Email support"]
  },
  {
    name: "Growth", price: "$197", color: "var(--accent)", plan: "growth", featured: true,
    setup: "+ $297 one-time setup",
    feats: ["All 6 agents incl. Aria", "2M tokens / month", "10 connectors", "3 workspaces", "Priority support"]
  },
  {
    name: "Scale", price: "$497", color: "var(--gold)", plan: "scale",
    setup: "+ $297 one-time setup",
    feats: ["All 6 + custom agents", "8M tokens / month", "Unlimited connectors", "10 workspaces", "Dedicated CSM"]
  }
] as const;

export default function PricingPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-20">
      <Link href="/" className="flex items-center gap-2.5 font-bold mb-12">
        <span className="logo-mark" />
        Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
      </Link>

      <span className="inline-block text-xs uppercase tracking-widest font-bold mb-3" style={{ color: "var(--accent)" }}>Pricing</span>
      <h1 className="serif text-5xl leading-tight max-w-3xl">
        Less than one junior employee.{" "}
        <em className="italic" style={{ color: "var(--primary)" }}>An entire executive team.</em>
      </h1>
      <p className="text-lg text-[var(--muted)] mt-4 max-w-2xl">
        One-time setup fee plus a monthly subscription that includes generous AI credits. Top up only if you use more.
      </p>

      <div className="grid md:grid-cols-3 gap-5 mt-14">
        {TIERS.map((t) => {
          const featured = "featured" in t && t.featured;
          return (
            <div key={t.name} className="card relative flex flex-col gap-4"
                 style={{
                   border: featured ? `2px solid ${t.color}` : "1px solid var(--line)",
                   boxShadow: featured ? "0 20px 60px rgba(212,160,23,0.15)" : undefined
                 }}>
              {featured ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider"
                      style={{ background: "var(--accent)", color: "#fff" }}>
                  MOST POPULAR
                </span>
              ) : null}
              <p className="text-xs uppercase tracking-widest font-bold" style={{ color: t.color }}>{t.name}</p>
              <div className="serif text-5xl flex items-baseline gap-1.5" style={{ color: t.color }}>
                {t.price}<span className="text-sm font-sans text-[var(--muted)]">/ month</span>
              </div>
              <p className="text-xs text-[var(--muted)]">{t.setup}</p>
              <ul className="space-y-2 my-2">
                {t.feats.map((f) => (
                  <li key={f} className="text-sm flex gap-2">
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <form action={createCheckoutSession} className="mt-auto">
                <input type="hidden" name="plan" value={t.plan} />
                <button type="submit" className={`btn w-full justify-center ${featured ? "" : "btn-ghost"}`}>
                  Choose {t.name}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-[var(--muted)] mt-12">
        Need a Done-For-You setup? <Link href="/login" className="underline">Contact us</Link> — starting $5,000.
      </p>
    </main>
  );
}
