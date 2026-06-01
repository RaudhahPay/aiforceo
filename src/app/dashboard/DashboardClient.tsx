"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { AgentRole } from "@/lib/prompts";
import { saveKPIs } from "@/server/actions/dashboard";
import { switchWorkspace } from "@/server/actions/workspaces";
// OfficeView and WelcomeGuide temporarily disabled — caused 500 on Cloudflare Workers
// import dynamic from "next/dynamic";
// const OfficeView = dynamic(() => import("@/app/_components/OfficeView").then(m => m.OfficeView), { ssr: false });
// const WelcomeGuide = dynamic(() => import("@/app/_components/WelcomeGuide").then(m => m.WelcomeGuide), { ssr: false });

/* ─── TIER COLOURS (matches WorkspaceSwitcher) ───────────────── */
const TIER_COLOR: Record<string, string> = {
  trial: "#94a3b8",
  starter: "#0096C7",
  growth: "#7C3AED",
  scale: "#F96167",
};

/* ─── THEME ──────────────────────────────────────────────────── */
const C = {
  ink: "#0E1726",
  panel: "#15203A",
  panel2: "#1C2A47",
  line: "#2A3B5E",
  gold: "#D4A017",
  copper: "#C97B3A",
  green: "#3FB984",
  red: "#E5544B",
  amber: "#E5A93C",
  text: "#E8EDF6",
  dim: "#8597B8",
  blue: "#2E7DD1",
  pink: "#F96167",
  teal: "#2A9D8F",
};

/* ─── TYPES ──────────────────────────────────────────────────── */
export type PeriodRaw = {
  reach: number;
  leadCR: number;
  saleCR: number;
  avgSale: number;
  avgTxn: number;
  gpPct: number;
  opex: number;
  capexMtd: number;
  capexYtd: number;
  fixedCost: number;
};
export type PeriodData = PeriodRaw & {
  prospects: number;
  customers: number;
  sales: number;
  gp: number;
  ebitda: number;
  breakeven: number;
};
export type FinanceData = {
  cashIn: number;
  cashOut: number;
  cashBalance: number;
  ar: number;
  ap: number;
  arOverdue: number;
  assets: number;
  liabilities: number;
  equity: number;
  debtPayment: number;
  noi: number;
  inventory: number;
  runwayMonths: number;
};
export type Channel = {
  name: string;
  prospects: number;
  cost: number;
  customers: number;
  works: boolean;
};
export type OpsData = {
  headcount: number;
  openRoles: number;
  attrition: number;
  eNPS: number;
  productivityPerHead: number;
  trainingHrs: number;
  customers: number;
  repeatRate: number;
  csat: number;
  nps: number;
  complaints: number;
  resolved: number;
  onTimeDelivery: number;
  capacityUsed: number;
};
export type WorkspaceKPI = {
  periods: { MTD: PeriodRaw; QTD: PeriodRaw; YTD: PeriodRaw };
  finance: FinanceData;
  marketing: Channel[];
  ops: OpsData;
};
export type AgentStat = {
  convCount: number;
  msgCountMtd: number;
  lastActive: string | null;
  lastContent: string | null;
};

/* ─── FORMAT HELPERS ─────────────────────────────────────────── */
const rm = (n: number) => "RM " + Math.round(n).toLocaleString("en-MY");
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const num = (n: number) => Math.round(n).toLocaleString("en-MY");

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── COMPUTE PERIOD ─────────────────────────────────────────── */
function compute(r: PeriodRaw): PeriodData {
  const prospects = Math.round(r.reach * r.leadCR);
  const customers = Math.round(prospects * r.saleCR);
  const sales = Math.round(customers * r.avgSale * r.avgTxn);
  const gp = Math.round(sales * r.gpPct);
  const ebitda = gp - r.opex;
  const breakeven = r.gpPct > 0 ? Math.round(r.fixedCost / r.gpPct) : 0;
  return { ...r, prospects, customers, sales, gp, ebitda, breakeven };
}

/* ─── DEFAULT KPI DATA ───────────────────────────────────────── */
function defaultKPI(): WorkspaceKPI {
  // Start blank — no seeded data. Aria guides the user to fill these in.
  const blankPeriod: PeriodRaw = {
    reach: 0, leadCR: 0, saleCR: 0, avgSale: 0, avgTxn: 0,
    gpPct: 0, opex: 0, capexMtd: 0, capexYtd: 0, fixedCost: 0,
  };
  return {
    periods: { MTD: { ...blankPeriod }, QTD: { ...blankPeriod }, YTD: { ...blankPeriod } },
    finance: {
      cashIn: 0, cashOut: 0, cashBalance: 0,
      ar: 0, ap: 0, arOverdue: 0,
      assets: 0, liabilities: 0, equity: 0,
      debtPayment: 0, noi: 0, inventory: 0, runwayMonths: 0,
    },
    marketing: [],
    ops: {
      headcount: 0,
      openRoles: 0,
      attrition: 0,
      eNPS: 0,
      productivityPerHead: 0,
      trainingHrs: 0,
      customers: 0,
      repeatRate: 0,
      csat: 0,
      nps: 0,
      complaints: 0,
      resolved: 0,
      onTimeDelivery: 0,
      capacityUsed: 0,
    },
  };
}

