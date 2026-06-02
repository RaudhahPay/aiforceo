"use client";

import type { PeriodData, FinanceData } from "@/lib/kpi/types";
import { C, rm, pct, Stat, Panel, Row } from "@/app/_components/dashboard-primitives";

export function FinanceKPIView({
  d,
  f,
  accent,
}: {
  d: PeriodData;
  f: FinanceData;
  accent?: string;
}) {
  const a = accent ?? C.green;
  const net = f.cashIn - f.cashOut;
  const dscr = f.noi / Math.max(f.debtPayment, 1);
  const currentRatio = f.assets / Math.max(f.liabilities, 1);
  const arDays = d.sales > 0 ? (f.ar / d.sales) * 30 : 0;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        <Panel title="P&L Summary" accent={a}>
          <Row k="Revenue" v={rm(d.sales)} />
          <Row k="COGS" v={rm(d.sales - d.gp)} />
          <Row k="Gross Profit" v={rm(d.gp)} good />
          <Row k="OPEX" v={rm(d.opex)} />
          <Row k="EBITDA" v={rm(d.ebitda)} good={d.ebitda > 0} />
        </Panel>
        <Panel title="Cash Flow" accent={C.green}>
          <Row k="Cash In" v={rm(f.cashIn)} good />
          <Row k="Cash Out" v={rm(f.cashOut)} good={false} />
          <Row k="Net Cash Flow" v={rm(net)} good={net > 0} />
          <Row k="Cash Balance" v={rm(f.cashBalance)} good />
          <Row
            k="Runway"
            v={f.runwayMonths.toFixed(1) + " months"}
            good={f.runwayMonths > 3}
          />
        </Panel>
        <Panel title="Balance Sheet" accent={C.copper}>
          <Row k="Total Assets" v={rm(f.assets)} />
          <Row k="Total Liabilities" v={rm(f.liabilities)} />
          <Row k="Equity" v={rm(f.equity)} good />
          <Row k="Inventory" v={rm(f.inventory)} />
          <Row
            k="Current Ratio"
            v={currentRatio.toFixed(2) + "x"}
            good={currentRatio > 1.2}
          />
        </Panel>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))",
          gap: 12,
        }}
      >
        <Stat
          label="Accounts Receivable"
          value={rm(f.ar)}
          sub={Math.round(arDays) + " days outstanding"}
          tone={arDays > 45 ? "bad" : "good"}
        />
        <Stat
          label="AR Overdue"
          value={rm(f.arOverdue)}
          sub="Chase these"
          tone="bad"
        />
        <Stat label="Accounts Payable" value={rm(f.ap)} />
        <Stat
          label="Debt Service Ratio"
          value={dscr.toFixed(2) + "x"}
          sub="NOI / debt payment"
          tone={dscr >= 1.25 ? "good" : "bad"}
        />
        <Stat label="Breakeven Sales" value={rm(d.breakeven)} tone="warn" />
        <Stat
          label="Net Working Capital"
          value={rm(f.ar + f.inventory - f.ap)}
        />
      </div>
      <Panel title="Margin Watch — Price vs Cost" accent={a}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
        >
          <thead>
            <tr style={{ color: C.dim }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Item</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>
                Sell Price
              </th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>
                Unit Cost
              </th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Margin</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Core product A", 149, 54],
                ["Bundle B", 299, 98],
                ["Entry C", 69, 38],
                ["Premium D", 490, 145],
              ] as [string, number, number][]
            ).map(([name, price, cost]) => {
              const m = (price - cost) / price;
              const ok = m >= 0.5;
              return (
                <tr
                  key={name}
                  style={{
                    borderTop: `1px solid ${C.line}`,
                    textAlign: "right",
                  }}
                >
                  <td
                    style={{ textAlign: "left", padding: "8px", color: C.text }}
                  >
                    {name}
                  </td>
                  <td style={{ padding: "8px" }}>RM {price.toFixed(0)}</td>
                  <td style={{ padding: "8px" }}>RM {cost.toFixed(0)}</td>
                  <td
                    style={{
                      padding: "8px",
                      color: ok ? C.green : C.red,
                      fontWeight: 700,
                    }}
                  >
                    {pct(m)}
                  </td>
                  <td style={{ padding: "8px", color: ok ? C.green : C.amber }}>
                    {ok ? "Healthy" : "Review"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
          Also monitor: tax provision, forex exposure, loan covenants, deferred
          revenue, capex vs budget.
        </div>
      </Panel>
    </div>
  );
}
