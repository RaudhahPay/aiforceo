// Public marketing landing page — Grok-inspired: dark, centered, minimal.
import Link from "next/link";
import { ProspectChat } from "@/app/_components/ProspectChat";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AIforCEO",
  applicationCategory: "BusinessApplication",
  description:
    "Six AI Command Executives — CMO, COO, CFO, CEO, CTO, and Aria Chief of Staff — briefed on your business in under 30 minutes. You're the Founder. They execute.",
  offers: { "@type": "Offer", price: "47", priceCurrency: "USD" },
  operatingSystem: "Web",
};

const EXECUTIVES = [
  { role: "CMO", name: "Maya", color: "#F96167" },
  { role: "COO", name: "Owen", color: "#2A9D8F" },
  { role: "CFO", name: "Felix", color: "#5566B5" },
  { role: "CEO", name: "Eden", color: "#C5A572" },
  { role: "CTO", name: "Tariq", color: "#0096C7" },
  { role: "CoS", name: "Aria", color: "#7C3AED" },
] as const;

const EXEC_DETAIL = [
  {
    role: "CMO",
    name: "Maya",
    color: "#F96167",
    headline: "Marketing that executes itself.",
    bullets: [
      "30-day content calendar — ready to publish",
      "Ad copy: 30 variations, A/B ready, on brief",
      "Brand voice enforced on every output",
    ],
  },
  {
    role: "COO",
    name: "Owen",
    color: "#2A9D8F",
    headline: "Operations at zero exceptions.",
    bullets: [
      "Auto-responder templates for WhatsApp, email, IG",
      "Invoice escalation — 3-tier, polite but firm",
      "Daily ops digest delivered at 7am",
    ],
  },
  {
    role: "CFO",
    name: "Felix",
    color: "#5566B5",
    headline: "P&L clarity in 60 seconds.",
    bullets: [
      "P&L audit: signal extracted, cuts recommended",
      "30/60/90-day cash flow forecast from live data",
      "Scenario modelling: hire, expand, raise prices",
    ],
  },
  {
    role: "CEO",
    name: "Eden",
    color: "#C5A572",
    headline: "Strategy briefed every morning.",
    bullets: [
      "Daily 7am brief: numbers, priorities, risks",
      "Strategic Q&A with full business context",
      "Decision log: captures the why — forever",
    ],
  },
  {
    role: "CTO",
    name: "Tariq",
    color: "#0096C7",
    headline: "Tech ROI, not tech jargon.",
    bullets: [
      "Systems audit: map tools, cut duplicates",
      "Top 3 automations — tool, cost, timeline",
      "Security hygiene checklist for your scale",
    ],
  },
  {
    role: "Chief of Staff",
    name: "Aria",
    color: "#7C3AED",
    headline: "Nothing slips. Ever.",
    bullets: [
      "Morning brief across all 5 executive areas",
      "Open loops tracker — no action falls through",
      "Board pack assembled before the meeting",
    ],
  },
] as const;

const BG = "#050507";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#f0f2f7";
const MUTED = "rgba(240,242,247,0.45)";
const GOLD = "#c5a572";

