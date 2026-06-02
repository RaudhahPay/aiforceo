"use client";

import type { PeriodData, Channel } from "@/lib/kpi/types";
import { C, rm, pct, num, Stat, Bar, Panel, Row } from "@/app/_components/dashboard-primitives";

export function MarketingKPIView({
  d,
  marketing,
  accent,
}: {
  d: PeriodData;
  marketing: Channel[];
  accent?: string;
}) {
  const a = accent ?? C.blue;
  const totalProspects = marketing.reduce((acc, c) => acc + c.prospects, 0);
  const totalCost = marketing.reduce((acc, c) => acc + c.cost, 0);
  const totalCust = marketing.reduce((acc, c) => acc + c.customers, 0);
  const maxP = Math.max(...marketing.map((c) => c.prospects), 1);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
          gap: 12,
        }}
      >
        <Stat label="Total Reach" value={num(d.reach)} />
        <Stat
          label="Lead Conversion"
          value={pct(d.leadCR)}
          sub="Reach → Prospect"
        />
        <Stat label="Total Prospects" value={num(totalProspects)} />
        <Stat label="Total Marketing Cost" value={rm(totalCost)} />
        <Stat
          label="Cost / Prospect"
          value={totalProspects > 0 ? rm(totalCost / totalProspects) : "—"}
          tone="warn"
        />
        <Stat
          label="CAC"
          value={totalCust > 0 ? rm(totalCost / totalCust) : "—"}
          sub="Cost per customer"
          tone="warn"
        />
        <Stat label="Customers Acquired" value={num(totalCust)} tone="good" />
        <Stat
          label="Sale Conversion"
          value={pct(d.saleCR)}
          sub="Prospect → Customer"
        />
      </div>
      <Panel title="Channel Performance" accent={a}>
        {marketing.map((c) => (
          <div key={c.name} style={{ marginBottom: 14 }}>
            <Bar
              label={c.name}
              value={c.prospects}
              max={maxP}
              color={c.works ? C.green : C.red}
              right={`${c.prospects} prospects · ${c.customers} cust`}
            />
            <div
              style={{ display: "flex", gap: 16, fontSize: 11, color: C.dim }}
            >
              <span>Spend {rm(c.cost)}</span>
              <span>
                CAC {c.customers > 0 ? rm(c.cost / c.customers) : "—"}
              </span>
              <span
                style={{ color: c.works ? C.green : C.red, fontWeight: 700 }}
              >
                {c.works
                  ? "✓ WORKING — scale up"
                  : "✕ UNDERPERFORMING — review"}
              </span>
            </div>
          </div>
        ))}
      </Panel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="What's Working" accent={C.green}>
          {marketing
            .filter((c) => c.works)
            .map((c) => (
              <Row
                key={c.name}
                k={c.name}
                v={"CAC " + (c.customers > 0 ? rm(c.cost / c.customers) : "—")}
                good
              />
            ))}
        </Panel>
        <Panel title="What's Not" accent={C.red}>
          {marketing
            .filter((c) => !c.works)
            .map((c) => (
              <Row
                key={c.name}
                k={c.name}
                v={"CAC " + (c.customers > 0 ? rm(c.cost / c.customers) : "—")}
                good={false}
              />
            ))}
          {marketing.filter((c) => !c.works).length > 0 && (
            <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
              Action: cut or rework high-CAC channels; reallocate budget to
              referral &amp; SEO.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
