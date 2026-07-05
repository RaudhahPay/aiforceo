"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CompanySnapshot } from "@/server/actions/portfolio";

const D = {
  bg: "#0a0e1a",
  panel: "#111827",
  panel2: "#1a2236",
  line: "#1e293b",
  gold: "#F0B429",
  text: "#e8edf6",
  dim: "#8597b8",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

function getHealthStatus(s: CompanySnapshot): "green" | "amber" | "red" {
  if (!s.hasKpiData) return "red";
  if (s.lastActivity) {
    const daysAgo =
      (Date.now() - new Date(s.lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo > 7) return "amber";
  }
  if (s.openTasks > 3) return "amber";
  return "green";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatRM(n: number | null): string {
  if (n == null) return "—";
  return `RM ${n.toLocaleString()}`;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const color = delta > 0 ? D.green : delta < 0 ? D.red : D.dim;
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}%
    </span>
  );
}

function CompanyCard({
  snapshot,
  onOpen,
  onBrief,
}: {
  snapshot: CompanySnapshot;
  onOpen: () => void;
  onBrief: () => void;
}) {
  const status = getHealthStatus(snapshot);
  const borderColor =
    status === "green" ? D.green : status === "amber" ? D.amber : D.red;

  return (
    <div
      style={{
        background: D.panel,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏢</span>
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: D.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {snapshot.name.toUpperCase()}
            </h3>
          </div>
          <p style={{ margin: "2px 0 0 24px", fontSize: 10, color: D.dim, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {snapshot.tier}
          </p>
        </div>
        {snapshot.isActive && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 20,
              background: D.gold + "22",
              color: D.gold,
              flexShrink: 0,
            }}
          >
            Active
          </span>
        )}
      </div>

      {/* KPI data */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
          padding: "12px 0",
          borderTop: `1px solid ${D.line}`,
          borderBottom: `1px solid ${D.line}`,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 10, color: D.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Revenue {snapshot.latestMonth ? `(${snapshot.latestMonth})` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: D.text, display: "flex", alignItems: "center", gap: 2 }}>
            {formatRM(snapshot.revenue)}
            <DeltaBadge delta={snapshot.momRevenueDelta} />
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: D.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Customers
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: D.text }}>
            {snapshot.customers != null ? snapshot.customers.toLocaleString() : "—"}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: D.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Cash In
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: D.text }}>
            {formatRM(snapshot.cashIn)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 10, color: D.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Headcount
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: D.text }}>
            {snapshot.headcount != null ? snapshot.headcount : "—"}
          </p>
        </div>
      </div>

      {/* Footer stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 11, color: snapshot.openTasks > 0 ? D.amber : D.dim, fontWeight: 600 }}>
            {snapshot.openTasks > 0 ? `${snapshot.openTasks} open task${snapshot.openTasks !== 1 ? "s" : ""}` : "No open tasks"}
          </span>
          <span style={{ fontSize: 11, color: D.dim }}>
            Last active: {timeAgo(snapshot.lastActivity)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onOpen}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: snapshot.isActive ? D.gold : D.panel2,
            color: snapshot.isActive ? D.bg : D.text,
            border: snapshot.isActive ? "none" : `1px solid ${D.line}`,
          }}
        >
          {snapshot.isActive ? "Open Dashboard" : "Switch & Open"}
        </button>
        <button
          onClick={onBrief}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: "transparent",
            color: D.gold,
            border: `1px solid ${D.gold}44`,
          }}
        >
          Brief Aria
        </button>
      </div>
    </div>
  );
}

export function PortfolioClient({
  snapshots,
  remaining,
  quota,
}: {
  snapshots: CompanySnapshot[];
  activeWorkspaceId: string;
  remaining: number;
  quota: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [briefLoading, setBriefLoading] = useState(false);

  const healthy = snapshots.filter((s) => getHealthStatus(s) === "green").length;
  const attention = snapshots.filter((s) => getHealthStatus(s) === "amber").length;
  const urgent = snapshots.filter((s) => getHealthStatus(s) === "red").length;

  async function handlePortfolioBrief() {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/portfolio-brief");
      if (!res.ok) throw new Error("Failed to load portfolio data");
      const { prompt } = (await res.json()) as { prompt: string };
      router.push(`/agent/aria?task=${encodeURIComponent(prompt)}`);
    } catch {
      setBriefLoading(false);
    }
  }

  function handleOpen(snapshot: CompanySnapshot) {
    if (snapshot.isActive) {
      router.push("/command");
    } else {
      startTransition(async () => {
        const form = new FormData();
        form.append("workspace_id", snapshot.workspaceId);
        const { switchWorkspace } = await import("@/server/actions/workspaces");
        await switchWorkspace(form);
      });
    }
  }

  function handleSingleBrief(snapshot: CompanySnapshot) {
    const prompt = `Give me a comprehensive executive brief for ${snapshot.name}. Cover financial performance, key metrics, open tasks, and your top 3 recommendations for this week.`;
    router.push(`/agent/aria?task=${encodeURIComponent(prompt)}`);
  }

  return (
    <main
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        padding: "24px 32px",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            CEO View
          </p>
          <h1 className="serif" style={{ margin: "2px 0 4px", fontSize: 28 }}>
            Portfolio Overview
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            {snapshots.length} {snapshots.length === 1 ? "company" : "companies"} · {healthy} healthy · {attention} need attention · {urgent} urgent
          </p>
        </div>

        <button
          onClick={handlePortfolioBrief}
          disabled={briefLoading || isPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: briefLoading ? "wait" : "pointer",
            background: briefLoading ? D.panel2 : D.gold,
            color: briefLoading ? D.dim : D.bg,
            border: "none",
            opacity: briefLoading ? 0.7 : 1,
            transition: "all 0.15s",
          }}
        >
          <span style={{ fontSize: 16 }}>📊</span>
          {briefLoading ? "Loading brief…" : "Get Portfolio Brief from Aria"}
        </button>
      </div>

      {/* Summary strips */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <SummaryTile
          label="Total Revenue (Latest Month)"
          value={`RM ${snapshots
            .reduce((sum, s) => sum + (s.revenue ?? 0), 0)
            .toLocaleString()}`}
          color={D.green}
        />
        <SummaryTile
          label="Total Open Tasks"
          value={String(snapshots.reduce((sum, s) => sum + s.openTasks, 0))}
          color={snapshots.reduce((s, c) => s + c.openTasks, 0) > 0 ? D.amber : D.green}
        />
        <SummaryTile
          label="AI Tokens Remaining"
          value={`${Math.round(remaining / 1000)}K / ${Math.round(quota / 1000)}K`}
          color={remaining < quota * 0.2 ? D.red : D.gold}
        />
      </div>

      {/* Company grid */}
      {snapshots.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: D.dim,
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 8 }}>No companies found.</p>
          <p style={{ fontSize: 13 }}>Create a workspace to get started.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {snapshots.map((s) => (
            <CompanyCard
              key={s.workspaceId}
              snapshot={s}
              onOpen={() => handleOpen(s)}
              onBrief={() => handleSingleBrief(s)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function SummaryTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: D.panel,
        border: `1px solid ${D.line}`,
        borderRadius: 14,
        padding: "14px 18px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 700,
          color: D.dim,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 22,
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </p>
    </div>
  );
}
