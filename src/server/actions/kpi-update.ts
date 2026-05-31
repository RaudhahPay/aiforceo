"use server";

import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

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
};

/**
 * Merge partial KPI updates into the existing workspace_kpis row.
 * Called by Aria after extracting data from screenshots/documents.
 */
export async function mergeKPIUpdate(
  payload: KPIUpdatePayload,
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

  // Load current KPIs
  const { data: current } = await admin
    .from("workspace_kpis")
    .select("kpi_data")
    .eq("workspace_id", ctx.workspace.id)
    .maybeSingle();

  const existing = (current?.kpi_data ?? {}) as Record<string, unknown>;

  // Deep merge the payload into existing KPIs
  const merged = deepMerge(existing, payload as Record<string, unknown>);

  const { error } = await admin
    .from("workspace_kpis")
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        kpi_data: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

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