/* ─── LOCALSTORAGE ───────────────────────────────────────────── */
function loadKPILocal(wsId: string): WorkspaceKPI | null {
  try {
    const raw = localStorage.getItem(`ai4c_kpi_${wsId}`);
    return raw ? (JSON.parse(raw) as WorkspaceKPI) : null;
  } catch {
    return null;
  }
}
function saveKPILocal(wsId: string, kpi: WorkspaceKPI) {
  try {
    localStorage.setItem(`ai4c_kpi_${wsId}`, JSON.stringify(kpi));
  } catch {
    /* ignore */
  }
}

/* ─── SMALL UI PIECES ────────────────────────────────────────── */
function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "warn";
}) {
  const col =
    tone === "good"
      ? C.green
      : tone === "bad"
        ? C.red
        : tone === "warn"
          ? C.amber
          : C.text;
  return (
    <div
      style={{
        background: C.panel2,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          color: C.dim,
          fontSize: 11,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: col,
          fontSize: 21,
          fontWeight: 700,
          marginTop: 6,
          fontFamily: "Georgia,serif",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
  right,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  right: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: C.text,
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: C.dim }}>{right}</span>
      </div>
      <div
        style={{
          background: C.ink,
          borderRadius: 6,
          height: 9,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`,
            height: "100%",
            background: color,
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 4,
            height: 16,
            background: accent ?? C.gold,
            borderRadius: 2,
          }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            color: C.text,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: `1px solid ${C.line}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.dim }}>{k}</span>
      <span
        style={{
          color: good === undefined ? C.text : good ? C.green : C.red,
          fontWeight: 600,
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* ─── FIVE WAYS FUNNEL ───────────────────────────────────────── */
function FiveWays({ d, accent }: { d: PeriodData; accent: string }) {
  const steps: {
    k: string;
    v: string;
    note?: string;
    big?: boolean;
    tone?: "good" | "bad";
  }[] = [
    { k: "Reach", v: num(d.reach), note: "Leads / impressions" },
    { k: "× Lead CR", v: pct(d.leadCR) },
    { k: "Prospects", v: num(d.prospects), note: "Qualified leads" },
    { k: "× Conversion", v: pct(d.saleCR) },
    { k: "Customers", v: num(d.customers) },
    { k: "× Avg Sale", v: rm(d.avgSale) },
    { k: "× Avg Txns", v: d.avgTxn.toFixed(1), note: "Per customer" },
    { k: "= Sales", v: rm(d.sales), note: "Total revenue", big: true },
    { k: "× GP %", v: pct(d.gpPct) },
    { k: "= Gross Profit", v: rm(d.gp), big: true },
    { k: "− OPEX", v: rm(d.opex), note: "Operating expense" },
    {
      k: "= EBITDA",
      v: rm(d.ebitda),
      note: "Earnings",
      big: true,
      tone: d.ebitda >= 0 ? "good" : "bad",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))",
        gap: 10,
      }}
    >
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            background: s.big ? C.panel2 : C.ink,
            border: `1px solid ${s.big ? accent : C.line}`,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              color: C.dim,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}
          >
            {s.k}
          </div>
          <div
            style={{
              fontSize: s.big ? 19 : 16,
              fontWeight: 700,
              marginTop: 5,
              fontFamily: "Georgia,serif",
              color:
                s.tone === "good"
                  ? C.green
                  : s.tone === "bad"
                    ? C.red
                    : s.big
                      ? C.gold
                      : C.text,
            }}
          >
            {s.v}
          </div>
          {s.note && (
            <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>
              {s.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── VIEW: CEO ──────────────────────────────────────────────── */
function CEOView({
  d,
  f,
  o,
  period,
  agentStats,
  remaining,
  quota,
}: {
  d: PeriodData;
  f: FinanceData;
  o: OpsData;
  period: string;
  agentStats: Record<AgentRole, AgentStat>;
  remaining: number;
  quota: number;
}) {
  const dscr = f.noi / f.debtPayment;
  const creditPct = Math.round((remaining / Math.max(quota, 1)) * 100);
  const activeAgents = (
    ["aria", "cmo", "coo", "cfo", "ceo", "cto"] as AgentRole[]
  ).filter((r) => agentStats[r].convCount > 0).length;
  const totalMsgs = Object.values(agentStats).reduce(
    (a, s) => a + s.msgCountMtd,
    0,
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
          gap: 12,
        }}
      >
        <Stat label="Total Sales" value={rm(d.sales)} sub={period} />
        <Stat
          label="Gross Profit"
          value={rm(d.gp)}
          sub={pct(d.gpPct) + " margin"}
        />
        <Stat
          label="EBITDA"
          value={rm(d.ebitda)}
          tone={d.ebitda > 0 ? "good" : "bad"}
        />
        <Stat
          label="Cash Balance"
          value={rm(f.cashBalance)}
          sub={f.runwayMonths.toFixed(1) + " mo runway"}
          tone={f.runwayMonths > 3 ? "good" : "warn"}
        />
        <Stat label="New Customers" value={num(d.customers)} />
        <Stat
          label="DSCR"
          value={dscr.toFixed(2) + "×"}
          tone={dscr >= 1.25 ? "good" : dscr >= 1 ? "warn" : "bad"}
        />
      </div>

      {/* AI Platform stats */}
      <Panel title="AIforCEO — Command Executive Activity" accent={C.gold}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 12,
          }}
        >
          <Stat
            label="Executives Active"
            value={`${activeAgents} / 6`}
            tone={activeAgents >= 3 ? "good" : "warn"}
          />
          <Stat label="Messages This Month" value={num(totalMsgs)} />
          <Stat
            label="AI Credits Left"
            value={`${creditPct}%`}
            tone={creditPct > 30 ? "good" : creditPct > 10 ? "warn" : "bad"}
          />
          {(["aria", "cmo", "coo", "cfo", "ceo", "cto"] as AgentRole[]).map(
            (r) => (
              <div
                key={r}
                style={{
                  background: C.panel2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    color: C.dim,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                  }}
                >
                  {r.toUpperCase()}
                </div>
                <div
                  style={{
                    color: agentStats[r].convCount > 0 ? C.green : C.dim,
                    fontSize: 15,
                    fontWeight: 700,
                    marginTop: 5,
                    fontFamily: "Georgia,serif",
                  }}
                >
                  {agentStats[r].msgCountMtd} msgs
                </div>
                <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>
                  {relTime(agentStats[r].lastActive)}
                </div>
              </div>
            ),
          )}
        </div>
      </Panel>

      {/* CMO + CFO snapshots */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="CMO Snapshot" accent={C.blue}>
          <Bar
            label="Reach"
            value={d.reach}
            max={d.reach}
            color={C.blue}
            right={num(d.reach)}
          />
          <Bar
            label="Prospects"
            value={d.prospects}
            max={d.reach}
            color={C.copper}
            right={num(d.prospects)}
          />
          <Bar
            label="Customers"
            value={d.customers}
            max={d.reach}
            color={C.green}
            right={num(d.customers)}
          />
          <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
            Lead CR {pct(d.leadCR)} · Sale CR {pct(d.saleCR)}
          </div>
        </Panel>
        <Panel title="CFO Snapshot" accent={C.green}>
          <Row
            k="Net Cash Flow"
            v={rm(f.cashIn - f.cashOut)}
            good={f.cashIn > f.cashOut}
          />
          <Row k="AR / AP" v={rm(f.ar) + "  /  " + rm(f.ap)} />
          <Row k="Equity" v={rm(f.equity)} />
          <Row
            k="Debt Service Ratio"
            v={dscr.toFixed(2) + "×"}
            good={dscr >= 1.25}
          />
          <Row
            k="Breakeven Gap"
            v={rm(d.sales - d.breakeven)}
            good={d.sales >= d.breakeven}
          />
        </Panel>
      </div>

      {/* COO snapshot */}
      <Panel title="COO Snapshot" accent={C.copper}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 12,
          }}
        >
          <Stat
            label="Headcount"
            value={num(o.headcount)}
            sub={o.openRoles + " open roles"}
          />
          <Stat
            label="Attrition"
            value={pct(o.attrition)}
            tone={o.attrition < 0.1 ? "good" : "warn"}
          />
          <Stat label="Repeat Rate" value={pct(o.repeatRate)} tone="good" />
          <Stat
            label="NPS"
            value={String(o.nps)}
            tone={o.nps >= 50 ? "good" : "warn"}
          />
          <Stat
            label="On-Time Delivery"
            value={pct(o.onTimeDelivery)}
            tone="good"
          />
          <Stat label="Capacity Used" value={pct(o.capacityUsed)} tone="warn" />
        </div>
      </Panel>
    </div>
  );
}

