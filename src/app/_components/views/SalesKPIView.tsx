"use client";

import type { PeriodData } from "@/lib/kpi/types";
import { C, rm, pct, Stat, Panel, FiveWays } from "@/app/_components/dashboard-primitives";

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
