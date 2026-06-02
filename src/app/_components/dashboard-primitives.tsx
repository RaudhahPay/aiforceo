"use client";

import type { PeriodRaw, PeriodData } from "@/lib/kpi/types";

/* ─── THEME ──────────────────────────────────────────────────── */
export const C = {
  ink: "var(--bg)",
  panel: "var(--panel)",
  panel2: "var(--panel2)",
  line: "var(--line)",
  gold: "var(--accent)",
  copper: "#C97B3A",
  green: "var(--success)",
  red: "var(--red)",
  amber: "var(--amber)",
  text: "#E8EDF6",
  dim: "#8597B8",
  blue: "#2E7DD1",
  pink: "#F96167",
  teal: "#2A9D8F",
};

/* ─── FORMAT HELPERS ─────────────────────────────────────────── */
export const rm = (n: number) => "RM " + Math.round(n).toLocaleString("en-MY");
export const pct = (n: number) => (n * 100).toFixed(1) + "%";
export const num = (n: number) => Math.round(n).toLocaleString("en-MY");

export function relTime(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─── COMPUTE PERIOD ─────────────────────────────────────────── */
export function compute(r: PeriodRaw): PeriodData {
  const prospects = Math.round(r.reach * r.leadCR);
  const funnelCustomers = Math.round(prospects * r.saleCR);
  const funnelSales = Math.round(funnelCustomers * r.avgSale * r.avgTxn);

  // If direct revenue is set, use it. Otherwise compute from funnel.
  const sales = r.revenue ?? funnelSales;
  const customers = funnelCustomers > 0 ? funnelCustomers : (r.orders ?? 0);
  const gp = Math.round(sales * r.gpPct);
  const ebitda = gp - r.opex;
  const breakeven = r.gpPct > 0 ? Math.round(r.fixedCost / r.gpPct) : 0;
  return { ...r, prospects, customers, sales, gp, ebitda, breakeven };
}

/* ─── MoM TREND ARROW ────────────────────────────────────────── */
export function TrendArrow({ delta }: { delta: number | undefined }) {
  if (delta === undefined) return null;
  const pctStr = (Math.abs(delta) * 100).toFixed(1) + "%";
  const isUp = delta > 0;
  const color = isUp ? C.green : C.red;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 4 }}>
      {isUp ? "▲" : "▼"} {pctStr}
    </span>
  );
}

/* ─── SMALL UI PIECES ────────────────────────────────────────── */
export function Stat({
  label,
  value,
  sub,
  tone,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "warn";
  delta?: number;
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
        <TrendArrow delta={delta} />
      </div>
      {sub && (
        <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

export function Bar({
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

export function Panel({
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

export function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
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
export function FiveWays({ d, accent }: { d: PeriodData; accent: string }) {
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