/* ─── VIEW: SALES ────────────────────────────────────────────── */
function SalesView({
  d,
  period,
  accent,
}: {
  d: PeriodData;
  period: string;
  accent: string;
}) {
  const bePctOfSales = d.breakeven > 0 ? d.sales / d.breakeven : 0;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="The Profit Formula — Reach to EBITDA" accent={accent}>
        <FiveWays d={d} accent={accent} />
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
          sub="Fixed cost ÷ GP%"
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

/* ─── VIEW: MARKETING ────────────────────────────────────────── */
function MarketingView({
  d,
  marketing,
  accent,
}: {
  d: PeriodData;
  marketing: Channel[];
  accent: string;
}) {
  const totalProspects = marketing.reduce((a, c) => a + c.prospects, 0);
  const totalCost = marketing.reduce((a, c) => a + c.cost, 0);
  const totalCust = marketing.reduce((a, c) => a + c.customers, 0);
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
      <Panel title="Channel Performance" accent={accent}>
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

/* ─── VIEW: CFO ──────────────────────────────────────────────── */
function CFOView({
  d,
  f,
  accent,
}: {
  d: PeriodData;
  f: FinanceData;
  accent: string;
}) {
  const net = f.cashIn - f.cashOut;
  const dscr = f.noi / Math.max(f.debtPayment, 1);
  const currentRatio = f.assets / Math.max(f.liabilities, 1);
  const arDays = d.sales > 0 ? (f.ar / d.sales) * 30 : 0;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        <Panel title="P&L Summary" accent={accent}>
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
            v={currentRatio.toFixed(2) + "×"}
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
          value={dscr.toFixed(2) + "×"}
          sub="NOI ÷ debt payment"
          tone={dscr >= 1.25 ? "good" : "bad"}
        />
        <Stat label="Breakeven Sales" value={rm(d.breakeven)} tone="warn" />
        <Stat
          label="Net Working Capital"
          value={rm(f.ar + f.inventory - f.ap)}
        />
      </div>
      <Panel title="Margin Watch — Price vs Cost" accent={accent}>
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

/* ─── VIEW: COO ──────────────────────────────────────────────── */
function COOView({ o, accent }: { o: OpsData; accent: string }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="People / HR" accent={accent}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
            gap: 12,
          }}
        >
          <Stat label="Headcount" value={num(o.headcount)} />
          <Stat label="Open Roles" value={String(o.openRoles)} tone="warn" />
          <Stat
            label="Attrition Rate"
            value={pct(o.attrition)}
            tone={o.attrition < 0.1 ? "good" : "bad"}
          />
          <Stat
            label="Employee NPS"
            value={String(o.eNPS)}
            tone={o.eNPS > 30 ? "good" : "warn"}
          />
          <Stat label="Revenue / Head" value={rm(o.productivityPerHead)} />
          <Stat label="Training Hrs / Head" value={o.trainingHrs.toFixed(1)} />
        </div>
      </Panel>
      <Panel title="Customer Data" accent={C.blue}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))",
            gap: 12,
          }}
        >
          <Stat label="Active Customers" value={num(o.customers)} />
          <Stat
            label="Repeat / Retention"
            value={pct(o.repeatRate)}
            tone="good"
          />
          <Stat label="CSAT" value={o.csat.toFixed(1) + " / 5"} tone="good" />
          <Stat
            label="Net Promoter Score"
            value={String(o.nps)}
            tone={o.nps >= 50 ? "good" : "warn"}
          />
          <Stat
            label="Complaints"
            value={String(o.complaints)}
            sub={o.resolved + " resolved"}
            tone="warn"
          />
          <Stat
            label="Resolution Rate"
            value={o.complaints > 0 ? pct(o.resolved / o.complaints) : "—"}
            tone="good"
          />
        </div>
      </Panel>
      <Panel title="Operations & Delivery" accent={C.copper}>
        <Bar
          label="On-Time Delivery"
          value={o.onTimeDelivery}
          max={1}
          color={C.green}
          right={pct(o.onTimeDelivery)}
        />
        <Bar
          label="Capacity Utilisation"
          value={o.capacityUsed}
          max={1}
          color={C.amber}
          right={pct(o.capacityUsed)}
        />
        <Bar
          label="Complaint Resolution"
          value={o.complaints > 0 ? o.resolved / o.complaints : 1}
          max={1}
          color={C.blue}
          right={o.complaints > 0 ? pct(o.resolved / o.complaints) : "—"}
        />
        <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>
          Also track: SOP compliance %, inventory turnover, supplier lead time,
          downtime, quality defect rate.
        </div>
      </Panel>
    </div>
  );
}

