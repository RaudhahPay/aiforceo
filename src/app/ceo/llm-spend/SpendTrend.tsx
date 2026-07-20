"use client";

/**
 * 7-day AI spend against the all-Sonnet baseline.
 *
 * One axis, one unit (USD): the baseline area is what the same traffic would
 * have cost on Claude Sonnet, the actual line is what we paid — so the gap
 * between them *is* the saving. Deliberately not a dual-axis chart.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C } from "@/app/_components/dashboard-primitives";
import { usd, type GatewayDaily } from "@/lib/llm-gateway";

export function SpendTrend({ daily }: { daily: GatewayDaily[] }) {
  const data = daily.map((d) => ({
    day: String(d.day).slice(5),
    actual: Number(d.total_cost) || 0,
    baseline: Number(d.baseline_sonnet_cost) || 0,
  }));

  if (data.length === 0) {
    return (
      <div style={{ color: C.dim, fontSize: 13, padding: "24px 0" }}>
        No calls logged yet.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gwBaseline" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.dim} stopOpacity={0.28} />
              <stop offset="100%" stopColor={C.dim} stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="gwActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity={0.55} />
              <stop offset="100%" stopColor={C.blue} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: C.dim, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: C.line }}
          />
          <YAxis
            tick={{ fill: C.dim, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(v: number) => usd(v)}
          />
          <Tooltip
            contentStyle={{
              background: C.panel2,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: C.dim }}
            formatter={(value, name) => [
              usd(Number(value) || 0),
              name === "baseline" ? "All-Sonnet baseline" : "Actual spend",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: C.dim }}
            formatter={(name) =>
              name === "baseline" ? "All-Sonnet baseline" : "Actual spend"
            }
          />
          <Area
            type="monotone"
            dataKey="baseline"
            stroke={C.dim}
            strokeWidth={1.5}
            fill="url(#gwBaseline)"
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke={C.blue}
            strokeWidth={2}
            fill="url(#gwActual)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
