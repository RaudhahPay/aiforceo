"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { MonthlyKPIRecord, PeriodRaw, FinanceData, OpsData } from "@/lib/kpi/types";

export type MetricLine = {
  key: string;
  label: string;
  color: string;
  valueKey: string;
  section: "period" | "finance" | "ops";
};

type Props = {
  records: MonthlyKPIRecord[];
  metrics: MetricLine[];
  height?: number;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getFieldValue(
  rec: MonthlyKPIRecord,
  section: MetricLine["section"],
  valueKey: string,
): number {
  switch (section) {
    case "period": {
      const v = rec.periodData[valueKey as keyof PeriodRaw];
      return typeof v === "number" ? v : 0;
    }
    case "finance":
      return rec.financeData[valueKey as keyof FinanceData] ?? 0;
    case "ops":
      return rec.opsData[valueKey as keyof OpsData] ?? 0;
  }
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--panel2)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div
          key={p.name}
          style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}
        >
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--ink)", fontWeight: 700 }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MetricsChart({ records, metrics, height = 200 }: Props) {
  if (records.length === 0 || metrics.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        No data available
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.month.localeCompare(b.month));

  const chartData = sorted.map((rec) => {
    const monthIndex = parseInt(rec.month.slice(5, 7), 10) - 1;
    const point: Record<string, number | string> = {
      month: MONTH_LABELS[monthIndex] ?? rec.month,
    };
    for (const metric of metrics) {
      point[metric.key] = getFieldValue(rec, metric.section, metric.valueKey);
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--muted)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
          iconType="circle"
          iconSize={8}
        />
        {metrics.map((metric) => (
          <Line
            key={metric.key}
            type="monotone"
            dataKey={metric.key}
            name={metric.label}
            stroke={metric.color}
            strokeWidth={2}
            dot={{ fill: metric.color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
