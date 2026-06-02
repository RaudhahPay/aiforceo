"use server";

import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";

export type CompanySnapshot = {
  workspaceId: string;
  name: string;
  tier: string;
  isActive: boolean;
  latestMonth: string | null;
  revenue: number | null;
  customers: number | null;
  cashIn: number | null;
  headcount: number | null;
  momRevenueDelta: number | null; // percentage
  openTasks: number;
  lastActivity: string | null; // ISO date of most recent message
  hasKpiData: boolean;
};

export async function loadPortfolioSnapshot(): Promise<CompanySnapshot[]> {
  const [user, ctx] = await Promise.all([requireUser(), getCurrentWorkspace()]);
  const admin = createSupabaseAdminClient();

  // All workspaces owned by this user
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name, tier")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  if (!workspaces || workspaces.length === 0) return [];

  const activeId = ctx?.workspace.id ?? null;
  const wsIds = workspaces.map((w) => w.id);

  // Load KPI months, open tasks and last activity in parallel
  const [{ data: kpiRows }, { data: taskRows }, { data: convRows }] =
    await Promise.all([
      // Latest 2 months per workspace (to calculate MoM delta)
      admin
        .from("workspace_kpi_months")
        .select("workspace_id, month, period_data, finance_data, ops_data")
        .in("workspace_id", wsIds)
        .order("month", { ascending: false }),
      // Open task count per workspace
      admin
        .from("tasks")
        .select("workspace_id")
        .in("workspace_id", wsIds)
        .in("status", ["open", "in_progress"]),
      // Latest conversation updated_at per workspace
      admin
        .from("conversations")
        .select("workspace_id, updated_at")
        .in("workspace_id", wsIds)
        .order("updated_at", { ascending: false }),
    ]);

  // Index KPI rows by workspace_id (keep only the 2 most recent months)
  const kpiByWs: Record<string, typeof kpiRows> = {};
  for (const row of kpiRows ?? []) {
    const wsId = row.workspace_id as string;
    if (!kpiByWs[wsId]) kpiByWs[wsId] = [];
    if ((kpiByWs[wsId]!.length ?? 0) < 2) kpiByWs[wsId]!.push(row);
  }

  // Task counts
  const tasksByWs: Record<string, number> = {};
  for (const row of taskRows ?? []) {
    const wsId = row.workspace_id as string;
    tasksByWs[wsId] = (tasksByWs[wsId] ?? 0) + 1;
  }

  // Last activity per workspace (first result since sorted DESC)
  const lastActivityByWs: Record<string, string> = {};
  for (const row of convRows ?? []) {
    const wsId = row.workspace_id as string;
    if (!lastActivityByWs[wsId]) {
      lastActivityByWs[wsId] = row.updated_at as string;
    }
  }

  return workspaces.map((ws) => {
    const rows = kpiByWs[ws.id] ?? [];
    const latest = rows[0] ?? null;
    const prev = rows[1] ?? null;

    const latestRevenue =
      ((latest?.period_data as Record<string, number> | null)?.revenue as number | null) ?? null;
    const prevRevenue =
      ((prev?.period_data as Record<string, number> | null)?.revenue as number | null) ?? null;

    let momRevenueDelta: number | null = null;
    if (latestRevenue !== null && prevRevenue !== null && prevRevenue > 0) {
      momRevenueDelta = Math.round(((latestRevenue - prevRevenue) / prevRevenue) * 100);
    }

    const financeData = latest?.finance_data as Record<string, number> | null;
    const opsData = latest?.ops_data as Record<string, number> | null;

    return {
      workspaceId: ws.id,
      name: ws.name,
      tier: ws.tier,
      isActive: ws.id === activeId,
      latestMonth: (latest?.month as string) ?? null,
      revenue: latestRevenue,
      customers: (opsData?.customers as number | null) ?? null,
      cashIn: (financeData?.cashIn as number | null) ?? null,
      headcount: (opsData?.headcount as number | null) ?? null,
      momRevenueDelta,
      openTasks: tasksByWs[ws.id] ?? 0,
      lastActivity: lastActivityByWs[ws.id] ?? null,
      hasKpiData: !!latest,
    };
  });
}

