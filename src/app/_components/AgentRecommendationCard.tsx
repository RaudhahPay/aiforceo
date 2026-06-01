"use client";

import Link from "next/link";
import { AGENTS, type AgentRole } from "@/lib/prompts";

type Props = {
  role: AgentRole;
  insight: string;
  actionLabel: string;
  actionHref?: string;
};

export function AgentRecommendationCard({ role, insight, actionLabel, actionHref }: Props) {
  const agent = AGENTS[role];
  const grad = `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`;

  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "16px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minWidth: 0,
    }}>
      {/* Agent header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: grad,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 15,
          color: role === "ceo" ? "#1E2761" : "#fff",
          flexShrink: 0,
        }}>
          {agent.name[0]}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{agent.name}</p>
          <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>{agent.title.replace("AI ", "")}</p>
        </div>
      </div>

      {/* Insight */}
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5, flex: 1 }}>
        {insight}
      </p>

      {/* Action button */}
      <Link
        href={actionHref ?? `/agent/${role}`}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "7px 14px", borderRadius: 8,
          background: `${agent.gradient[0]}18`,
          border: `1px solid ${agent.gradient[0]}30`,
          color: agent.gradient[0],
          fontSize: 11, fontWeight: 700,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