export default function Home() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(5,5,7,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 800,
              fontSize: 16,
              color: TEXT,
              textDecoration: "none",
              letterSpacing: "-0.3px",
            }}
          >
            <span className="logo-mark" />
            AI<span style={{ color: GOLD }}>for</span>CEO
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 14,
            }}
          >
            <Link
              href="/pricing"
              style={{ color: MUTED, textDecoration: "none", fontWeight: 500 }}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              style={{
                color: MUTED,
                textDecoration: "none",
                fontWeight: 500,
                padding: "6px 14px",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              style={{
                background: GOLD,
                color: "#0a0a0f",
                fontWeight: 700,
                fontSize: 13,
                padding: "7px 16px",
                borderRadius: 999,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Claim seat →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div
        style={{
          minHeight: "calc(100vh - 60px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 24px 80px",
          textAlign: "center",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 32,
          }}
        >
          <span
            className="logo-mark"
            style={{ width: 44, height: 44, flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: "-2.5px",
              lineHeight: 1,
              color: TEXT,
            }}
          >
            AI<span style={{ color: GOLD }}>for</span>CEO
          </span>
        </div>

        {/* Tagline */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 500,
            lineHeight: 1.4,
            maxWidth: 520,
            margin: "0 0 10px",
            color: TEXT,
            letterSpacing: "-0.3px",
          }}
        >
          Six AI Command Executives, briefed on your business in 30 minutes.
        </h1>
        <p style={{ fontSize: 16, color: MUTED, margin: "0 0 40px" }}>
          You&apos;re the Founder. They execute.
        </p>

        {/* Inline chat — the centerpiece */}
        <ProspectChat inline />

        {/* Exec chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 28,
            maxWidth: 620,
          }}
        >
          {EXECUTIVES.map((e) => (
            <div
              key={e.role}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 12px 6px 7px",
                borderRadius: 999,
                background: SURFACE,
                border: BORDER,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: e.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {e.name[0]}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT,
                  lineHeight: 1,
                }}
              >
                {e.name}
              </span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1 }}>
                {e.role}
              </span>
            </div>
          ))}
        </div>

        {/* Founding member card */}
        <div
          style={{
            marginTop: 36,
            maxWidth: 560,
            width: "100%",
            borderRadius: 16,
            background: "rgba(197,165,114,0.06)",
            border: "1px solid rgba(197,165,114,0.2)",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: GOLD,
                margin: "0 0 4px",
              }}
            >
              Founding Member Offer
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: TEXT,
                margin: "0 0 3px",
                letterSpacing: "-0.3px",
              }}
            >
              $47 / month, locked for life
            </p>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Setup fee waived · All 6 executives · First 30 seats only
            </p>
          </div>
          <Link
            href="/login"
            style={{
              background: GOLD,
              color: "#0a0a0f",
              fontWeight: 700,
              fontSize: 13,
              padding: "9px 20px",
              borderRadius: 999,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Reserve seat →
          </Link>
        </div>
      </div>

      {/* ── Divider ── */}
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          borderTop: BORDER,
          padding: "0 24px",
        }}
      />

      {/* ── Exec grid ── */}
      <section
        style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px" }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 12,
          }}
        >
          Your Command Executives
        </p>
        <h2
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            maxWidth: 520,
            marginBottom: 56,
            color: TEXT,
          }}
        >
          Six executives. One directive: grow your business.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {EXEC_DETAIL.map((ex) => (
            <div
              key={ex.role}
              style={{
                borderRadius: 18,
                padding: "28px 28px 24px",
                background: SURFACE,
                border: BORDER,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: ex.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {ex.name[0]}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: MUTED,
                      margin: "0 0 2px",
                    }}
                  >
                    {ex.role} · {ex.name}
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: TEXT,
                      margin: 0,
                      letterSpacing: "-0.2px",
                    }}
                  >
                    {ex.headline}
                  </p>
                </div>
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {ex.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      fontSize: 13,
                      color: MUTED,
                      paddingLeft: 16,
                      position: "relative",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: ex.color,
                        fontWeight: 700,
                      }}
                    >
                      ·
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            background: SURFACE,
            border: BORDER,
            padding: "48px 48px 48px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: GOLD,
              marginBottom: 10,
            }}
          >
            Setup
          </p>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-1px",
              lineHeight: 1.1,
              color: TEXT,
              marginBottom: 40,
            }}
          >
            From zero to a fully-briefed C-Suite in under 30 minutes.
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 4,
            }}
          >
            {[
              {
                t: "8 min",
                h: "Profile",
                b: "Industry, size, top challenges, 90-day goals.",
              },
              {
                t: "6 min",
                h: "Voice",
                b: "Drop your website or paste a sample.",
              },
              {
                t: "5 min",
                h: "Financials",
                b: "Upload your latest P&L. CFO analyzes live.",
              },
              {
                t: "6 min",
                h: "Connectors",
                b: "One-click OAuth to your tools.",
              },
              {
                t: "5 min",
                h: "First output",
                b: "Pick one. Receive it before you finish.",
              },
            ].map((s, i) => (
              <div key={s.h} style={{ padding: "16px 12px" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: GOLD,
                    background: "rgba(197,165,114,0.1)",
                    padding: "3px 8px",
                    borderRadius: 999,
                  }}
                >
                  {s.t}
                </span>
                <p
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "rgba(240,242,247,0.12)",
                    margin: "8px 0 4px",
                    letterSpacing: "-1px",
                  }}
                >
                  0{i + 1}
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: TEXT,
                    margin: "0 0 4px",
                  }}
                >
                  {s.h}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {s.b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "0 24px 100px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            padding: "72px 24px",
            background: "rgba(197,165,114,0.05)",
            border: "1px solid rgba(197,165,114,0.15)",
          }}
        >
          <h2
            style={{
              fontSize: 42,
              fontWeight: 900,
              letterSpacing: "-2px",
              lineHeight: 1.05,
              color: TEXT,
              marginBottom: 14,
            }}
          >
            Be one of the first 30 founding members.
          </h2>
          <p style={{ fontSize: 17, color: MUTED, marginBottom: 32 }}>
            $47/mo locked for life. Setup fee waived. Price never increases
            after you claim your seat.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              background: GOLD,
              color: "#0a0a0f",
              fontWeight: 800,
              fontSize: 15,
              padding: "14px 36px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "-0.2px",
            }}
          >
            Claim founding seat →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: BORDER,
          padding: "28px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="logo-mark" style={{ opacity: 0.6 }} />
            <span style={{ fontWeight: 700, color: TEXT }}>AIforCEO</span>
          </div>
          <span>© 2026 AIforCEO. The C-Suite by AI.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link
              href="/pricing"
              style={{ color: MUTED, textDecoration: "none" }}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              style={{ color: MUTED, textDecoration: "none" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
