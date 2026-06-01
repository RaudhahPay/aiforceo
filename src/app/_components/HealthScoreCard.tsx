"use client";

import { motion } from "framer-motion";

type Props = {
  title: string;
  score: number;        // 0-100
  trend: number;        // positive = up, negative = down
  note: string;         // AI-generated one-liner
  icon: string;         // emoji
  onClick?: () => void;
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#3fb984";
  if (score >= 60) return "#e5a93c";
  return "#e5544b";
}

export function HealthScoreCard({ title, score, trend, note, icon, onClick }: Props) {
  const color = getScoreColor(score);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "20px 18px",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Score glow bar at top */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}80)`,
        borderRadius: "16px 16px 0 0",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0,
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {title}
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "Georgia,serif", lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>/100</span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: trend >= 0 ? "#3fb984" : "#e5544b",
              display: "flex", alignItems: "center", gap: 2,
            }}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}
            </span>
          </div>

          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
            {note}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
