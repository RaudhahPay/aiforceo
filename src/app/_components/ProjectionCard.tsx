"use client";

import type { MonthlyKPIRecord } from "@/lib/kpi/types";
import { projectTrend } from "@/lib/kpi/rollup";
import { computePeriod } from "@/lib/kpi/types";

type Props = {
  records: MonthlyKPIRecord[];
  selectedMonth: string;
  showFinance?: boolean;
};

function formatRM(value: number): string {
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `RM ${(value / 1_000).toFixed(1)}K`;
  return `RM ${Math.round(value).toLocaleString()}`;
}

function getQuarterLabel(month: string): string {
  const m = parseInt(month.slice(5, 7), 10);
  const q = Math.ceil(m / 3);
  const y = month.slice(0, 4);
  return `Q${q} ${y}`;
}

export function ProjectionCard({ records, selectedMonth, showFinance = false }: Props) {
  const projection = projectTrend(records, selectedMonth);

  if (!projection) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          background: "var(--panel2)",
          border: "1px solid var(--line)",
          color: "var(--muted)",
          fontSize: 12,
        }}
      >
        Need 2+ months of data for projections.
      </div>
    );
  }

  const qEnd = computePeriod(projection.quarterEnd);
  const yEnd = computePeriod(projection.yearEnd);
  const qLabel = getQuarterLabel(selectedMonth);
  const yLabel = selectedMonth.slice(0, 4);

  const items = [
    {
      label: `${qLabel} revenue (projected)`,
      value: formatRM(qEnd.sales),
      icon: "📈",
    },
    {
      label: `${yLabel} full-year revenue (projected)`,
      value: formatRM(yEnd.sales),
      icon: "🎯",
    },
  ];

  if (showFinance && projection.quarterEndFinance.cashIn != null) {
    items.push({
      label: `${qLabel} cash inflow (projected)`,
      value: formatRM(projection.quarterEndFinance.cashIn ?? 0),
      icon: "💵",
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--panel2)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>{item.label}</div>
            <div style={{ color: "var(--ink)", fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
