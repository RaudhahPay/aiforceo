"use client";

import { useState, useMemo } from "react";
import { compute, C } from "@/app/_components/dashboard-primitives";
import { DepartmentWorkspace, type DepartmentConfig, type QuickAction } from "@/app/_components/DepartmentWorkspace";
import { SalesKPIView } from "@/app/_components/views/SalesKPIView";
import { MarketingKPIView } from "@/app/_components/views/MarketingKPIView";
import { FinanceKPIView } from "@/app/_components/views/FinanceKPIView";
import { OperationsKPIView } from "@/app/_components/views/OperationsKPIView";
import type { WorkspaceKPI, PeriodRaw } from "@/lib/kpi/types";
import { ZERO_PERIOD, ZERO_FINANCE, ZERO_OPS } from "@/lib/kpi/types";

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

export function DepartmentPage({
  type,
  kpi: kpiProp,
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
  role: string;
  agent: { name: string; title: string; tag: string; gradient: readonly [string, string] };
  workspaceName: string;
  conversationId: string;
  initialMessages: Msg[];
  pastConversations: PastConv[];
}) {
  const [period, setPeriod] = useState<"MTD" | "QTD" | "YTD">("MTD");
  const kpi = kpiProp ?? defaultKPI();

  const d = useMemo(() => compute(kpi.periods[period] as PeriodRaw), [kpi, period]);
  const dept = DEPARTMENT_CONFIG[type];

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

  return (
    <DepartmentWorkspace
      department={dept}
      kpiView={kpiViewNode}
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
