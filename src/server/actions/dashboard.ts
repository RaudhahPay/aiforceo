"use server";

import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function saveKPIs(
  kpiData: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace" };

  // Verify ownership before write
  const admin = createSupabaseAdminClient();
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", ctx.workspace.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return { ok: false, error: "Unauthorized" };

  const { error } = await admin
    .from("workspace_kpis")
    .upsert(
      {
        workspace_id: ctx.workspace.id,
        kpi_data: kpiData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadKPIs(workspaceId: string): Promise<unknown | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_kpis")
    .select("kpi_data")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data?.kpi_data ?? null;
}
