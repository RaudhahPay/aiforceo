"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { compute, C } from "@/app/_components/dashboard-primitives";
import { DepartmentWorkspace, type DepartmentConfig, type QuickAction } from "@/app/_components/DepartmentWorkspace";
import { SalesKPIView } from "@/app/_components/views/SalesKPIView";
import { MarketingKPIView } from "@/app/_components/views/MarketingKPIView";
import { FinanceKPIView } from "@/app/_components/views/FinanceKPIView";
import { OperationsKPIView } from "@/app/_components/views/OperationsKPIView";
import { AnomalyBanner } from "@/app/_components/AnomalyBanner";
import { BenchmarkWidget } from "@/app/_components/BenchmarkWidget";
import { ProjectionCard } from "@/app/_components/ProjectionCard";
import type { WorkspaceKPI, MonthlyKPIRecord, PeriodRaw } from "@/lib/kpi/types";
import { ZERO_PERIOD, ZERO_FINANCE, ZERO_OPS } from "@/lib/kpi/types";
import { buildKPIView, detectAnomalies } from "@/lib/kpi/rollup";

// Recharts components need SSR disabled
const RevenueTrendChart = dynamic(
  () => import("@/app/_components/charts/RevenueTrendChart").then((m) => ({ default: m.RevenueTrendChart })),
  { ssr: false }
);

type DepartmentType = "sales" | "marketing" | "finance" | "operations";

const DEPARTMENT_CONFIG: Record<DepartmentType, DepartmentConfig> = {
  sales: { label: "Sales & Profit", icon: "💰", accent: C.gold },
  marketing: { label: "Marketing", icon: "📣", accent: C.blue },
  finance: { label: "Finance", icon: "📊", accent: C.green },
  operations: { label: "Operations", icon: "⚙", accent: C.copper },
};

const QUICK_ACTIONS: Record<DepartmentType, QuickAction[]> = {
  sales: [
    { label: "Analyze my profit formula", prompt: "Analyze my profit formula" },
    { label: "Show breakeven analysis", prompt: "Show breakeven analysis" },
    { label: "What-if: raise prices 5%", prompt: "What-if: raise prices 5%" },
  ],
  marketing: [
    { label: "Review my channel performance", prompt: "Review my channel performance" },
    { label: "Draft a 7-day content calendar", prompt: "Draft a 7-day content calendar" },
    { label: "Which channel should I cut?", prompt: "Which channel should I cut?" },
  ],
  finance: [
    { label: "Analyze my P&L this month", prompt: "Analyze my P&L this month" },
    { label: "Build a 90-day cash flow forecast", prompt: "Build a 90-day cash flow forecast" },
    { label: "Review my AR aging", prompt: "Review my AR aging" },
  ],
  operations: [
    { label: "Check my capacity utilization", prompt: "Check my capacity utilization" },
    { label: "Staff efficiency review", prompt: "Staff efficiency review" },
    { label: "Customer satisfaction deep-dive", prompt: "Customer satisfaction deep-dive" },
  ],
};

function defaultKPI(): WorkspaceKPI {
  return {
    periods: { MTD: { ...ZERO_PERIOD }, QTD: { ...ZERO_PERIOD }, YTD: { ...ZERO_PERIOD } },
    finance: { ...ZERO_FINANCE },
    marketing: [],
    ops: { ...ZERO_OPS },
  };
}

type Msg = { role: "user" | "assistant"; content: string; id?: string };
type PastConv = { id: string; title: string; updatedAt: string };

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatMonth(m: string) { const [y, mo] = m.split("-"); return `${MONTH_NAMES[parseInt(mo!, 10) - 1]} ${y}`; }

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--muted)",
        padding: "12px 0 6px",
        borderTop: "1px solid var(--line)",
        marginTop: 8,
      }}
    >
      {title}
    </div>
  );
}

