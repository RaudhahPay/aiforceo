"use client";

import { compareToBenchmark } from "@/lib/kpi/benchmarks";
import type { WorkspaceKPI } from "@/lib/kpi/types";

type Props = {
  industry: string;
  kpi: WorkspaceKPI;
};

const BENCHMARK_FIELDS: { field: string; label: string; format: (v: number) => string }[] = [
  { field: "gpPct", label: "Gross Profit Margin", format: (v) => `${(v * 100).toFixed(1)}%` },
  { field: "repeatRate", label: "Repeat Rate", format: (v) => `${(v * 100).toFixed(1)}%` },
  { field: "csat", label: "Customer Satisfaction", format: (v) => v.toFixed(1) },
  { field: "nps", label: "Net Promoter Score", format: (v) => v.toFixed(0) },
  { field: "onTimeDelivery", label: "On-Time Delivery", format: (v) => `${(v * 100).toFixed(1)}%` },
];

const STATUS_CONFIG = {
  above: {
    label: "Above",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.12)",
    border: "rgba(74,222,128,0.3)",
  },
  at: {
    label: "At avg",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.3)",
  },
  below: {
    label: "Below",
    color: "#f87171",
    bg: "rgba(248,113,113,0.12)",
    border: "rgba(248,113,113,0.3)",
  },
};

export function BenchmarkWidget({ industry, kpi }: Props) {
  const rows = BENCHMARK_FIELDS.map(({ field, label, format }) => {
    // Get value from the right section
    let value: number;
    if (field === "gpPct") {
      value = kpi.periods.MTD.gpPct;
    } else if (field === "repeatRate" || field === "csat" || field === "nps" || field === "onTimeDelivery") {
      value = kpi.ops[field as keyof typeof kpi.ops] as number;
    } else {
      return null;
    }

    const comparison = compareToBenchmark(industry, field, value);
    if (!comparison) return null;

    const cfg = STATUS_CONFIG[comparison.status];

    return { label, value: format(value), benchmark: format(comparison.benchmark), cfg };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>
        No benchmarks available for this industry.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: row.cfg.bg,
            border: `1px solid ${row.cfg.border}`,
          }}
        >
          <span style={{ color: "var(--ink)", fontSize: 12 }}>{row.label}</span>
          <span style={{ color: "var(--ink)", fontSize: 12, fontWeight: 700 }}>{row.value}</span>
          <span style={{ color: "var(--muted)", fontSize: 11 }}>
            vs {row.benchmark}
          </span>
          <span
            style={{
              color: row.cfg.color,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              minWidth: 40,
              textAlign: "right",
            }}
          >
            {row.cfg.label}
          </span>
        </div>
      ))}
    </div>
  );
}
