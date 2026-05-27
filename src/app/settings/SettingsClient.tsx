"use client";

import { useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/server/actions/settings";
import { createPortalSession } from "@/server/actions/billing";

/* ─── CONSTANTS ─────────────────────────────────────────────── */
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

const TIER_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

const TIER_TOKENS: Record<string, number> = {
  trial: 100_000,
  starter: 500_000,
  growth: 2_000_000,
  scale: 8_000_000,
};

const TIER_COLOR: Record<string, string> = {
  trial: "#94a3b8",
  starter: "#0096C7",
  growth: "#7C3AED",
  scale: "#F96167",
};

const AGENT_LABEL: Record<string, string> = {
  aria: "Aria — Chief of Staff",
  cmo: "CMO",
  coo: "COO",
  cfo: "CFO",
  ceo: "CEO",
  cto: "CTO",
};

/* ─── TYPES ─────────────────────────────────────────────────── */
type Initial = {
  businessName: string;
  industry: string;
  size: "solo" | "small" | "mid" | "large" | "xlarge";
  challenges: string[];
  goals90d: string;
  primaryOffer: string;
  targetCustomer: string;
  voiceSample: string;
  voiceSummary: string;
  pnlText: string;
  pnlPeriod: string;
};

type LedgerEntry = {
  deltaTokens: number;
  reason: string;
  createdAt: string;
  invoiceId: string | null;
};

type AgentUsage = { role: string; count: number };

/* ─── HELPERS ───────────────────────────────────────────────── */
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtReason(reason: string): string {
  switch (reason) {
    case "monthly_reset":
      return "Monthly quota";
    case "topup":
      return "Top-up purchase";
    case "chat":
      return "AI usage";
    default:
      return reason;
  }
}

/* ─── SUB-COMPONENTS ────────────────────────────────────────── */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─── USAGE TAB ─────────────────────────────────────────────── */
function UsageTab({
  remaining,
  quota,
  tier,
  usageByAgent,
  ledger,
}: {
  remaining: number;
  quota: number;
  tier: string;
  usageByAgent: AgentUsage[];
  ledger: LedgerEntry[];
}) {
  const used = Math.max(0, quota - remaining);
  const usedPct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const remainPct = Math.round((remaining / Math.max(quota, 1)) * 100);
  const barColor =
    remainPct > 30 ? "#3FB984" : remainPct > 10 ? "#E5A93C" : "#E5544B";

  // Only show AI-usage ledger entries (negative delta = consumption)
  const usageEntries = ledger.filter((r) => r.reason === "chat");
  const totalUsedTokens = usageEntries.reduce(
    (a, r) => a + Math.abs(r.deltaTokens),
    0,
  );

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      {/* Quota bar */}
      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            AI Token Quota —{" "}
            <span style={{ color: TIER_COLOR[tier] ?? "var(--accent)" }}>
              {TIER_LABEL[tier] ?? tier} plan
            </span>
          </h3>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {fmtNum(remaining)} / {fmtNum(quota)} remaining
          </span>
        </div>
        <div
          style={{
            background: "var(--soft)",
            borderRadius: 8,
            height: 12,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${usedPct}%`,
              height: "100%",
              background: barColor,
              borderRadius: 8,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          <span>{fmtNum(used)} used this month</span>
          <span style={{ color: barColor, fontWeight: 700 }}>
            {remainPct}% remaining
          </span>
        </div>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          Tokens reset on the 1st of each month.{" "}
          <Link href="/pricing" style={{ color: "var(--accent)" }}>
            Upgrade for more →
          </Link>
        </p>
      </div>

      {/* Usage by agent */}
      {usageByAgent.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Messages by Executive — MTD
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {usageByAgent.map(({ role, count }) => {
              const maxCount = usageByAgent[0]?.count ?? 1;
              return (
                <div key={role}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {AGENT_LABEL[role] ?? role.toUpperCase()}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {count} response{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div
                    style={{
                      background: "var(--soft)",
                      borderRadius: 6,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        height: "100%",
                        background: "var(--accent)",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            Total AI responses this month:{" "}
            {usageByAgent.reduce((a, u) => a + u.count, 0)}
          </p>
        </div>
      )}

      {/* Credit ledger */}
      <div className="card" style={{ padding: 24 }}>
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Token Ledger
        </h3>
        {ledger.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No activity yet.
          </p>
        ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {["Date", "Type", "Tokens"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 2 ? "right" : "left",
                      padding: "6px 8px",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry, i) => {
                const positive = entry.deltaTokens > 0;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td
                      style={{
                        padding: "9px 8px",
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: "9px 8px" }}>
                      {fmtReason(entry.reason)}
                    </td>
                    <td
                      style={{
                        padding: "9px 8px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: positive ? "#3FB984" : "#E5544B",
                      }}
                    >
                      {positive ? "+" : ""}
                      {fmtNum(entry.deltaTokens)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalUsedTokens > 0 && (
          <p style={{ marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
            Total consumed (all time): {fmtNum(totalUsedTokens)} tokens
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── BILLING TAB ───────────────────────────────────────────── */
function BillingTab({
  tier,
  stripeCustomerId,
  stripeSubscriptionId,
  ledger,
}: {
  tier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  ledger: LedgerEntry[];
}) {
  const isTrial = tier === "trial";
  const hasSubscription = Boolean(stripeSubscriptionId);

  const billingEntries = ledger.filter(
    (r) => r.reason === "monthly_reset" || r.reason === "topup",
  );

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      {/* Plan card */}
      <div className="card" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Current Plan
            </p>
            <h3
              style={{
                margin: "4px 0 0",
                fontSize: 22,
                fontWeight: 700,
                color: TIER_COLOR[tier] ?? "var(--accent)",
              }}
            >
              {TIER_LABEL[tier] ?? tier}
            </h3>
          </div>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: (TIER_COLOR[tier] ?? "#94a3b8") + "20",
              color: TIER_COLOR[tier] ?? "#94a3b8",
              border: `1px solid ${(TIER_COLOR[tier] ?? "#94a3b8") + "40"}`,
            }}
          >
            {hasSubscription ? "ACTIVE" : "FREE TRIAL"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
            padding: "14px 0",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Monthly Tokens
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
              {fmtNum(TIER_TOKENS[tier] ?? 100_000)}
            </p>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              AI Executives
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>
              {tier === "starter" ? "3 of 6" : "All 6"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {hasSubscription && stripeCustomerId ? (
            <form action={createPortalSession}>
              <button type="submit" className="btn btn-primary">
                Manage subscription →
              </button>
            </form>
          ) : (
            <Link
              href="/pricing"
              className="btn btn-primary"
              style={{ textDecoration: "none" }}
            >
              {isTrial ? "Upgrade plan →" : "Manage billing →"}
            </Link>
          )}
          {!isTrial && (
            <Link
              href="/pricing"
              className="btn"
              style={{ textDecoration: "none" }}
            >
              View all plans
            </Link>
          )}
        </div>
      </div>

      {/* Token top-up */}
      <div className="card" style={{ padding: 24, background: "var(--soft)" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>
          Need more tokens?
        </h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>
          Top-up packs are available in addition to your monthly quota. Unused
          top-up tokens carry forward.
        </p>
        <Link
          href="/pricing"
          className="btn"
          style={{ textDecoration: "none", fontSize: 13 }}
        >
          View top-up options
        </Link>
      </div>

      {/* Billing history */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
          Billing History
        </h3>
        {billingEntries.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            No billing history yet.{" "}
            {isTrial && (
              <Link href="/pricing" style={{ color: "var(--accent)" }}>
                Upgrade to get started →
              </Link>
            )}
          </p>
        ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {["Date", "Description", "Tokens"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 2 ? "right" : "left",
                      padding: "6px 8px",
                      color: "var(--muted)",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingEntries.map((entry, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td
                    style={{
                      padding: "9px 8px",
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtDate(entry.createdAt)}
                  </td>
                  <td style={{ padding: "9px 8px" }}>
                    {fmtReason(entry.reason)}
                    {entry.invoiceId && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          marginLeft: 6,
                        }}
                      >
                        #{entry.invoiceId.slice(-8)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "9px 8px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#3FB984",
                    }}
                  >
                    +{fmtNum(entry.deltaTokens)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── TEAM TAB ──────────────────────────────────────────────── */
function TeamTab({ ownerEmail }: { ownerEmail: string }) {
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      {/* Owner card */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700 }}>
          Current Members
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 14px",
            background: "var(--soft)",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {ownerEmail.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
              {ownerEmail}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Owner · Full access
            </p>
          </div>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              background: "rgba(63,185,132,0.12)",
              color: "#3FB984",
            }}
          >
            OWNER
          </span>
        </div>
      </div>

      {/* Invite coming soon */}
      <div
        className="card"
        style={{
          padding: 28,
          border: "2px dashed var(--line)",
          background: "var(--soft)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>
          Team Invites — Coming Soon
        </h3>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 13,
            color: "var(--muted)",
            maxWidth: 480,
            marginInline: "auto",
            lineHeight: 1.6,
          }}
        >
          Invite team members to view reports and chat with your AI C-Suite.
          Assign roles — <strong>Viewer</strong>, <strong>Editor</strong>, or{" "}
          <strong>Manager</strong> — per workspace.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Available on Starter plan and above.
        </p>
      </div>

      {/* What's coming */}
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700 }}>
          Planned roles
        </h4>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            {
              role: "Manager",
              desc: "Full access — edit profile, view all dashboards, chat with all AI execs",
              color: "#7C3AED",
            },
            {
              role: "Editor",
              desc: "Edit KPIs and chat with AI execs, cannot change billing or team",
              color: "#0096C7",
            },
            {
              role: "Viewer",
              desc: "Read-only — view dashboards and conversation history",
              color: "#3FB984",
            },
          ].map(({ role, desc, color }) => (
            <div
              key={role}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                background: "var(--soft)",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  background: color + "18",
                  color,
                  whiteSpace: "nowrap",
                  marginTop: 1,
                }}
              >
                {role.toUpperCase()}
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export function SettingsClient({
  workspaceId,
  tier,
  remaining,
  quota,
  stripeCustomerId,
  stripeSubscriptionId,
  ledger,
  usageByAgent,
  ownerEmail,
  initial,
}: {
  workspaceId: string;
  tier: string;
  remaining: number;
  quota: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  ledger: LedgerEntry[];
  usageByAgent: AgentUsage[];
  ownerEmail: string;
  initial: Initial;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "profile" | "voice" | "financials" | "usage" | "billing" | "team"
  >("profile");

  function field(k: keyof typeof form) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function toggleChallenge(c: string) {
    setForm((f) => ({
      ...f,
      challenges: f.challenges.includes(c)
        ? f.challenges.filter((x) => x !== c)
        : f.challenges.length < 3
          ? [...f.challenges, c]
          : f.challenges,
    }));
  }

  async function save() {
    setSaving(true);
    setSuccess(false);
    setError("");
    const res = await updateProfile(form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  const isProfileTab = ["profile", "voice", "financials"].includes(activeTab);

  const TABS: Array<{ key: typeof activeTab; label: string }> = [
    { key: "profile", label: "Company Profile" },
    { key: "voice", label: "Brand Voice" },
    { key: "financials", label: "Financials" },
    { key: "usage", label: "Usage" },
    { key: "billing", label: "Billing" },
    { key: "team", label: "Team" },
  ];

  const tabStyle = (t: typeof activeTab): React.CSSProperties => ({
    padding: "9px 18px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--line)",
    background: activeTab === t ? "var(--accent)" : "transparent",
    color: activeTab === t ? "#0E1726" : "var(--muted)",
    whiteSpace: "nowrap",
  });

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            style={tabStyle(key)}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {activeTab === "profile" && (
        <div
          className="card"
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 680,
          }}
        >
          <Field label="Business name">
            <input
              className="input"
              value={form.businessName}
              onChange={field("businessName")}
              placeholder="e.g. DRE Coffee"
            />
          </Field>
          <Field label="Industry">
            <select
              className="input"
              value={form.industry}
              onChange={field("industry")}
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
                  onClick={() => setForm((f) => ({ ...f, size: s.v }))}
                  className={`chip ${form.size === s.v ? "selected" : ""}`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Primary offer (what do you sell?)">
            <input
              className="input"
              value={form.primaryOffer}
              onChange={field("primaryOffer")}
              placeholder="e.g. Specialty coffee + café experience"
            />
          </Field>
          <Field label="Target customer">
            <input
              className="input"
              value={form.targetCustomer}
              onChange={field("targetCustomer")}
              placeholder="e.g. Young professionals aged 25–40"
            />
          </Field>
          <Field label="Top challenges (pick up to 3)">
            <div className="flex flex-wrap gap-2">
              {CHALLENGES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChallenge(c)}
                  className={`chip ${form.challenges.includes(c) ? "selected" : ""}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="90-day goal">
            <textarea
              className="input"
              value={form.goals90d}
              onChange={field("goals90d")}
              placeholder="e.g. Open second outlet, hit RM 200K monthly revenue…"
            />
          </Field>
        </div>
      )}

      {/* ── Voice tab ── */}
      {activeTab === "voice" && (
        <div
          className="card"
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 680,
          }}
        >
          {form.voiceSummary && (
            <div
              style={{
                background: "rgba(212,160,23,0.08)",
                border: "1px solid rgba(212,160,23,0.25)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Current voice summary
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {form.voiceSummary}
              </p>
            </div>
          )}
          <Field label="Paste a new writing sample to re-train your brand voice">
            <textarea
              className="input"
              style={{ minHeight: 220 }}
              value={form.voiceSample}
              onChange={field("voiceSample")}
              placeholder="Paste emails, website copy, captions, or any text that sounds like you… (200–800 words is ideal)"
            />
          </Field>
          <p className="text-xs text-[var(--muted)]">
            Saving a new sample will re-extract your tone, signature words, and
            style using AI. The update takes effect on your next message.
          </p>
        </div>
      )}

      {/* ── Financials tab ── */}
      {activeTab === "financials" && (
        <div
          className="card"
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 680,
          }}
        >
          {form.pnlPeriod && (
            <div
              style={{
                background: "rgba(63,185,132,0.08)",
                border: "1px solid rgba(63,185,132,0.25)",
                borderRadius: 10,
                padding: "12px 16px",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--success)",
                  margin: 0,
                }}
              >
                ✓ P&amp;L on file: {form.pnlPeriod}
              </p>
            </div>
          )}
          <Field label="Paste your latest P&L (text or CSV)">
            <textarea
              className="input"
              style={{ minHeight: 240 }}
              value={form.pnlText}
              onChange={field("pnlText")}
              placeholder={
                "Revenue: 184,200\nCOGS: 71,840\nGross Profit: 112,360\nRent: 18,000\nSalaries: 45,000\nUtilities: 3,200\nMarketing: 8,500\nNet Profit: 37,660"
              }
            />
          </Field>
          <p className="text-xs text-[var(--muted)]">
            Felix (CFO) will reference these numbers directly in every financial
            analysis. Paste updated figures each month.
          </p>
        </div>
      )}

      {/* ── Usage tab ── */}
      {activeTab === "usage" && (
        <UsageTab
          remaining={remaining}
          quota={quota}
          tier={tier}
          usageByAgent={usageByAgent}
          ledger={ledger}
        />
      )}

      {/* ── Billing tab ── */}
      {activeTab === "billing" && (
        <BillingTab
          tier={tier}
          stripeCustomerId={stripeCustomerId}
          stripeSubscriptionId={stripeSubscriptionId}
          ledger={ledger}
        />
      )}

      {/* ── Team tab ── */}
      {activeTab === "team" && <TeamTab ownerEmail={ownerEmail} />}

      {/* Save bar — only for profile/voice/financials */}
      {isProfileTab && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
          }}
        >
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {success && (
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}
            >
              ✓ Saved — your AI executives will use these details on the next
              message.
            </span>
          )}
          {error && (
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}
            >
              ⚠ {error}
            </span>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 28 }}>
        Workspace ID: <code style={{ fontSize: 11 }}>{workspaceId}</code>
      </p>
    </div>
  );
}