export function DepartmentPage({
  type,
  kpi: kpiProp,
  monthlyRecords = [],
  defaultMonth,
  industry = null,
  // Chat data
  role,
  agent,
  workspaceName,
  conversationId,
  initialMessages,
  pastConversations,
}: {
  type: DepartmentType;
  kpi: WorkspaceKPI | null;
  monthlyRecords?: MonthlyKPIRecord[];
  defaultMonth?: string;
  industry?: string | null;
  role: string;
  agent: { name: string; title: string; tag: string; gradient: readonly [string, string] };
  workspaceName: string;
  conversationId: string;
  initialMessages: Msg[];
  pastConversations: PastConv[];
}) {
  const now = new Date();
  const currentMonthStr = defaultMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [period, setPeriod] = useState<"MTD" | "QTD" | "YTD">("MTD");

  // Build available months: all months of current year + any with data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const yr = now.getFullYear();
    for (let m = 0; m <= now.getMonth(); m++) months.add(`${yr}-${String(m + 1).padStart(2, "0")}`);
    for (const rec of monthlyRecords) months.add(rec.month);
    return Array.from(months).sort().reverse();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyRecords]);

  // Recompute KPIs when month changes
  const kpi = useMemo(() => {
    if (monthlyRecords.length > 0) return buildKPIView(monthlyRecords, selectedMonth);
    return kpiProp ?? defaultKPI();
  }, [monthlyRecords, selectedMonth, kpiProp]);

  // Detect anomalies for selected month
  const anomalies = useMemo(() => {
    if (monthlyRecords.length === 0) return [];
    return detectAnomalies(monthlyRecords, selectedMonth);
  }, [monthlyRecords, selectedMonth]);

  const d = useMemo(() => compute(kpi.periods[period] as PeriodRaw), [kpi, period]);
  const dept = DEPARTMENT_CONFIG[type];

  const showTrendChart = (type === "sales" || type === "marketing" || type === "finance") && monthlyRecords.length >= 2;
  const showProjection = (type === "sales" || type === "finance") && monthlyRecords.length >= 2;
  const showBenchmark = !!industry && !!kpi;

  const kpiViewNode = useMemo(() => {
    switch (type) {
      case "sales":
        return <SalesKPIView d={d} period={period} accent={dept.accent} />;
      case "marketing":
        return <MarketingKPIView d={d} marketing={kpi.marketing} accent={dept.accent} />;
      case "finance":
        return <FinanceKPIView d={d} f={kpi.finance} accent={dept.accent} />;
      case "operations":
        return <OperationsKPIView o={kpi.ops} accent={dept.accent} />;
    }
  }, [type, d, period, kpi, dept.accent]);

  // Month picker dropdown
  const monthPickerNode = availableMonths.length > 1 ? (
    <div style={{ marginBottom: 12 }}>
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        style={{
          padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
          border: `1px solid var(--line)`, background: "var(--panel)", color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        {availableMonths.map(m => {
          const hasData = monthlyRecords.some(r => r.month === m);
          return <option key={m} value={m}>{formatMonth(m)}{hasData ? "" : " ·"}</option>;
        })}
      </select>
    </div>
  ) : null;

  const chartColor =
    type === "sales" ? C.gold :
    type === "marketing" ? C.blue :
    type === "finance" ? C.green :
    C.copper;

  const analyticsNode = (
    <>
      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <>
          <SectionHeader title="Anomaly Alerts" />
          <AnomalyBanner anomalies={anomalies} />
        </>
      )}

      {/* Revenue trend chart */}
      {showTrendChart && (
        <>
          <SectionHeader title="Revenue Trend" />
          <div
            style={{
              borderRadius: 8,
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              padding: "12px 8px 8px",
              marginBottom: 8,
            }}
          >
            <RevenueTrendChart
              records={monthlyRecords}
              height={160}
              color={chartColor}
            />
          </div>
        </>
      )}

      {/* Projections */}
      {showProjection && (
        <>
          <SectionHeader title="Projections" />
          <ProjectionCard
            records={monthlyRecords}
            selectedMonth={selectedMonth}
            showFinance={type === "finance"}
          />
        </>
      )}

      {/* Industry benchmarks */}
      {showBenchmark && (
        <>
          <SectionHeader title="Industry Benchmarks" />
          <BenchmarkWidget industry={industry!} kpi={kpi} />
        </>
      )}
    </>
  );

  const kpiWithExtras = (
    <>
      {monthPickerNode}
      {kpiViewNode}
      {analyticsNode}
    </>
  );

  return (
    <DepartmentWorkspace
      department={dept}
      kpiView={kpiWithExtras}
      period={period}
      onPeriodChange={setPeriod}
      role={role}
      agent={agent}
      workspaceName={workspaceName}
      conversationId={conversationId}
      initialMessages={initialMessages}
      pastConversations={pastConversations}
      quickActions={QUICK_ACTIONS[type]}
    />
  );
}
