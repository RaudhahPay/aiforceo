"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Props = {
  workspaceName: string;
  hasKpiData: boolean;      // true if any KPI is non-zero
  hasBusinessProfile: boolean;
  hasBrandVoice: boolean;
  hasFinancials: boolean;
  hasConnectors: boolean;
};

const SETUP_STEPS = [
  {
    id: "profile",
    icon: "🏢",
    title: "Business Profile",
    desc: "Tell Aria about your business so your AI executives are briefed.",
    action: "/settings",
    actionLabel: "Go to Settings",
    ariaSuggestion: "Tell me about your business — industry, team size, and your 90-day goal.",
  },
  {
    id: "financials",
    icon: "📊",
    title: "Share Your Numbers",
    desc: "Upload a P&L screenshot or paste your numbers so Felix (CFO) can start analysing.",
    action: "/agent/aria",
    actionLabel: "Talk to Aria",
    ariaSuggestion: "Here's my latest P&L [attach a screenshot]. Can you update my dashboard?",
  },
  {
    id: "voice",
    icon: "✍️",
    title: "Brand Voice",
    desc: "Paste a sample of how you write so Maya (CMO) matches your tone.",
    action: "/settings",
    actionLabel: "Go to Settings → Voice",
    ariaSuggestion: "Here's how I usually write emails [paste sample]. Learn my brand voice.",
  },
  {
    id: "connectors",
    icon: "🔗",
    title: "Connect Your Tools",
    desc: "Link Google Sheets, QuickBooks, or other tools for live data.",
    action: "/connectors",
    actionLabel: "Go to Connectors",
    ariaSuggestion: "What tools can I connect to get live data into my dashboard?",
  },
  {
    id: "team",
    icon: "👥",
    title: "Invite Your Team",
    desc: "Add team members so they can chat with your AI executives too.",
    action: "/settings",
    actionLabel: "Go to Settings → Team",
    ariaSuggestion: "How do I invite my team members?",
  },
];

export function WelcomeGuide({
  workspaceName,
  hasKpiData,
  hasBusinessProfile,
  hasBrandVoice,
  hasFinancials,
  hasConnectors,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Calculate which steps are done
  const completedSteps = new Set<string>();
  if (hasBusinessProfile) completedSteps.add("profile");
  if (hasFinancials || hasKpiData) completedSteps.add("financials");
  if (hasBrandVoice) completedSteps.add("voice");
  if (hasConnectors) completedSteps.add("connectors");

  const allDone = completedSteps.size >= 4;
  const progress = Math.round((completedSteps.size / 5) * 100);

  if (dismissed || allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #7C3AED, #A855F7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 16, color: "#fff",
              }}
            >
              A
            </motion.div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Welcome to {workspaceName}! 👋
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                I&apos;m Aria, your Chief of Staff. Let me help you set up.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: "0 4px" }}
          title="Dismiss guide"
        >×</button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Setup progress</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{progress}%</span>
        </div>
        <div style={{ height: 6, background: "var(--panel2)", borderRadius: 3, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
            style={{ height: "100%", background: "var(--accent)", borderRadius: 3 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SETUP_STEPS.map((step, i) => {
          const done = completedSteps.has(step.id);
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                href={step.action}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: done ? "rgba(63,185,132,0.08)" : "var(--panel2)",
                  border: `1px solid ${done ? "rgba(63,185,132,0.2)" : "var(--line)"}`,
                  textDecoration: "none", color: "var(--ink)",
                  opacity: done ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>
                  {done ? "✅" : step.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, textDecoration: done ? "line-through" : "none" }}>
                    {step.title}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    {done ? "Done!" : step.desc}
                  </p>
                </div>
                {!done && (
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
                    {step.actionLabel} →
                  </span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick action — talk to Aria */}
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link
          href="/agent/aria"
          className="btn"
          style={{ textDecoration: "none" }}
        >
          💬 Or just chat with Aria — she&apos;ll guide you through everything
        </Link>
      </div>
    </motion.div>
  );
}
