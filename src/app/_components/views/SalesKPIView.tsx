"use client";

import type { PeriodData } from "@/lib/kpi/types";
import { C, rm, pct, num, Stat, Panel, FiveWays } from "@/app/_components/dashboard-primitives";

export function SalesKPIView({
  d,
  period,
  accent,
}: {
  d: PeriodData;
  period: string;
  accent?: string;
}) {
  const a = accent ?? C.gold;
  const bePctOfSales = d.breakeven > 0 ? d.sales / d.breakeven : 0;

  // F&B mode: direct revenue from POS — show simplified view instead of funnel formula
  const isFnBMode = (d.revenue != null && d.revenue > 0);

  if (isFnBMode) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Panel title="Revenue — Direct from POS" accent={a}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
              gap: 12,
            }}
          >
            <Stat label="Revenue (Direct)" value={rm(d.sales)} sub="From POS / accounting" tone="good" />
            <Stat label="Total Orders" value={num(d.orders ?? 0)} sub="Transactions" />
            <Stat label="Avg Sale / Customer" value={d.avgSale > 0 ? rm(d.avgSale) : "—"} sub="Average ticket size" />
            <Stat label="Avg Txns / Customer" value={d.avgTxn > 1 ? d.avgTxn.toFixed(1) : "—"} sub="Repeat visits" />
          </div>
        </Panel>
        <Panel title="Profitability" accent={a}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
              gap: 12,
            }}
          >
            <Stat label="GP %" value={pct(d.gpPct)} sub="Gross margin" />
            <Stat label="Gross Profit" value={rm(d.gp)} tone={d.gp > 0 ? "good" : "bad"} />
            <Stat label="OPEX" value={rm(d.opex)} sub="Operating expenses" />
            <Stat label="EBITDA" value={rm(d.ebitda)} tone={d.ebitda >= 0 ? "good" : "bad"} />
            <Stat
              label="EBITDA Margin"
              value={d.sales > 0 ? pct(d.ebitda / d.sales) : "—"}
              tone={d.ebitda > 0 ? "good" : "bad"}
            />
            <Stat
              label="Breakeven Sales"
              value={rm(d.breakeven)}
              sub="Fixed cost / GP%"
              tone="warn"
            />
            <Stat
              label="Above / Below Breakeven"
              value={rm(d.sales - d.breakeven)}
              sub={pct(bePctOfSales) + " of breakeven"}
              tone={d.sales >= d.breakeven ? "good" : "bad"}
            />
          </div>
        </Panel>
      </div>
    );
  }

  // SaaS / lead-gen mode: show full funnel formula
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="The Profit Formula — Reach to EBITDA" accent={a}>
        <FiveWays d={d} accent={a} />
      </Panel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
          gap: 12,
        }}
      >
        <Stat
          label="Breakeven Sales"
          value={rm(d.breakeven)}
          sub="Fixed cost / GP%"
          tone="warn"
        />
        <Stat
          label="Above / Below Breakeven"
          value={rm(d.sales - d.breakeven)}
          sub={pct(bePctOfSales) + " of breakeven"}
          tone={d.sales >= d.breakeven ? "good" : "bad"}
        />
        <Stat
          label={`CAPEX ${period === "YTD" ? "YTD" : "MTD"}`}
          value={rm(period === "YTD" ? d.capexYtd : d.capexMtd)}
          sub="Capital expenditure"
        />
        <Stat label="CAPEX YTD" value={rm(d.capexYtd)} sub="Year cumulative" />
        <Stat
          label="EBITDA Margin"
          value={d.sales > 0 ? pct(d.ebitda / d.sales) : "—"}
          tone={d.ebitda > 0 ? "good" : "bad"}
        />
        <Stat label="GP Margin" value={pct(d.gpPct)} />
      </div>
    </div>
  );
}
