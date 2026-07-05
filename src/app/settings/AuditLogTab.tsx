"use client";

import { useState } from "react";
import type { AuditLogEntry } from "@/server/actions/audit";
import type { AuditAction } from "@/lib/audit";

/* ─── CONSTANTS ─────────────────────────────────────────────── */

type FilterKey = "all" | "kpi" | "tasks" | "agents" | "system";

const FILTER_TABS: Array<{ key: FilterKey; label: string }> = [
  { key: "all",    label: "All" },
  { key: "kpi",    label: "KPI Changes" },
  { key: "tasks",  label: "Tasks" },
  { key: "agents", label: "Agent Actions" },
  { key: "system", label: "System" },
];

const ACTION_CATEGORY: Record<AuditAction, FilterKey> = {
  "kpi.update":                    "kpi",
  "kpi.create":                    "kpi",
  "task.create":                   "tasks",
  "task.status_change":            "tasks",
  "task.update":                   "tasks",
  "task.delete":                   "tasks",
  "conversation.create":           "system",
  "conversation.summary_generated":"system",
  "memory.extract":                "system",
  "memory.delete":                 "system",
  "workspace.settings_change":     "system",
  "agent.delegation":              "agents",
  "agent.kpi_update_applied":      "agents",
};

const ACTION_COLOR: Record<FilterKey, string> = {
  all:    "var(--accent)",
  kpi:    "#0096C7",
  tasks:  "#7C3AED",
  agents: "#F0B429",
  system: "var(--muted)",
};

const AGENT_INITIAL: Record<string, string> = {
  aria: "A",
  cmo:  "C",
  coo:  "O",
  cfo:  "F",
  ceo:  "E",
  cto:  "T",
};

/* ─── HELPERS ────────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function actionLabel(action: AuditAction): string {
  return action.replace(".", " ").replace(/_/g, " ");
}

/* ─── ACTOR ICON ─────────────────────────────────────────────── */

function ActorIcon({ actorType, agentRole }: { actorType: string; agentRole: string | null }) {
  if (actorType === "user") {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "rgba(0,150,199,0.15)", border: "1px solid rgba(0,150,199,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, flexShrink: 0,
      }}>
        👤
      </div>
    );
  }
  if (actorType === "agent" && agentRole) {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "rgba(240,180,41,0.15)", border: "1px solid rgba(240,180,41,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#F0B429", flexShrink: 0,
      }}>
        {AGENT_INITIAL[agentRole] ?? agentRole.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, flexShrink: 0,
    }}>
      ⚙
    </div>
  );
}

/* ─── ENTRY ROW ──────────────────────────────────────────────── */

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const category = ACTION_CATEGORY[entry.action] ?? "system";
  const color = ACTION_COLOR[category];
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "var(--soft)",
        borderRadius: 10,
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Actor icon */}
        <ActorIcon actorType={entry.actorType} agentRole={entry.agentRole} />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Action badge */}
            <span style={{
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: `${color}20`,
              color,
              border: `1px solid ${color}40`,
              flexShrink: 0,
            }}>
              {actionLabel(entry.action)}
            </span>
            {/* Timestamp */}
            <span
              title={absoluteTime(entry.createdAt)}
              style={{ fontSize: 11, color: "var(--muted)", cursor: "default" }}
            >
              {timeAgo(entry.createdAt)}
            </span>
          </div>
          {/* Summary */}
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
            {entry.summary}
          </p>
          {/* Expandable metadata */}
          {hasMetadata && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "var(--muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
          {expanded && hasMetadata && (
            <pre style={{
              marginTop: 8,
              fontSize: 11,
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "10px 12px",
              overflowX: "auto",
              color: "var(--muted)",
              lineHeight: 1.5,
            }}>
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */

export function AuditLogTab({ entries }: { entries: AuditLogEntry[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => ACTION_CATEGORY[e.action] === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Audit Log</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 540 }}>
          Append-only record of every significant action — agent operations, KPI updates,
          task changes. Used for compliance and accountability.
        </p>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid var(--line)",
              cursor: "pointer",
              background: filter === key ? "var(--accent)" : "var(--soft)",
              color: filter === key ? "#0E1726" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            {entries.length === 0
              ? "No audit events yet. Events are recorded as you use the platform."
              : `No ${FILTER_TABS.find((t) => t.key === filter)?.label ?? filter} events found.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
        Showing last {entries.length} event{entries.length !== 1 ? "s" : ""} · Audit log is append-only
      </p>
    </div>
  );
}
