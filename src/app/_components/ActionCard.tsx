"use client";

type ActionType = "approval" | "review" | "follow-up" | "alert";

type Props = {
  title: string;
  description: string;
  type: ActionType;
  timeAgo: string;
  onClick?: () => void;
};

const TYPE_CONFIG: Record<ActionType, { label: string; color: string; bg: string }> = {
  approval: { label: "Approval", color: "#c5a572", bg: "rgba(197,165,114,0.12)" },
  review:   { label: "Review",   color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  "follow-up": { label: "Follow-up", color: "#e5a93c", bg: "rgba(229,169,60,0.12)" },
  alert:    { label: "Alert",    color: "#e5544b", bg: "rgba(229,84,75,0.12)" },
};

export function ActionCard({ title, description, type, timeAgo, onClick }: Props) {
  const config = TYPE_CONFIG[type];

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", textAlign: "left",
        padding: "12px 14px", borderRadius: 10,
        background: "var(--panel2)", border: "1px solid var(--line)",
        cursor: onClick ? "pointer" : "default", color: "var(--ink)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{description}</p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
        background: config.bg, color: config.color, whiteSpace: "nowrap",
      }}>
        {config.label}
      </span>
      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{timeAgo}</span>
    </button>
  );
}
