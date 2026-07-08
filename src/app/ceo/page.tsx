import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listAccessibleEntities } from "@/lib/ceo-dashboard/access";
import {
  ventureHealth,
  type KpiForHealth,
  type TrafficStatus,
} from "@/lib/ceo-dashboard/formulas";
import { periodStartFor, periodLabel } from "@/lib/ceo-dashboard/periods";
import { INDUSTRY_LABELS, fmtMoney, fmtPct } from "@/lib/ceo-dashboard/types";
import type {
  KpiDefinitionRow,
  KpiSnapshotRow,
  RedActionRow,
} from "@/lib/ceo-dashboard/types";

export const dynamic = "force-dynamic";

const TRAFFIC_COLOR: Record<TrafficStatus, string> = {
  green: "var(--success)",
  yellow: "var(--amber)",
  red: "var(--red)",
};

const BADGE_LABEL: Record<TrafficStatus, string> = {
  green: "HEALTHY",
  yellow: "WATCH",
  red: "RED",
};

type VentureView = {
  id: string;
  name: string;
  industry: string;
  currency: string;
  weight: number;
  badge: TrafficStatus | "nodata";
  score: number;
  redCount: number;
  salesActual: number | null;
  salesAttainment: number | null;
  salesStatus: TrafficStatus | null;
  worstLine: string | null;
  worstStatus: TrafficStatus | null;
};