/* ─── VIEW: GROUP ────────────────────────────────────────────── */
type GroupEntry = {
  ws: { id: string; name: string; tier: string };
  kpi: WorkspaceKPI | null;
};

type GroupTab = "financial" | "marketing" | "operations";

function CompanyCell({
  ws,
  activeId,
}: {
  ws: { id: string; name: string; tier: string };
  activeId: string;
}) {
  const isActive = ws.id === activeId;
  return (
    <td style={{ padding: "12px", color: C.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: TIER_COLOR[ws.tier] ?? C.dim,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: isActive ? 700 : 500 }}>{ws.name}</span>
        {isActive && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 10,
              background: C.gold,
              color: C.ink,
            }}
          >
            ACTIVE
          </span>
        )}
      </div>
    </td>
  );
}

function SwitchCell({
  ws,
  activeId,
}: {
  ws: { id: string; name: string; tier: string };
  activeId: string;
}) {
  if (ws.id === activeId) return <td />;
  return (
    <td style={{ padding: "12px", textAlign: "right" }}>
      <form action={switchWorkspace}>
        <input type="hidden" name="workspace_id" value={ws.id} />
        <button
          type="submit"
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            background: C.panel2,
            color: C.dim,
            border: `1px solid ${C.line}`,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Switch →
        </button>
      </form>
    </td>
  );
}

function GroupTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[];
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "8px 12px",
                  color: C.dim,
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function GroupView({
  entries,
  activeId,
}: {
  entries: GroupEntry[];
  activeId: string;
}) {
  const [tab, setTab] = useState<GroupTab>("financial");

  /* ── precompute all row data ── */
  const allRows = entries.map(({ ws, kpi }) => {
    const d = kpi ? compute(kpi.periods.MTD) : null;

    // Financial
    const fin = d
      ? {
          sales: d.sales,
          gpPct: d.gpPct,
          ebitda: d.ebitda,
          cashBalance: kpi!.finance.cashBalance,
          runway: kpi!.finance.runwayMonths,
        }
      : null;

    // Marketing (aggregate channels)
    const mktChannels = kpi?.marketing ?? [];
    const mktProspects = mktChannels.reduce((a, c) => a + c.prospects, 0);
    const mktSpend = mktChannels.reduce((a, c) => a + c.cost, 0);
    const mktCustomers = mktChannels.reduce((a, c) => a + c.customers, 0);
    const mktCAC = mktCustomers > 0 ? mktSpend / mktCustomers : 0;
    const mktConvRate = mktProspects > 0 ? mktCustomers / mktProspects : 0;
    const bestChannel =
      mktChannels.length > 0
        ? mktChannels.reduce((a, b) => (b.customers > a.customers ? b : a)).name
        : "—";
    const mkt = kpi
      ? {
          mktProspects,
          mktSpend,
          mktCustomers,
          mktCAC,
          mktConvRate,
          bestChannel,
        }
      : null;

    // Operations
    const ops = kpi
      ? {
          headcount: kpi.ops.headcount,
          nps: kpi.ops.nps,
          csat: kpi.ops.csat,
          onTimeDelivery: kpi.ops.onTimeDelivery,
          capacityUsed: kpi.ops.capacityUsed,
          repeatRate: kpi.ops.repeatRate,
        }
      : null;

    return { ws, fin, mkt, ops };
  });

  /* ── summary strip values ── */
  const totalRevenue = allRows.reduce((a, r) => a + (r.fin?.sales ?? 0), 0);
  const totalEbitda = allRows.reduce((a, r) => a + (r.fin?.ebitda ?? 0), 0);
  const profitable = allRows.filter(
    (r) => r.fin !== null && r.fin.ebitda >= 0,
  ).length;
  const totalProspects = allRows.reduce(
    (a, r) => a + (r.mkt?.mktProspects ?? 0),
    0,
  );
  const totalMktSpend = allRows.reduce((a, r) => a + (r.mkt?.mktSpend ?? 0), 0);
  const totalHeadcount = allRows.reduce(
    (a, r) => a + (r.ops?.headcount ?? 0),
    0,
  );
  const avgNPS =
    allRows.filter((r) => r.ops).length > 0
      ? allRows.reduce((a, r) => a + (r.ops?.nps ?? 0), 0) /
        allRows.filter((r) => r.ops).length
      : 0;

  const tabStyle = (t: GroupTab): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: tab === t ? C.gold : C.panel2,
    color: tab === t ? C.ink : C.dim,
    transition: "background 0.15s",
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Summary strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))",
          gap: 12,
        }}
      >
        <Stat
          label="Group Revenue MTD"
          value={rm(totalRevenue)}
          sub="All companies combined"
        />
        <Stat
          label="Group EBITDA"
          value={rm(totalEbitda)}
          tone={totalEbitda >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Profitable"
          value={`${profitable} / ${allRows.filter((r) => r.fin).length}`}
          tone={
            profitable === allRows.filter((r) => r.fin).length ? "good" : "warn"
          }
        />
        <Stat label="Total Prospects" value={num(totalProspects)} sub="MTD" />
        <Stat label="Mktg Spend" value={rm(totalMktSpend)} sub="MTD" />
        <Stat
          label="Group Headcount"
          value={num(totalHeadcount)}
          sub="All companies"
        />
        <Stat
          label="Avg NPS"
          value={avgNPS.toFixed(0)}
          tone={avgNPS >= 50 ? "good" : avgNPS >= 30 ? "warn" : "bad"}
        />
        <Stat label="Companies" value={String(entries.length)} />
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={tabStyle("financial")}
          onClick={() => setTab("financial")}
        >
          💰 Financial
        </button>
        <button
          style={tabStyle("marketing")}
          onClick={() => setTab("marketing")}
        >
          📣 Marketing
        </button>
        <button
          style={tabStyle("operations")}
          onClick={() => setTab("operations")}
        >
          ⚙️ Operations
        </button>
      </div>

      {/* ── FINANCIAL TAB ── */}
      {tab === "financial" && (
        <Panel title="Financial Comparison — MTD" accent={C.gold}>
          <GroupTable
            headers={[
              "Company",
              "Revenue",
              "GP %",
              "EBITDA",
              "Cash",
              "Runway",
              "",
            ]}
            rows={allRows.map(({ ws, fin }) => {
              const isActive = ws.id === activeId;
              return (
                <tr
                  key={ws.id}
                  style={{
                    borderTop: `1px solid ${C.line}`,
                    background: isActive
                      ? "rgba(212,160,23,0.06)"
                      : "transparent",
                  }}
                >
                  <CompanyCell ws={ws} activeId={activeId} />
                  {!fin ? (
                    <td
                      colSpan={5}
                      style={{ padding: "12px", color: C.dim, fontSize: 12 }}
                    >
                      No KPI data —{" "}
                      <Link href="/settings" style={{ color: C.gold }}>
                        set up KPIs
                      </Link>
                    </td>
                  ) : (
                    <>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {rm(fin.sales)}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {pct(fin.gpPct)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color: fin.ebitda >= 0 ? C.green : C.red,
                          fontWeight: 700,
                        }}
                      >
                        {rm(fin.ebitda)}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {rm(fin.cashBalance)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            fin.runway > 3
                              ? C.green
                              : fin.runway > 1
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {fin.runway.toFixed(1)}mo
                      </td>
                    </>
                  )}
                  <SwitchCell ws={ws} activeId={activeId} />
                </tr>
              );
            })}
          />
        </Panel>
      )}

      {/* ── MARKETING TAB ── */}
      {tab === "marketing" && (
        <Panel title="Marketing Comparison — MTD" accent={C.pink}>
          <GroupTable
            headers={[
              "Company",
              "Prospects",
              "Customers",
              "Conv %",
              "Spend",
              "CAC",
              "Best Channel",
              "",
            ]}
            rows={allRows.map(({ ws, mkt }) => {
              const isActive = ws.id === activeId;
              return (
                <tr
                  key={ws.id}
                  style={{
                    borderTop: `1px solid ${C.line}`,
                    background: isActive
                      ? "rgba(212,160,23,0.06)"
                      : "transparent",
                  }}
                >
                  <CompanyCell ws={ws} activeId={activeId} />
                  {!mkt ? (
                    <td
                      colSpan={6}
                      style={{ padding: "12px", color: C.dim, fontSize: 12 }}
                    >
                      No KPI data —{" "}
                      <Link href="/settings" style={{ color: C.gold }}>
                        set up KPIs
                      </Link>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {num(mkt.mktProspects)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {num(mkt.mktCustomers)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            mkt.mktConvRate >= 0.2
                              ? C.green
                              : mkt.mktConvRate >= 0.1
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {(mkt.mktConvRate * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {rm(mkt.mktSpend)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            mkt.mktCAC < 200
                              ? C.green
                              : mkt.mktCAC < 500
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {rm(mkt.mktCAC)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color: C.dim,
                          fontSize: 12,
                        }}
                      >
                        {mkt.bestChannel}
                      </td>
                    </>
                  )}
                  <SwitchCell ws={ws} activeId={activeId} />
                </tr>
              );
            })}
          />
        </Panel>
      )}

      {/* ── OPERATIONS TAB ── */}
      {tab === "operations" && (
        <Panel title="Operations Comparison" accent={C.teal}>
          <GroupTable
            headers={[
              "Company",
              "Headcount",
              "NPS",
              "CSAT",
              "On-Time",
              "Capacity",
              "Repeat Rate",
              "",
            ]}
            rows={allRows.map(({ ws, ops }) => {
              const isActive = ws.id === activeId;
              return (
                <tr
                  key={ws.id}
                  style={{
                    borderTop: `1px solid ${C.line}`,
                    background: isActive
                      ? "rgba(212,160,23,0.06)"
                      : "transparent",
                  }}
                >
                  <CompanyCell ws={ws} activeId={activeId} />
                  {!ops ? (
                    <td
                      colSpan={6}
                      style={{ padding: "12px", color: C.dim, fontSize: 12 }}
                    >
                      No KPI data —{" "}
                      <Link href="/settings" style={{ color: C.gold }}>
                        set up KPIs
                      </Link>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {num(ops.headcount)}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          fontWeight: 700,
                          color:
                            ops.nps >= 50
                              ? C.green
                              : ops.nps >= 30
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {ops.nps}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            ops.csat >= 4.5
                              ? C.green
                              : ops.csat >= 3.5
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {ops.csat.toFixed(1)} / 5
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            ops.onTimeDelivery >= 0.9
                              ? C.green
                              : ops.onTimeDelivery >= 0.75
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {(ops.onTimeDelivery * 100).toFixed(0)}%
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            ops.capacityUsed <= 0.8
                              ? C.green
                              : ops.capacityUsed <= 0.95
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {(ops.capacityUsed * 100).toFixed(0)}%
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          textAlign: "right",
                          color:
                            ops.repeatRate >= 0.4
                              ? C.green
                              : ops.repeatRate >= 0.2
                                ? C.amber
                                : C.red,
                        }}
                      >
                        {(ops.repeatRate * 100).toFixed(0)}%
                      </td>
                    </>
                  )}
                  <SwitchCell ws={ws} activeId={activeId} />
                </tr>
              );
            })}
          />
        </Panel>
      )}

      {/* Company mini-cards (financial quick view) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        {allRows
          .filter((r) => r.fin !== null)
          .map(({ ws, fin, mkt, ops }) => (
            <div
              key={ws.id}
              style={{
                background: C.panel2,
                border: `1px solid ${ws.id === activeId ? C.gold : C.line}`,
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: TIER_COLOR[ws.tier] ?? C.dim,
                  }}
                />
                <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>
                  {ws.name}
                </span>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "Georgia,serif",
                  color: C.text,
                }}
              >
                {rm(fin!.sales)}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                Revenue MTD
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: C.dim }}>
                GP: {pct(fin!.gpPct)}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: fin!.ebitda >= 0 ? C.green : C.red,
                  marginTop: 6,
                }}
              >
                EBITDA {rm(fin!.ebitda)}
              </div>
              {mkt && (
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
                  {num(mkt.mktProspects)} prospects · CAC {rm(mkt.mktCAC)}
                </div>
              )}
              {ops && (
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                  {num(ops.headcount)} staff · NPS {ops.nps}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── EDIT KPI MODAL ─────────────────────────────────────────── */
function EditModal({
  kpi,
  onSave,
  onClose,
}: {
  kpi: WorkspaceKPI;
  onSave: (k: WorkspaceKPI) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<WorkspaceKPI>(
    JSON.parse(JSON.stringify(kpi)),
  );
  const [tab, setTab] = useState<"MTD" | "QTD" | "YTD">("MTD");

  function numField(path: string[], val: string) {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    setForm((prev) => {
      const copy: WorkspaceKPI = JSON.parse(JSON.stringify(prev));
      let obj: Record<string, unknown> = copy as unknown as Record<
        string,
        unknown
      >;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i] as string;
        obj = obj[key] as Record<string, unknown>;
      }
      const lastKey = path[path.length - 1] as string;
      obj[lastKey] = n;
      return copy;
    });
  }

  const p = form.periods[tab];

  type FieldRow = {
    label: string;
    key: keyof PeriodRaw;
    step: number;
    pct?: boolean;
  };
  const periodFields: FieldRow[] = [
    { label: "Reach (impressions/leads)", key: "reach", step: 100 },
    { label: "Lead Conversion Rate", key: "leadCR", step: 0.01, pct: true },
    { label: "Sale Conversion Rate", key: "saleCR", step: 0.01, pct: true },
    { label: "Avg Sale (RM)", key: "avgSale", step: 10 },
    { label: "Avg Transactions / cust", key: "avgTxn", step: 0.1 },
    { label: "Gross Profit %", key: "gpPct", step: 0.01, pct: true },
    { label: "OPEX (RM)", key: "opex", step: 1000 },
    { label: "Fixed Costs (RM)", key: "fixedCost", step: 1000 },
    { label: "CAPEX MTD (RM)", key: "capexMtd", step: 1000 },
    { label: "CAPEX YTD (RM)", key: "capexYtd", step: 1000 },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,23,38,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          overflow: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              color: C.text,
              fontFamily: "Georgia,serif",
            }}
          >
            ✏️ Edit Business KPIs
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.dim,
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {(["MTD", "QTD", "YTD"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 18px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: tab === t ? C.gold : C.panel2,
                color: tab === t ? C.ink : C.dim,
                border: `1px solid ${tab === t ? C.gold : C.line}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Period fields */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {periodFields.map((f) => (
            <div key={f.key}>
              <label
                style={{
                  fontSize: 11,
                  color: C.dim,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {f.label}
              </label>
              <input
                type="number"
                step={f.step}
                value={
                  f.pct ? ((p[f.key] as number) * 100).toFixed(1) : p[f.key]
                }
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  numField(
                    ["periods", tab, f.key],
                    String(f.pct ? raw / 100 : raw),
                  );
                }}
                style={{
                  width: "100%",
                  background: C.panel2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: C.text,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {f.pct && (
                <span style={{ fontSize: 10, color: C.dim }}>
                  Enter as % (e.g. 18 = 18%)
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Finance quick edit */}
        <h3
          style={{
            fontSize: 13,
            color: C.dim,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 700,
            margin: "0 0 12px",
          }}
        >
          Finance (Cash & Balance Sheet)
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {(
            [
              ["Cash In (RM)", "finance", "cashIn"],
              ["Cash Out (RM)", "finance", "cashOut"],
              ["Cash Balance (RM)", "finance", "cashBalance"],
              ["Accounts Rec (RM)", "finance", "ar"],
              ["Accounts Pay (RM)", "finance", "ap"],
              ["AR Overdue (RM)", "finance", "arOverdue"],
              ["Total Assets (RM)", "finance", "assets"],
              ["Liabilities (RM)", "finance", "liabilities"],
              ["Debt Payment/mo", "finance", "debtPayment"],
              ["NOI (RM)", "finance", "noi"],
              ["Inventory (RM)", "finance", "inventory"],
              ["Runway (months)", "finance", "runwayMonths"],
            ] as [string, string, string][]
          ).map(([label, section, key]) => (
            <div key={key}>
              <label
                style={{
                  fontSize: 11,
                  color: C.dim,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {label}
              </label>
              <input
                type="number"
                step={key === "runwayMonths" ? 0.1 : 1000}
                value={
                  ((form as unknown as Record<string, Record<string, number>>)[
                    section
                  ] ?? {})[key] ?? 0
                }
                onChange={(e) => numField([section, key], e.target.value)}
                style={{
                  width: "100%",
                  background: C.panel2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: C.text,
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 9,
              background: C.panel2,
              color: C.dim,
              border: `1px solid ${C.line}`,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            style={{
              padding: "10px 24px",
              borderRadius: 9,
              background: C.gold,
              color: C.ink,
              border: "none",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Save KPIs
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SELECT WIDGET ──────────────────────────────────────────── */
function Sel({
  value,
  onChange,
  options,
  labels = {},
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.panel,
        color: C.text,
        border: `1px solid ${C.line}`,
        borderRadius: 9,
        padding: "9px 13px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
    </select>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export function DashboardClient({
  workspaceId,
  workspaceName,
  agentStats,
  savedKpis,
  remaining,
  quota,
  connectedSources,
  groupKpis = [],
  todayBriefContent = null,
  ownerInitial,
  ownerName,
  hasBusinessProfile = false,
  hasBrandVoice = false,
  hasFinancials = false,
  hasConnectors = false,
}: {
  workspaceId: string;
  workspaceName: string;
  agentStats: Record<AgentRole, AgentStat>;
  savedKpis?: WorkspaceKPI | null;
  remaining: number;
  quota: number;
  connectedSources: number;
  groupKpis?: GroupEntry[];
  todayBriefContent?: string | null;
  ownerInitial?: string;
  ownerName?: string;
  hasBusinessProfile?: boolean;
  hasBrandVoice?: boolean;
  hasFinancials?: boolean;
  hasConnectors?: boolean;
}) {
  const [view, setView] = useState<
    "CEO" | "SALES" | "MARKETING" | "CFO" | "COO" | "GROUP" | "OFFICE"
  >("CEO");
  const [period, setPeriod] = useState<"MTD" | "QTD" | "YTD">("MTD");
  const [kpi, setKpi] = useState<WorkspaceKPI>(defaultKPI);
  const [editOpen, setEditOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // true when the KPI data is all defaults (no real business data entered yet)
  const [isDefaultData, setIsDefaultData] = useState(false);

  // Hydration priority: DB (savedKpis) > localStorage > default sample data
  useEffect(() => {
    if (savedKpis && Object.keys(savedKpis).length > 0) {
      setKpi(savedKpis as WorkspaceKPI);
      saveKPILocal(workspaceId, savedKpis as WorkspaceKPI);
    } else {
      const local = loadKPILocal(workspaceId);
      if (local) {
        setKpi(local);
      } else {
        setIsDefaultData(true);
      }
    }
    setHydrated(true);
  }, [workspaceId, savedKpis]);

  function handleSave(updated: WorkspaceKPI) {
    setKpi(updated);
    setIsDefaultData(false);
    saveKPILocal(workspaceId, updated);
    // Persist to DB in background — fire and forget
    void saveKPIs(updated);
  }

  const d = useMemo(() => compute(kpi.periods[period]), [kpi, period]);
  const accent = C.gold;

  const VIEWS: [string, string][] = [
    ["CEO", "CEO Command Centre"],
    ["SALES", "Sales & Profit"],
    ["MARKETING", "Marketing / CMO"],
    ["CFO", "CFO Finance"],
    ["COO", "COO Operations"],
    ...(groupKpis.length > 1
      ? ([["GROUP", "🏢 Group View"]] as [string, string][])
      : []),
    ["OFFICE", "🏢 Office View"],
  ];

  return (
    <div
      style={{
        background: C.ink,
        minHeight: "100vh",
        padding: "18px 24px",
        fontFamily: "'Inter',sans-serif",
        color: C.text,
      }}
    >
      {/* MORNING BRIEF BANNER */}
      {todayBriefContent && (
        <Link
          href="/agent/aria"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 18px",
            marginBottom: 16,
            borderRadius: 12,
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.3)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg,#7C3AED,#A855F7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16,
          }}>☀</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#A855F7" }}>
              Today&apos;s Morning Brief is ready
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(168,85,247,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {todayBriefContent.slice(0, 100)}…
            </p>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(168,85,247,0.6)", flexShrink: 0 }}>
            Open Aria →
          </span>
        </Link>
      )}

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.gold,
              letterSpacing: "0.15em",
              fontWeight: 700,
            }}
          >
            BUSINESS COMMAND CENTRE
          </div>
          <h1
            style={{
              margin: "2px 0 0",
              fontSize: 24,
              fontFamily: "Georgia,serif",
              color: C.text,
            }}
          >
            {workspaceName}
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Sel
            value={period}
            onChange={(v) => setPeriod(v as "MTD" | "QTD" | "YTD")}
            options={["MTD", "QTD", "YTD"]}
          />
          {connectedSources === 0 && (
            <Link
              href="/connectors"
              style={{
                padding: "9px 14px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(212,160,23,0.12)",
                color: C.gold,
                border: `1px solid rgba(212,160,23,0.3)`,
                textDecoration: "none",
              }}
            >
              🔗 Connect live data
            </Link>
          )}
          {hydrated && (
            <button
              onClick={() => setEditOpen(true)}
              style={{
                padding: "9px 16px",
                borderRadius: 9,
                background: C.panel,
                color: C.dim,
                border: `1px solid ${C.line}`,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✏️ Edit KPIs
            </button>
          )}
        </div>
      </div>

      {/* VIEW TABS */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}
      >
        {VIEWS.map(([k, label]) => (
          <button
            key={k}
            onClick={() =>
              setView(
                k as "CEO" | "SALES" | "MARKETING" | "CFO" | "COO" | "GROUP",
              )
            }
            style={{
              background: view === k ? C.gold : C.panel,
              color: view === k ? C.ink : C.dim,
              border: `1px solid ${view === k ? C.gold : C.line}`,
              borderRadius: 9,
              padding: "9px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SAMPLE DATA BANNER */}
      {hydrated && isDefaultData && (
        <div
          style={{
            background: "rgba(212,160,23,0.08)",
            border: "1px solid rgba(212,160,23,0.3)",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: C.text }}>
            <span style={{ color: C.gold, fontWeight: 700 }}>
              👋 Your dashboard is ready for real data.
            </span>{" "}
            Chat with <strong>Aria</strong> and share a screenshot of your P&L — she&apos;ll fill this in for you. Or click <strong>Edit KPIs</strong> to enter manually.
          </p>
          <button
            onClick={() => setEditOpen(true)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: C.gold,
              color: C.ink,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Enter my numbers →
          </button>
        </div>
      )}

      {/* VIEWS */}
      {view === "CEO" && (
        <CEOView
          d={d}
          f={kpi.finance}
          o={kpi.ops}
          period={period}
          agentStats={agentStats}
          remaining={remaining}
          quota={quota}
        />
      )}
      {view === "SALES" && <SalesView d={d} period={period} accent={accent} />}
      {view === "MARKETING" && (
        <MarketingView d={d} marketing={kpi.marketing} accent={accent} />
      )}
      {view === "CFO" && <CFOView d={d} f={kpi.finance} accent={accent} />}
      {view === "COO" && <COOView o={kpi.ops} accent={accent} />}
      {view === "GROUP" && groupKpis.length > 1 && (
        <GroupView entries={groupKpis} activeId={workspaceId} />
      )}
      {/* OFFICE view temporarily disabled — investigating 500 on Cloudflare */}
      {view === "OFFICE" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🏢</p>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Office View</h3>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Coming back shortly — switch to CEO Command Centre above.</p>
        </div>
      )}

      {/* FOOTER */}
      <div
        style={{
          marginTop: 24,
          color: C.dim,
          fontSize: 11,
          textAlign: "center",
          paddingBottom: 8,
        }}
      >
        ActionCOACH Profit Formula · {period} view · Numbers are{" "}
        <button
          onClick={() => setEditOpen(true)}
          style={{
            background: "none",
            border: "none",
            color: C.gold,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          editable — click to update
        </button>
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <EditModal
          kpi={kpi}
          onSave={handleSave}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
