"use client";

import { useState } from "react";
import type { Anomaly } from "@/lib/kpi/rollup";

type Props = {
  anomalies: Anomaly[];
};

export function AnomalyBanner({ anomalies }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const top = anomalies.slice(0, 3).filter((a) => !dismissed.has(a.field));
  if (top.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {top.map((anomaly) => {
        const isHigh = anomaly.direction === "high";
        const isCritical = anomaly.deviation >= 2.5;
        const isWarning = anomaly.deviation >= 1.5 && anomaly.deviation < 2.5;

        const bgColor = isCritical
          ? "rgba(239,68,68,0.12)"
          : isWarning
            ? "rgba(245,158,11,0.12)"
            : "rgba(100,116,139,0.12)";

        const borderColor = isCritical
          ? "rgba(239,68,68,0.4)"
          : isWarning
            ? "rgba(245,158,11,0.4)"
            : "rgba(100,116,139,0.3)";

        const textColor = isCritical
          ? "#f87171"
          : isWarning
            ? "#fbbf24"
            : "var(--muted)";

        const icon = isCritical ? "🔴" : isWarning ? "🟡" : "⚪";
        const dirLabel = isHigh ? "spike" : "drop";

        return (
          <div
            key={anomaly.field}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              background: bgColor,
              border: `1px solid ${borderColor}`,
              fontSize: 12,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: textColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10 }}>
                Anomaly {dirLabel} detected
              </span>
              <div style={{ color: "var(--ink)", marginTop: 2 }}>
                {anomaly.label}
              </div>
              <div style={{ color: "var(--muted)", marginTop: 2, fontSize: 11 }}>
                {Math.abs(anomaly.deviation).toFixed(1)}σ from 3-month average
              </div>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, anomaly.field]))}
              style={{
                flexShrink: 0,
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: "0 2px",
                marginTop: -2,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
