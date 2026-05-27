// Public marketing landing page.
// Shares brand + tokens with the rest of the app via globals.css.
import Link from "next/link";
import { ProspectChat } from "@/app/_components/ProspectChat";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Boardroom AI",
  applicationCategory: "BusinessApplication",
  description:
    "Six AI executives — CMO, COO, CFO, CEO, CTO, and Aria Chief of Staff — customized for your business in 30 minutes.",
  offers: { "@type": "Offer", price: "79", priceCurrency: "USD" },
  operatingSystem: "Web"
};

const AGENT_BLOCKS = [
  {
    role: "AI CMO", name: "Maya",
    headline: "Marketing that runs while you sleep.",
    tag: "Your brand voice, captured once. Used forever across every channel.",
    bullets: [
      "30-day content calendar in 20 minutes",
      "Ad copy — 30 variations, A/B ready",
      "One idea → blog, thread, reel, email, ad",
      "Brand voice locked across every output"
    ],
    gradient: "linear-gradient(135deg,#F96167,#FF9966)",
    lightText: false
  },
  {
    role: "AI COO", name: "Owen",
    headline: "Operations that never resign.",
    tag: "Customer responses, invoice chasing, workflows — automated 24/7.",
    bullets: [
      "Auto-responder for WhatsApp, email, IG",
      "Invoice reminders that escalate politely",
      "Staff onboarding checklists",
      "Daily operations digest at 7am"
    ],
    gradient: "linear-gradient(135deg,#2A9D8F,#43BBAA)",
    lightText: false
  },
  {
    role: "AI CFO", name: "Felix",
    headline: "Financial clarity in 60 seconds.",
    tag: "Paste your P&L. Get a board-level analysis instantly.",
    bullets: [
      "P&L analysis with cut recommendations",
      "30/60/90-day cash flow forecasts",
      "Leak detection on growing expense lines",
      "Scenario modelling — \"what if?\""
    ],
    gradient: "linear-gradient(135deg,#FFB347,#FFD580)",
    lightText: true
  },
  {
    role: "AI CEO", name: "Eden",
    headline: "The strategic advisor you can't afford.",
    tag: "A 7am morning brief, decisions log, weekly review, strategic sounding board.",
    bullets: [
      "Daily 7am brief — numbers, priorities, risks",
      "Strategic Q&A with full business context",
      "Friday weekly review",
      "Decision log captures the \"why\" forever"
    ],
    gradient: "linear-gradient(135deg,#C5A572,#E2C28F)",
    lightText: true
  },
  {
    role: "AI CTO", name: "Tariq",
    headline: "Technology that works for you.",
    tag: "Tech stack audit, automation roadmap, security checklist — no jargon.",
    bullets: [
      "Systems audit — find duplicates and gaps",
      "Top 3 automations with cost and timeline",
      "Security hygiene checklist for SMBs",
      "Dashboard and reporting setup"
    ],
    gradient: "linear-gradient(135deg,#0096C7,#00BFFF)",
    lightText: false
  },
  {
    role: "AI Chief of Staff", name: "Aria",
    headline: "One PA. Five executives. Zero gaps.",
    tag: "Aria connects all five execs and keeps the owner one step ahead.",
    bullets: [
      "Morning brief across all 5 exec areas",
      "Open loops tracker — nothing falls through",
      "Weekly status report in one summary",
      "Board pack ready before the meeting"
    ],
    gradient: "linear-gradient(135deg,#7C3AED,#A855F7)",
    lightText: false
  }
] as const;

const STEPS = [
  { t: "8 min", h: "Profile", b: "Industry, size, top challenges, 90-day goals." },
  { t: "6 min", h: "Voice", b: "Drop your website or paste a sample." },
  { t: "5 min", h: "Financials", b: "Upload your latest P&L. CFO analyzes live." },
  { t: "6 min", h: "Connectors", b: "One-click OAuth to your tools." },
  { t: "5 min", h: "First output", b: "Pick one. Receive it before you finish." }
] as const;

