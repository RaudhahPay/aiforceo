"use server";

import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { ZERO_PERIOD, ZERO_FINANCE, ZERO_OPS } from "@/lib/kpi/types";
import type { Channel } from "@/lib/kpi/types";
import { logAudit } from "@/lib/audit";

export type KPIUpdatePayload = {
  // Any subset of the WorkspaceKPI fields — only updates what's provided
  periods?: {
    MTD?: Partial<{
      reach: number; leadCR: number; saleCR: number;
      avgSale: number; avgTxn: number; gpPct: number;
      opex: number; capexMtd: number; capexYtd: number; fixedCost: number;
    }>;
    QTD?: Partial<Record<string, number>>;
    YTD?: Partial<Record<string, number>>;
    // Flat period fields (new format — no MTD wrapper)
    reach?: number; leadCR?: number; saleCR?: number;
    avgSale?: number; avgTxn?: number; gpPct?: number;
    opex?: number; capexMtd?: number; capexYtd?: number; fixedCost?: number;
  };
  finance?: Partial<{
    cashIn: number; cashOut: number; cashBalance: number;
    ar: number; ap: number; arOverdue: number;
    assets: number; liabilities: number; equity: number;
    debtPayment: number; noi: number; inventory: number; runwayMonths: number;
  }>;
  ops?: Partial<{
    headcount: number; openRoles: number; attrition: number; eNPS: number;
    productivityPerHead: number; trainingHrs: number; customers: number;
    repeatRate: number; csat: number; nps: number; complaints: number;
    resolved: number; onTimeDelivery: number; capacityUsed: number;
  }>;
  marketing?: Channel[];
};

/** Deep merge two objects — b overrides a for leaf values. */
function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (
      b[key] && typeof b[key] === "object" && !Array.isArray(b[key]) &&
      a[key] && typeof a[key] === "object" && !Array.isArray(a[key])
    ) {
      result[key] = deepMerge(a[key] as Record<string, unknown>, b[key] as Record<string, unknown>);
    } else if (b[key] !== undefined && b[key] !== null) {
      result[key] = b[key];
    }
  }
  return result;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Extract flat period fields from a periods payload.
 * Handles both old format (periods.MTD.reach) and new format (periods.reach).
 */
function extractPeriodData(periods: KPIUpdatePayload["periods"]): Record<string, unknown> {
  if (!periods) return {};

  // Check for flat fields first (new format — includes revenue/orders for completeness)
  const flatKeys = [
    "revenue", "orders",
    "reach", "leadCR", "saleCR", "avgSale", "avgTxn",
    "gpPct", "opex", "capexMtd", "capexYtd", "fixedCost",
  ];
  const flat: Record<string, unknown> = {};
  let hasFlat = false;
  for (const key of flatKeys) {
    const val = (periods as Record<string, unknown>)[key];
    if (val !== undefined && val !== null) {
      flat[key] = val;
      hasFlat = true;
    }
  }
  if (hasFlat) return flat;

  // Fall back to MTD wrapper (old format)
  if (periods.MTD) {
    return periods.MTD as Record<string, unknown>;
  }

  return {};
}

/**
 * Merge partial KPI updates into the workspace_kpi_months table.
 * Called by Aria after extracting data from screenshots/documents.
 *
 * @param payload — The partial KPI data to merge
 * @param targetMonth — Target month in YYYY-MM format (defaults to current month)
 */
export async function mergeKPIUpdate(
  payload: KPIUpdatePayload,
  targetMonth?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace" };

  const admin = createSupabaseAdminClient();

  // Verify ownership
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", ctx.workspace.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return { ok: false, error: "Unauthorized" };

  const month = targetMonth || currentMonth();

  // Load existing month record
  const { data: current } = await admin
    .from("workspace_kpi_months")
    .select("period_data, finance_data, ops_data, marketing")
    .eq("workspace_id", ctx.workspace.id)
    .eq("month", month)
    .maybeSingle();

  const existingPeriod = (current?.period_data as Record<string, unknown>) ?? { ...ZERO_PERIOD };
  const existingFinance = (current?.finance_data as Record<string, unknown>) ?? { ...ZERO_FINANCE };
  const existingOps = (current?.ops_data as Record<string, unknown>) ?? { ...ZERO_OPS };
  const existingMarketing = (current?.marketing as Channel[]) ?? [];

  // Extract and merge period data (handles both flat and MTD-wrapped formats)
  const periodUpdate = extractPeriodData(payload.periods);
  const mergedPeriod = deepMerge(existingPeriod, periodUpdate);

  // Merge finance
  const mergedFinance = payload.finance
    ? deepMerge(existingFinance, payload.finance as Record<string, unknown>)
    : existingFinance;

  // Merge ops
  const mergedOps = payload.ops
    ? deepMerge(existingOps, payload.ops as Record<string, unknown>)
    : existingOps;

  // Marketing: replace if provided, keep existing otherwise
  const mergedMarketing = payload.marketing ?? existingMarketing;

  const { error } = await admin
    .from("workspace_kpi_months")
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        month,
        period_data: mergedPeriod,
        finance_data: mergedFinance,
        ops_data: mergedOps,
        marketing: mergedMarketing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,month" },
    );

  if (error) return { ok: false, error: error.message };

  // Fire-and-forget audit log
  void logAudit({
    workspaceId: ctx.workspace.id,
    actorId: user.id,
    actorType: targetMonth ? "agent" : "user",
    agentRole: targetMonth ? "aria" : undefined,
    action: "kpi.update",
    entityType: "kpi",
    entityId: month,
    summary: `KPI data updated for ${month}${payload.periods ? ` — periods: ${JSON.stringify(payload.periods).slice(0, 120)}` : ""}`,
    metadata: { payload, targetMonth: targetMonth ?? null },
  });

  // Also update legacy workspace_kpis for backward compat
  const { data: allMonthly } = await admin
    .from("workspace_kpi_months")
    .select("month, period_data, finance_data, ops_data, marketing")
    .eq("workspace_id", ctx.workspace.id)
    .order("month", { ascending: true });

  if (allMonthly && allMonthly.length > 0) {
    // Build a legacy WorkspaceKPI from the latest month data
    const latest = allMonthly[allMonthly.length - 1]!;
    const legacyKpi = {
      periods: {
        MTD: latest.period_data,
        QTD: latest.period_data,
        YTD: latest.period_data,
      },
      finance: latest.finance_data,
      ops: latest.ops_data,
      marketing: latest.marketing,
    };
    await admin.from("workspace_kpis").upsert(
      {
        workspace_id: ctx.workspace.id,
        kpi_data: legacyKpi,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
