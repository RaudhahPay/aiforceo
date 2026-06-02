"use client";

import type { OpsData } from "@/lib/kpi/types";
import { C, rm, pct, num, Stat, Bar, Panel } from "@/app/_components/dashboard-primitives";

export function OperationsKPIView({
  o,
  accent,
}: {
  o: OpsData;
  accent?: string;
}) {
  const a = accent ?? C.copper;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="People / HR" accent={a}>
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