export default async function CeoGroupOverviewPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect("/onboarding");

  const entities = await listAccessibleEntities(user.id, ctx.workspace.id);
  const admin = createSupabaseAdminClient();
  const month = periodStartFor(new Date(), "monthly");
  const ids = entities.map((e) => e.id);

  const [pnlRes, bsRes, snapshotsRes, defsRes, debtRes, actionsRes] = ids.length
    ? await Promise.all([
        admin
          .from("ceo_pnl_entries")
          .select("entity_id, sales")
          .in("entity_id", ids)
          .eq("period_start", month)
          .eq("granularity", "monthly"),
        admin
          .from("ceo_balance_sheet_entries")
          .select("entity_id, cash_bank, period_start")
          .in("entity_id", ids)
          .order("period_start", { ascending: false })
          .limit(120),
        admin
          .from("ceo_kpi_snapshots")
          .select("*")
          .in("entity_id", ids)
          .eq("period_start", month)
          .eq("granularity", "monthly"),
        admin.from("ceo_kpi_definitions").select("*").eq("is_active", true),
        admin
          .from("ceo_group_debt_service")
          .select("*")
          .eq("org_id", ctx.workspace.id),
        admin
          .from("ceo_red_actions")
          .select("*")
          .in("entity_id", ids)
          .in("status", ["open", "in_progress", "escalated"])
          .order("created_at"),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const snapshots = (snapshotsRes.data ?? []) as KpiSnapshotRow[];
  const defs = (defsRes.data ?? []) as KpiDefinitionRow[];
  const defById = new Map(defs.map((d) => [d.id, d]));

  // Owner names for the action log
  const actions = (actionsRes.data ?? []) as RedActionRow[];
  const ownerIds = [
    ...new Set(actions.map((a) => a.owner_id).filter(Boolean)),
  ] as string[];
  const { data: ownerProfiles } = ownerIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ownerIds)
    : { data: [] };
  const ownerById = new Map(
    (ownerProfiles ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const salesByEntity = new Map(
    (pnlRes.data ?? []).map((r) => [r.entity_id, Number(r.sales)]),
  );
  const cashByEntity = new Map<string, number>();
  for (const r of bsRes.data ?? []) {
    if (!cashByEntity.has(r.entity_id))
      cashByEntity.set(r.entity_id, Number(r.cash_bank));
  }

  const ventures: VentureView[] = entities.map((e) => {
    const snaps = snapshots.filter(
      (s) => s.entity_id === e.id && defById.has(s.kpi_id),
    );
    const forHealth: KpiForHealth[] = snaps.map((s) => ({
      attainmentPct: s.attainment_pct ?? 0,
      weight: defById.get(s.kpi_id)!.weight,
      status: s.status,
      isCritical: defById.get(s.kpi_id)!.is_critical,
    }));
    const health = ventureHealth(forHealth);

    const salesSnap = snaps.find((s) => {
      const d = defById.get(s.kpi_id)!;
      return d.source_kind === "pnl" && d.source_ref === "sales";
    });

    const worstSnap = [...snaps].sort(
      (a, b) => (a.attainment_pct ?? 0) - (b.attainment_pct ?? 0),
    )[0];
    const worstDef = worstSnap ? defById.get(worstSnap.kpi_id) : null;

    return {
      id: e.id,
      name: e.name,
      industry: INDUSTRY_LABELS[e.industry_type],
      currency: e.currency,
      weight: Number(e.sort_weight) || 0,
      badge: snaps.length === 0 ? "nodata" : health.badge,
      score: health.score,
      redCount: health.redCount,
      salesActual: salesByEntity.get(e.id) ?? null,
      salesAttainment: salesSnap?.attainment_pct ?? null,
      salesStatus: salesSnap?.status ?? null,
      worstLine:
        worstSnap && worstDef && worstSnap.status !== "green"
          ? `${worstDef.name}: ${fmtPct(worstSnap.attainment_pct ?? 0, 0)} of target`
          : null,
      worstStatus: worstSnap?.status ?? null,
    };
  });

  const ORDER: Record<VentureView["badge"], number> = {
    red: 0,
    yellow: 1,
    green: 2,
    nodata: 3,
  };
  ventures.sort(
    (a, b) => ORDER[a.badge] - ORDER[b.badge] || b.weight - a.weight,
  );

  const groupSales = ventures.reduce((s, v) => s + (v.salesActual ?? 0), 0);
  const groupCash = [...cashByEntity.values()].reduce((s, v) => s + v, 0);
  const debtService = (debtRes.data ?? []).reduce(
    (s: number, r: { total_monthly_commitment: number }) =>
      s + Number(r.total_monthly_commitment),
    0,
  );
  const redOpen = snapshots.filter((s) => s.status === "red").length;
  const escalated = actions.filter((a) => a.status === "escalated").length;

  const totalWeight = ventures.reduce((s, v) => s + v.weight, 0);
  const healthyCount = ventures.filter((v) => v.badge === "green").length;
  const watchCount = ventures.filter((v) => v.badge === "yellow").length;
  const redCount = ventures.filter((v) => v.badge === "red").length;

  const dim = "#8597B8";
  const line = "var(--line)";

  const kpiNameForAction = (a: RedActionRow) => {
    const snap = snapshots.find((s) => s.id === a.kpi_snapshot_id);
    const def = snap ? defById.get(snap.kpi_id) : null;
    const entity = entities.find((e) => e.id === a.entity_id);
    return `${entity?.name ?? "—"}${def ? ` — ${def.name}` : ""}`;
  };

  const hoursOpen = (a: RedActionRow) =>
    Math.floor((Date.now() - new Date(a.created_at).getTime()) / 3_600_000);

  return (
    <main
      style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 60px" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 26,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {ctx.workspace.name} — CEO Command Center
          </div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(26px, 4vw, 38px)",
              letterSpacing: "-0.01em",
            }}
          >
            Assalamualaikum, Coach
          </h1>
          <div style={{ color: dim, fontSize: 13, marginTop: 4 }}>
            {periodLabel(month, "monthly")} · {ventures.length} venture
            {ventures.length === 1 ? "" : "s"} ·{" "}
            <span style={{ color: redOpen > 0 ? "var(--red)" : dim }}>
              {redOpen} red KPI{redOpen === 1 ? "" : "s"} need you
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/ceo/cf-ai"
            style={{
              background: "var(--gold)",
              color: "#101318",
              borderRadius: 10,
              padding: "9px 15px",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.06em",
            }}
          >
            Talk to CF ai
          </Link>
          <Link
            href="/ceo/entities"
            style={{
              border: `1px solid ${line}`,
              borderRadius: 10,
              padding: "9px 15px",
              fontSize: 12,
              fontWeight: 600,
              color: dim,
              textDecoration: "none",
              letterSpacing: "0.06em",
            }}
          >
            Manage ventures & roles
          </Link>
        </div>
      </header>

      {ventures.length === 0 ? (
        <section
          style={{
            background: "var(--panel)",
            border: `1px solid ${line}`,
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            No ventures yet
          </div>
          <div style={{ color: dim, fontSize: 13, marginBottom: 18 }}>
            Add your first venture (e.g. Ahmad&apos;s HotChicken) and its KPIs,
            then enter numbers venture by venture.
          </div>
          <Link
            href="/ceo/entities"
            style={{
              background: "var(--gold)",
              color: "#101318",
              fontWeight: 700,
              borderRadius: 8,
              padding: "10px 18px",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Add first venture
          </Link>
        </section>
      ) : (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 26,
            }}
          >
            <div
              style={{
                background: "var(--panel)",
                border: `1px solid ${line}`,
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: dim,
                  marginBottom: 8,
                }}
              >
                Group Sales MTD
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtMoney(groupSales)}
              </div>
              <div style={{ fontSize: 12, color: dim, marginTop: 4 }}>
                Sum of ventures with P&L entered
              </div>
            </div>
            <div
              style={{
                background: "var(--panel)",
                border: `1px solid ${line}`,
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: dim,
                  marginBottom: 8,
                }}
              >
                Group Cash Position
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtMoney(groupCash)}
              </div>
              <div style={{ fontSize: 12, color: dim, marginTop: 4 }}>
                Latest balance-sheet cash per venture
              </div>
            </div>
            <div
              style={{
                background: "var(--panel)",
                border: `1px solid ${line}`,
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: dim,
                  marginBottom: 8,
                }}
              >
                Monthly Debt Service
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtMoney(debtService)}
              </div>
              <div style={{ fontSize: 12, color: dim, marginTop: 4 }}>
                Bank facilities + other debts
              </div>
            </div>
            <div
              style={{
                background:
                  redOpen > 0
                    ? "linear-gradient(0deg, rgba(224,82,82,.14), rgba(224,82,82,.14)), var(--panel)"
                    : "var(--panel)",
                border: `1px solid ${redOpen > 0 ? "rgba(224,82,82,.45)" : line}`,
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: dim,
                  marginBottom: 8,
                }}
              >
                Red KPIs Open
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: redOpen > 0 ? "var(--red)" : undefined,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {redOpen}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: escalated > 0 ? "var(--red)" : dim,
                  marginTop: 4,
                }}
              >
                {escalated > 0
                  ? `${escalated} escalated past 48 hours`
                  : "None escalated"}
              </div>
            </div>
          </section>

          <section
            style={{
              background: "var(--panel)",
              border: `1px solid ${line}`,
              borderRadius: 14,
              padding: 18,
              marginBottom: 26,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>Group Pulse</div>
              <div style={{ fontSize: 12, color: dim }}>
                Segment width = revenue weight · colour = venture health
              </div>
            </div>
            <div
              style={{
                display: "flex",
                height: 34,
                borderRadius: 8,
                overflow: "hidden",
                gap: 2,
              }}
            >
              {ventures.map((v) => (
                <Link
                  key={v.id}
                  href={`/ceo/${v.id}`}
                  title={`${v.name} — ${v.badge === "nodata" ? "no data" : BADGE_LABEL[v.badge as TrafficStatus]}`}
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${totalWeight > 0 ? Math.max(3, (v.weight / totalWeight) * 100) : 100 / ventures.length}%`,
                    background:
                      v.badge === "nodata"
                        ? "var(--panel2)"
                        : TRAFFIC_COLOR[v.badge as TrafficStatus],
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 12,
                fontSize: 12,
                color: dim,
                flexWrap: "wrap",
              }}
            >
              <span>
                <i
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    marginRight: 6,
                    background: "var(--success)",
                  }}
                />
                Healthy — {healthyCount}
              </span>
              <span>
                <i
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    marginRight: 6,
                    background: "var(--amber)",
                  }}
                />
                Watch — {watchCount}
              </span>
              <span>
                <i
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    marginRight: 6,
                    background: "var(--red)",
                  }}
                />
                Action needed — {redCount}
              </span>
            </div>
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>Ventures</div>
            <div style={{ fontSize: 12, color: dim }}>
              Sorted red first — worst news at the top, always
            </div>
          </div>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
              gap: 12,
              marginBottom: 30,
            }}
          >
            {ventures.map((v) => {
              const borderCol =
                v.badge === "red"
                  ? "rgba(224,82,82,.5)"
                  : v.badge === "yellow"
                    ? "rgba(227,169,60,.4)"
                    : line;
              return (
                <Link
                  key={v.id}
                  href={`/ceo/${v.id}`}
                  style={{
                    background: "var(--panel)",
                    border: `1px solid ${borderCol}`,
                    borderRadius: 14,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {v.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: dim,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginTop: 2,
                        }}
                      >
                        {v.industry}
                      </div>
                    </div>
                    {v.badge === "nodata" ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          padding: "5px 10px",
                          borderRadius: 999,
                          color: dim,
                          background: "var(--panel2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        NO DATA
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          padding: "5px 10px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                          color: TRAFFIC_COLOR[v.badge as TrafficStatus],
                          background: `color-mix(in srgb, ${TRAFFIC_COLOR[v.badge as TrafficStatus]} 14%, transparent)`,
                        }}
                      >
                        ● {BADGE_LABEL[v.badge as TrafficStatus]}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                    }}
                  >
                    <span style={{ color: dim }}>Sales MTD</span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {v.salesActual !== null
                        ? fmtMoney(v.salesActual, v.currency)
                        : "—"}
                      {v.salesAttainment !== null
                        ? ` · ${fmtPct(v.salesAttainment, 0)}`
                        : ""}
                    </span>
                  </div>
                  {v.salesAttainment !== null ? (
                    <div
                      style={{
                        height: 5,
                        background: "var(--panel2)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(2, v.salesAttainment))}%`,
                          background: TRAFFIC_COLOR[v.salesStatus ?? "yellow"],
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  ) : null}

                  <div
                    style={{
                      fontSize: 12,
                      paddingTop: 8,
                      borderTop: `1px solid ${line}`,
                      color: v.worstLine
                        ? TRAFFIC_COLOR[
                            (v.worstStatus ?? "yellow") as TrafficStatus
                          ]
                        : dim,
                    }}
                  >
                    {v.worstLine ??
                      (v.badge === "nodata"
                        ? "Enter data to light this venture up"
                        : "All KPIs green or on target")}
                  </div>
                </Link>
              );
            })}
          </section>

          <section
            style={{
              background: "var(--panel)",
              border: `1px solid ${line}`,
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                Red KPI Action Log
              </div>
              <div style={{ fontSize: 12, color: dim }}>
                Every red gets an owner and a 48-hour clock
              </div>
            </div>
            {actions.length === 0 ? (
              <div style={{ color: dim, fontSize: 13, padding: "12px 0" }}>
                No open red actions.
              </div>
            ) : (
              actions
                .sort(
                  (a, b) =>
                    (a.status === "escalated" ? -1 : 0) -
                    (b.status === "escalated" ? -1 : 0),
                )
                .map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "10px 1fr auto",
                      gap: 14,
                      alignItems: "start",
                      padding: "13px 0",
                      borderBottom: `1px solid ${line}`,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        marginTop: 5,
                        background:
                          a.status === "in_progress"
                            ? "var(--amber)"
                            : "var(--red)",
                        boxShadow:
                          a.status === "escalated"
                            ? "0 0 0 4px rgba(224,82,82,.14)"
                            : undefined,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {kpiNameForAction(a)}
                      </div>
                      <div style={{ fontSize: 12, color: dim, marginTop: 3 }}>
                        Owner:{" "}
                        {a.owner_id ? (ownerById.get(a.owner_id) ?? "—") : "—"}{" "}
                        · {a.action_note}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: dim,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          color:
                            a.status === "escalated" ? "var(--red)" : "inherit",
                          fontWeight: 600,
                        }}
                      >
                        {a.status === "escalated"
                          ? "ESCALATED"
                          : a.deadline
                            ? `Due ${a.deadline}`
                            : "Open"}
                      </strong>
                      {hoursOpen(a)} hours open
                    </div>
                  </div>
                ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
