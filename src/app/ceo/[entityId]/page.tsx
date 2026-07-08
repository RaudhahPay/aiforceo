import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEntityAccess } from "@/lib/ceo-dashboard/access";
import {
  GRANULARITIES,
  GRANULARITY_LABELS,
  periodLabel,
  periodRange,
  periodStartFor,
  shiftPeriod,
  type Granularity,
} from "@/lib/ceo-dashboard/periods";
import { ventureHealth, type KpiForHealth } from "@/lib/ceo-dashboard/formulas";
import { INDUSTRY_LABELS } from "@/lib/ceo-dashboard/types";
import type {
  BalanceSheetRow,
  BankFacilityRow,
  CapexRow,
  CashflowRow,
  ChannelMetricRow,
  CustomerHappinessRow,
  FunnelRow,
  InvoiceRow,
  AgingRow,
  KpiDefinitionRow,
  KpiSnapshotRow,
  MetricDefinitionRow,
  OpsMetricRow,
  OtherDebtRow,
  PnlRow,
  RedActionRow,
  StaffHappinessRow,
  StrategyRow,
} from "@/lib/ceo-dashboard/types";
import { FinancialTab } from "./tabs/FinancialTab";
import { MarketingTab } from "./tabs/MarketingTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { KpiTab } from "./tabs/KpiTab";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "financial", label: "Financial" },
  { key: "marketing", label: "Sales & Marketing" },
  { key: "operations", label: "Operations" },
  { key: "kpi", label: "KPI Board" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function EntityDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ tab?: string; g?: string; p?: string }>;
}) {
  const [{ entityId }, sp] = await Promise.all([params, searchParams]);

  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  let access;
  try {
    access = await getEntityAccess(user.id, entityId);
  } catch (e) {
    if (e instanceof AuthError) redirect("/ceo");
    throw e;
  }
  if (access.roles.size === 0) redirect("/ceo");

  const { entity, roles } = access;
  const tab: TabKey = (
    TABS.some((t) => t.key === sp.tab) ? sp.tab : "financial"
  ) as TabKey;
  const g: Granularity = (GRANULARITIES as string[]).includes(sp.g ?? "")
    ? (sp.g as Granularity)
    : "monthly";
  const period =
    sp.p && /^\d{4}-\d{2}-\d{2}$/.test(sp.p)
      ? sp.p
      : periodStartFor(new Date(), g);
  // Balance sheet only exists at monthly+; coarser bucket for finer views
  const bsGranularity: Granularity =
    g === "daily" || g === "weekly" ? "monthly" : g;
  const bsPeriod = periodStartFor(new Date(period), bsGranularity);
  const range = periodRange(period, g);

  const admin = createSupabaseAdminClient();

  const [
    pnlRes,
    pnlHistoryRes,
    bsRes,
    cashflowRes,
    capexRes,
    arRes,
    apRes,
    arAgingRes,
    apAgingRes,
    debtsRes,
    facilitiesRes,
    funnelRes,
    strategiesRes,
    channelsRes,
    staffRes,
    customerRes,
    metricDefsRes,
    opsMetricsRes,
    kpiDefsRes,
    snapshotsRes,
    redActionsRes,
  ] = await Promise.all([
    admin
      .from("ceo_pnl_entries")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", period)
      .eq("granularity", g)
      .maybeSingle(),
    admin
      .from("ceo_pnl_entries")
      .select("*")
      .eq("entity_id", entityId)
      .eq("granularity", g)
      .order("period_start", { ascending: false })
      .limit(12),
    admin
      .from("ceo_balance_sheet_entries")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", bsPeriod)
      .eq("granularity", bsGranularity)
      .maybeSingle(),
    admin
      .from("ceo_cashflow_entries")
      .select("*")
      .eq("entity_id", entityId)
      .gte("txn_date", range.start)
      .lt("txn_date", range.end)
      .order("txn_date", { ascending: false }),
    admin
      .from("ceo_capex_items")
      .select("*")
      .eq("entity_id", entityId)
      .order("spend_date", { ascending: false })
      .limit(100),
    admin
      .from("ceo_ar_invoices")
      .select("*")
      .eq("entity_id", entityId)
      .order("due_date")
      .limit(200),
    admin
      .from("ceo_ap_invoices")
      .select("*")
      .eq("entity_id", entityId)
      .order("due_date")
      .limit(200),
    admin
      .from("ceo_ar_aging")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
    admin
      .from("ceo_ap_aging")
      .select("*")
      .eq("entity_id", entityId)
      .maybeSingle(),
    admin
      .from("ceo_other_debts")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at"),
    admin
      .from("ceo_bank_facilities")
      .select("*")
      .eq("entity_id", entityId)
      .order("next_payment_date"),
    admin
      .from("ceo_funnel_entries")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", period)
      .eq("granularity", g)
      .maybeSingle(),
    admin
      .from("ceo_marketing_strategies")
      .select("*")
      .eq("entity_id", entityId)
      .order("status")
      .order("created_at", { ascending: false }),
    admin
      .from("ceo_channel_metrics")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", period)
      .eq("granularity", g),
    admin
      .from("ceo_staff_happiness")
      .select("*")
      .eq("entity_id", entityId)
      .order("period_start", { ascending: false })
      .limit(12),
    admin
      .from("ceo_customer_happiness")
      .select("*")
      .eq("entity_id", entityId)
      .order("period_start", { ascending: false })
      .limit(12),
    admin
      .from("ceo_metric_definitions")
      .select("*")
      .in("industry_type", [entity.industry_type, "other"])
      .order("code"),
    admin
      .from("ceo_ops_metrics")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", period)
      .order("metric_code"),
    admin
      .from("ceo_kpi_definitions")
      .select("*")
      .eq("is_active", true)
      .or(
        `entity_id.eq.${entityId},and(entity_id.is.null,industry_type.eq.${entity.industry_type})`,
      ),
    admin
      .from("ceo_kpi_snapshots")
      .select("*")
      .eq("entity_id", entityId)
      .eq("period_start", period)
      .eq("granularity", g),
    admin
      .from("ceo_red_actions")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const kpiDefs = (kpiDefsRes.data ?? []) as KpiDefinitionRow[];
  const snapshots = (snapshotsRes.data ?? []) as KpiSnapshotRow[];
  const defById = new Map(kpiDefs.map((d) => [d.id, d]));
  const forHealth: KpiForHealth[] = snapshots
    .filter((s) => defById.has(s.kpi_id))
    .map((s) => ({
      attainmentPct: s.attainment_pct ?? 0,
      weight: defById.get(s.kpi_id)!.weight,
      status: s.status,
      isCritical: defById.get(s.kpi_id)!.is_critical,
    }));
  const health = ventureHealth(forHealth);

  const capexAll = (capexRes.data ?? []) as CapexRow[];
  const capexInPeriod = capexAll.filter(
    (c) => c.spend_date >= range.start && c.spend_date < range.end,
  );

  const can = {
    finance: roles.has("finance"),
    marketing: roles.has("marketing"),
    ops: roles.has("ops"),
    exec: roles.has("group_ceo") || roles.has("venture_ceo"),
    kpiAdmin: roles.has("group_ceo") || roles.has("admin"),
  };

  const urlFor = (t: TabKey, gg: Granularity = g, pp: string = period) =>
    `/ceo/${entityId}?tab=${t}&g=${gg}&p=${pp}`;

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
          marginBottom: 8,
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
            <Link
              href="/ceo"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              ← CEO Command Center
            </Link>
          </div>
          <h1
            style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.01em" }}
          >
            {entity.name}
          </h1>
          <div style={{ color: "#8597B8", fontSize: 13, marginTop: 4 }}>
            {INDUSTRY_LABELS[entity.industry_type]} · {periodLabel(period, g)} ·
            Health score {health.score.toFixed(0)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {GRANULARITIES.map((gg) => (
              <Link
                key={gg}
                href={urlFor(tab, gg, periodStartFor(new Date(period), gg))}
                style={{
                  padding: "8px 13px",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: "0.06em",
                  background: gg === g ? "var(--gold)" : "transparent",
                  color: gg === g ? "#101318" : "#8597B8",
                }}
              >
                {GRANULARITY_LABELS[gg]}
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Link
              href={urlFor(tab, g, shiftPeriod(period, g, -1))}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "7px 11px",
                color: "#8597B8",
                textDecoration: "none",
              }}
            >
              ‹
            </Link>
            <Link
              href={urlFor(tab, g, shiftPeriod(period, g, 1))}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "7px 11px",
                color: "#8597B8",
                textDecoration: "none",
              }}
            >
              ›
            </Link>
          </div>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--line)",
          margin: "18px 0 22px",
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={urlFor(t.key)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: t.key === tab ? "var(--gold)" : "#8597B8",
              borderBottom:
                t.key === tab
                  ? "2px solid var(--gold)"
                  : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "financial" ? (
        <FinancialTab
          entityId={entityId}
          currency={entity.currency}
          period={period}
          granularity={g}
          bsPeriod={bsPeriod}
          bsGranularity={bsGranularity}
          canWrite={can.finance}
          pnl={(pnlRes.data as PnlRow | null) ?? null}
          pnlHistory={(pnlHistoryRes.data ?? []) as PnlRow[]}
          balanceSheet={(bsRes.data as BalanceSheetRow | null) ?? null}
          cashflow={(cashflowRes.data ?? []) as CashflowRow[]}
          capexInPeriod={capexInPeriod}
          capexAll={capexAll}
          arInvoices={(arRes.data ?? []) as InvoiceRow[]}
          apInvoices={(apRes.data ?? []) as InvoiceRow[]}
          arAging={(arAgingRes.data as AgingRow | null) ?? null}
          apAging={(apAgingRes.data as AgingRow | null) ?? null}
          otherDebts={(debtsRes.data ?? []) as OtherDebtRow[]}
          facilities={(facilitiesRes.data ?? []) as BankFacilityRow[]}
        />
      ) : null}

      {tab === "marketing" ? (
        <MarketingTab
          entityId={entityId}
          currency={entity.currency}
          period={period}
          granularity={g}
          canWrite={can.marketing || can.exec}
          canWriteChannels={can.marketing}
          funnel={(funnelRes.data as FunnelRow | null) ?? null}
          strategies={(strategiesRes.data ?? []) as StrategyRow[]}
          channels={(channelsRes.data ?? []) as ChannelMetricRow[]}
        />
      ) : null}

      {tab === "operations" ? (
        <OperationsTab
          entityId={entityId}
          period={period}
          canWrite={can.ops}
          staff={(staffRes.data ?? []) as StaffHappinessRow[]}
          customer={(customerRes.data ?? []) as CustomerHappinessRow[]}
          metricDefs={(metricDefsRes.data ?? []) as MetricDefinitionRow[]}
          opsMetrics={(opsMetricsRes.data ?? []) as OpsMetricRow[]}
        />
      ) : null}

      {tab === "kpi" ? (
        <KpiTab
          entityId={entityId}
          period={period}
          granularity={g}
          canManage={can.kpiAdmin}
          canAct={can.exec}
          health={health}
          kpiDefs={kpiDefs}
          snapshots={snapshots}
          redActions={(redActionsRes.data ?? []) as RedActionRow[]}
        />
      ) : null}
    </main>
  );
}
