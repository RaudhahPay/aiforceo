"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboarding } from "@/server/actions/onboarding";

const CHALLENGES = [
  "Marketing & lead-gen",
  "Cash flow visibility",
  "Hiring & retention",
  "Time on operations",
  "Customer support",
  "Strategic decisions",
] as const;

const SIZES = [
  { v: "solo", l: "Solo (just me)" },
  { v: "small", l: "2–10 people" },
  { v: "mid", l: "11–50" },
  { v: "large", l: "51–250" },
  { v: "xlarge", l: "250+" },
] as const;

const INDUSTRIES = [
  "F&B — Café / Restaurant",
  "Education / Training",
  "E-commerce / Retail",
  "Professional Services",
  "SaaS / Tech",
  "Manufacturing",
  "Other",
];

const LAUNCH_AGENTS = [
  {
    role: "aria",
    name: "Aria",
    title: "Chief of Staff",
    tag: "Morning brief, open loops, board pack",
    g: ["#7C3AED", "#A855F7"] as const,
  },
  {
    role: "cmo",
    name: "Maya",
    title: "CMO",
    tag: "Content calendar, ad copy, brand voice",
    g: ["#F96167", "#FF9966"] as const,
  },
  {
    role: "cfo",
    name: "Felix",
    title: "CFO",
    tag: "P&L analysis, cash flow, scenarios",
    g: ["#5566B5", "#7B8AD4"] as const,
  },
  {
    role: "coo",
    name: "Owen",
    title: "COO",
    tag: "SOPs, auto-responders, ops digest",
    g: ["#2A9D8F", "#43BBAA"] as const,
  },
  {
    role: "ceo",
    name: "Eden",
    title: "CEO Advisor",
    tag: "Strategy, daily brief, decisions log",
    g: ["#C5A572", "#E2C28F"] as const,
  },
  {
    role: "cto",
    name: "Tariq",
    title: "CTO",
    tag: "Tech audit, automations, security",
    g: ["#0096C7", "#00BFFF"] as const,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]!);
  const [size, setSize] = useState<(typeof SIZES)[number]["v"]>("small");
  const [primaryOffer, setPrimaryOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [goals90d, setGoals90d] = useState("");
  const [voiceSample, setVoiceSample] = useState("");
  const [pnlText, setPnlText] = useState("");

  function toggleChallenge(c: string) {
    setChallenges((prev) =>
      prev.includes(c)
        ? prev.filter((x) => x !== c)
        : prev.length < 3
          ? [...prev, c]
          : prev,
    );
  }

  async function finish(firstAgent?: string) {
    setSaving(true);
    setErrorMsg("");
    const res = await saveOnboarding({
      businessName,
      industry,
      size,
      primaryOffer,
      targetCustomer,
      challenges,
      goals90d,
      voiceSample,
      pnlText,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      setSaving(false);
      return;
    }
    // Set active workspace cookie so getCurrentWorkspace() resolves to the new one
    if (res.workspaceId) {
      document.cookie = `ai4c_active_ws=${res.workspaceId};path=/;max-age=${60 * 60 * 24 * 365}`;
    }
    router.push("/command");
  }

  const progress = (step / 5) * 100;

  return (
    <main
      className="min-h-screen flex"
      style={{ background: "linear-gradient(135deg,#0F1729,#1E2761)" }}
    >
      <aside className="flex-1 max-w-lg p-12 flex flex-col justify-between text-white">
        <div className="flex items-center gap-2.5">
          <span className="logo-mark" style={{ background: "#fff" }} />
          <span className="font-bold text-lg">
            AI<span style={{ color: "var(--accent)" }}>for</span>CEO
          </span>
        </div>
        <div>
          <h1 className="serif text-5xl leading-tight">
            Let&apos;s deploy your{" "}
            <em style={{ color: "var(--gold)", fontStyle: "italic" }}>
              C-Suite.
            </em>
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-md">
            Under 30 minutes. Your six Command Executives will be briefed on
            your business, your voice, and your 90-day mission.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/50 font-semibold">
            Step {step} of 5
          </p>
          <div className="h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "var(--gold)" }}
            />
          </div>
          <div className="flex gap-2 mt-6">
            {["Profile", "Voice", "Numbers", "Connect", "Launch"].map(
              (label, i) => (
                <div
                  key={label}
                  className="flex-1 p-2 rounded-lg text-[11px] text-center font-semibold uppercase tracking-wider"
                  style={{
                    background:
                      step === i + 1
                        ? "var(--accent)"
                        : step > i + 1
                          ? "rgba(42,157,143,.25)"
                          : "rgba(255,255,255,.05)",
                    color:
                      step === i + 1
                        ? "#fff"
                        : step > i + 1
                          ? "var(--success)"
                          : "rgba(255,255,255,.6)",
                  }}
                >
                  {i + 1}. {label}
                </div>
              ),
            )}
          </div>
        </div>
      </aside>

      <section
        className="flex-1 p-12 flex items-center justify-center"
        style={{ background: "var(--bg)", borderRadius: "32px 0 0 32px" }}
      >
        <div className="card w-full max-w-lg">
          {/* ── Step 1: Business profile ── */}
          {step === 1 && (
            <>
              <h2 className="serif text-3xl mb-1">
                Tell us about your business.
              </h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                We&apos;ll customize every AI executive around these answers.
              </p>
              <Field label="Business name">
                <input
                  className="input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. DRE Coffee"
                />
              </Field>
              <Field label="What do you do?">
                <select
                  className="input"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                >
                  {INDUSTRIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Team size">
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setSize(s.v)}
                      className={`chip ${size === s.v ? "selected" : ""}`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="What's your main product or service?">
                <input
                  className="input"
                  value={primaryOffer}
                  onChange={(e) => setPrimaryOffer(e.target.value)}
                  placeholder="e.g. Specialty coffee & pastries, dine-in & takeaway"
                />
              </Field>
              <Field label="Who is your ideal customer?">
                <input
                  className="input"
                  value={targetCustomer}
                  onChange={(e) => setTargetCustomer(e.target.value)}
                  placeholder="e.g. Working professionals aged 25–40 in urban areas"
                />
              </Field>
              <Field label="Top 3 challenges right now (pick up to 3)">
                <div className="flex flex-wrap gap-2">
                  {CHALLENGES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChallenge(c)}
                      className={`chip ${challenges.includes(c) ? "selected" : ""}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Your #1 goal in the next 90 days">
                <textarea
                  className="input"
                  value={goals90d}
                  onChange={(e) => setGoals90d(e.target.value)}
                  placeholder="e.g. Open second outlet, hit RM 200K monthly revenue…"
                />
              </Field>
              <Nav
                onNext={() => setStep(2)}
                canNext={businessName.length > 0}
              />
            </>
          )}

          {/* ── Step 2: Brand voice ── */}
          {step === 2 && (
            <>
              <h2 className="serif text-3xl mb-1">Now your brand voice.</h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                Paste any sample of how you already write — emails, website
                copy, captions. Your AI executives will match your tone on every
                output.
              </p>
              <Field label="Paste a sample (200–800 words is ideal)">
                <textarea
                  className="input"
                  style={{ minHeight: 200 }}
                  value={voiceSample}
                  onChange={(e) => setVoiceSample(e.target.value)}
                  placeholder="Paste an email, a webpage, or a recent caption…"
                />
              </Field>
              <Nav
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                canNext={voiceSample.length > 50}
              />
            </>
          )}

          {/* ── Step 3: P&L ── */}
          {step === 3 && (
            <>
              <h2 className="serif text-3xl mb-1">Drop your latest P&amp;L.</h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                Paste your most recent P&amp;L. Felix will produce a board-level
                analysis the moment you open his chat.
              </p>
              <Field label="P&L (text or CSV)">
                <textarea
                  className="input"
                  style={{ minHeight: 200 }}
                  value={pnlText}
                  onChange={(e) => setPnlText(e.target.value)}
                  placeholder={"Revenue: 184,200\nCOGS: 71,840\n…"}
                />
              </Field>
              <p className="text-xs text-[var(--muted)] mt-2">
                Optional — you can paste it later in Settings.
              </p>
              <Nav
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                canNext
              />
            </>
          )}

          {/* ── Step 4: Connectors ── */}
          {step === 4 && (
            <>
              <h2 className="serif text-3xl mb-1">Connect your tools.</h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                Optional — connect anytime from the Connectors page inside the
                app.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Gmail",
                  "Stripe",
                  "Xero",
                  "QuickBooks",
                  "Meta Ads",
                  "Google Analytics",
                  "WhatsApp",
                  "Slack",
                  "Notion",
                  "Calendly",
                ].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="chip"
                    style={{
                      justifyContent: "flex-start",
                      display: "flex",
                      padding: "12px 14px",
                      borderRadius: 12,
                    }}
                    onClick={(e) =>
                      (e.currentTarget as HTMLButtonElement).classList.toggle(
                        "selected",
                      )
                    }
                  >
                    + {p}
                  </button>
                ))}
              </div>
              <Nav
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                canNext
              />
            </>
          )}

          {/* ── Step 5: Launch ── */}
          {step === 5 && (
            <>
              <h2 className="serif text-3xl mb-1">Your AI C-Suite is ready.</h2>
              <p className="text-sm text-[var(--muted)] mb-5">
                Six executives briefed on{" "}
                <strong>{businessName || "your business"}</strong>. Pick one to
                start with now, or go straight to the dashboard.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {LAUNCH_AGENTS.map((a) => (
                  <button
                    key={a.role}
                    type="button"
                    disabled={saving}
                    onClick={() => finish(a.role)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 12,
                      cursor: saving ? "default" : "pointer",
                      background: "var(--soft)",
                      border: "1px solid var(--line)",
                      textAlign: "left",
                      opacity: saving ? 0.5 : 1,
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        background: `linear-gradient(135deg, ${a.g[0]}, ${a.g[1]})`,
                        color: a.role === "ceo" ? "#1E2761" : "#fff",
                      }}
                    >
                      {a.name[0]}
                    </span>
                    <div style={{ minWidth: 0, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                        {a.name} · {a.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 10,
                          color: "var(--muted)",
                          lineHeight: 1.3,
                        }}
                      >
                        {a.tag}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {errorMsg && (
                <p className="text-sm mb-3" style={{ color: "var(--red)" }}>
                  {errorMsg}
                </p>
              )}

              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setStep(4)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => finish()}
                  disabled={saving}
                >
                  {saving ? "Setting up…" : "Go to dashboard →"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  canNext,
}: {
  onBack?: () => void;
  onNext?: () => void;
  canNext?: boolean;
}) {
  return (
    <div className="flex justify-between mt-6 gap-3">
      {onBack ? (
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={onNext}
        disabled={!canNext}
      >
        Next →
      </button>
    </div>
  );
}