export default function Home() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="sticky top-0 z-50 backdrop-blur" style={{ background: "rgba(14,23,38,0.94)", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base">
            <span className="logo-mark" />
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </Link>
          <div className="flex gap-7 items-center text-sm font-medium text-[var(--muted)]">
            <a href="#agents" className="hidden md:inline">The Agents</a>
            <a href="#how" className="hidden md:inline">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login" className="btn btn-primary text-sm">Sign in</Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 py-20">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--line)] text-xs font-medium text-[var(--muted)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] ring-4 ring-[rgba(42,157,143,.18)]" />
          Now accepting founding members
        </span>
        <h1 className="serif text-6xl leading-[1.02] my-5 max-w-3xl">
          Your AI C-Suite,{" "}
          <em className="italic" style={{ color: "var(--accent)" }}>customized for your business</em>{" "}
          in 30 minutes.
        </h1>
        <p className="text-lg text-[var(--muted)] max-w-xl mb-7">
          Replace a six-figure executive team with six AI executives — CMO, COO, CFO, CEO, CTO, and Aria your Chief of Staff — that know your brand voice, your numbers, and your goals.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="btn">Get founding member access →</Link>
          <Link href="#agents" className="btn btn-ghost">See how it works</Link>
        </div>
      </header>

      <section id="agents" className="mx-6 my-10 rounded-3xl py-24 px-6 lg:px-12 text-white" style={{ background: "var(--primary)" }}>
        <div className="max-w-6xl mx-auto">
          <span className="inline-block text-xs uppercase tracking-widest font-bold mb-3" style={{ color: "var(--gold)" }}>The Solution</span>
          <h2 className="serif text-5xl leading-tight max-w-2xl">
            Six AI executives. <em className="italic" style={{ color: "var(--gold)" }}>One subscription.</em> Trained on your business.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {AGENT_BLOCKS.map((b) => (
              <div key={b.role} className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.10)" }}>
                <div className="rounded-2xl flex items-center justify-center font-bold text-lg mb-4"
                     style={{ background: b.gradient, width: 52, height: 52, color: b.lightText ? "#1E2761" : "#fff" }}>
                  {b.name[0]}
                </div>
                <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,.55)" }}>
                  {b.role} · {b.name}
                </p>
                <h3 className="serif text-3xl my-2">{b.headline}</h3>
                <p className="italic text-white/80 mb-4">{b.tag}</p>
                <ul className="space-y-2.5 text-sm text-white/75">
                  {b.bullets.map((x) => (
                    <li key={x} className="pl-5 relative">
                      <span className="absolute left-0 font-bold" style={{ color: "var(--gold)" }}>→</span>{x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <span className="inline-block text-xs uppercase tracking-widest font-bold mb-3" style={{ color: "var(--accent)" }}>How it works</span>
        <h2 className="serif text-5xl leading-tight max-w-3xl">
          From signup to your{" "}
          <em className="italic" style={{ color: "var(--primary)" }}>first useful output</em>{" "}
          in under 30 minutes.
        </h2>
        <div className="grid md:grid-cols-5 gap-4 mt-12">
          {STEPS.map((s, i) => (
            <div key={s.h} className="card">
              <span className="text-[11px] font-semibold text-[var(--primary)] bg-[var(--soft)] px-2 py-0.5 rounded">{s.t}</span>
              <p className="serif text-4xl mt-2" style={{ color: "var(--accent)" }}>0{i + 1}</p>
              <h4 className="font-bold mt-1">{s.h}</h4>
              <p className="text-xs text-[var(--muted)] mt-1.5">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 text-center text-white" style={{ background: "var(--ink)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="serif text-5xl leading-tight">Be one of the first 100 founding members.</h2>
          <p className="text-lg mt-4 text-white/65">Lock in $47/mo lifetime. Setup fee waived for the first 30 seats.</p>
          <Link href="/login" className="btn inline-flex mt-7">Reserve your seat →</Link>
        </div>
      </section>

      <footer className="py-12 border-t border-[var(--line)]">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center text-sm text-[var(--muted)] flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="logo-mark" />
            <span className="font-bold" style={{ color: "var(--ink)" }}>Boardroom AI</span>
          </div>
          <span>© 2026 Boardroom AI. Built for operators.</span>
        </div>
      </footer>

      <ProspectChat />
    </div>
  );
}
