import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { type AgentRole } from "@/lib/prompts";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadKPIs } from "@/server/actions/dashboard";
import {
  DashboardClient,
  type AgentStat,
  type WorkspaceKPI,
} from "./DashboardClient";

const ROLES: AgentRole[] = ["aria", "cmo", "coo", "cfo", "ceo", "cto"];

export default async function DashboardPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  const admin = createSupabaseAdminClient();
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data: convRows } = await admin
    .from("conversations")
    .select("id, agent_role, updated_at")
    .eq("workspace_id", workspace.id);

  const convIds = (convRows ?? []).map((c) => c.id);

  const [{ data: msgRows }, { data: connectors }] = await Promise.all([
    convIds.length > 0
      ? admin
          .from("messages")
          .select("conversation_id, created_at, role, content")
          .in("conversation_id", convIds)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin
      .from("connectors")
      .select("provider, status")
      .eq("workspace_id", workspace.id)
      .eq("status", "active"),
  ]);

  const statsByRole: Record<AgentRole, AgentStat> = Object.fromEntries(
    ROLES.map((r) => [
      r,
      { convCount: 0, msgCountMtd: 0, lastActive: null, lastContent: null },
    ]),
  ) as Record<AgentRole, AgentStat>;

  const convRoleMap: Record<string, AgentRole> = {};
  for (const c of convRows ?? []) {
    convRoleMap[c.id] = c.agent_role as AgentRole;
    const s = statsByRole[c.agent_role as AgentRole];
    if (s) {
      s.convCount++;
      if (!s.lastActive || c.updated_at > s.lastActive)
        s.lastActive = c.updated_at;
    }
  }
  for (const m of msgRows ?? []) {
    const role = convRoleMap[m.conversation_id];
    if (!role) continue;
    const s = statsByRole[role];
    if (!s) continue;
    if (m.created_at >= startOfMonth) s.msgCountMtd++;
    if (!s.lastContent) s.lastContent = m.content;
  }

  // Check if a morning brief was generated today (Aria conversation, assistant role)
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const ariaConvId = (convRows ?? []).find((c) => c.agent_role === "aria")?.id ?? null;
  let todayBriefContent: string | null = null;
  if (ariaConvId) {
    const { data: briefMsg } = await admin
      .from("messages")
      .select("content")
      .eq("workspace_id", workspace.id)
      .eq("conversation_id", ariaConvId)
      .eq("role", "assistant")
      .gte("created_at", startOfToday.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    todayBriefContent = briefMsg?.content ?? null;
  }

  // Load saved KPIs from DB (falls back to null → client uses localStorage → default)
  // Also load KPIs for all other workspaces so the Group View can compare companies
  const [savedKpis, ...otherKpisRaw] = await Promise.all([
    loadKPIs(workspace.id),
    ...allWorkspaces
      .filter((ws) => ws.id !== workspace.id)
      .map((ws) => loadKPIs(ws.id).then((kpi) => ({ ws, kpi }))),
  ]);

  const groupKpis: Array<{
    ws: { id: string; name: string; tier: string };
    kpi: WorkspaceKPI | null;
  }> =
    allWorkspaces.length > 1
      ? [
          { ws: workspace, kpi: savedKpis as WorkspaceKPI | null },
          ...(
            otherKpisRaw as Array<{
              ws: { id: string; name: string; tier: string };
              kpi: unknown;
            }>
          ).map((r) => ({ ws: r.ws, kpi: r.kpi as WorkspaceKPI | null })),
        ]
      : [];

  return (
    <div
      style={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: "240px 1fr",
      }}
    >
      <Sidebar
        active="dashboard"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <DashboardClient
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        agentStats={statsByRole}
        savedKpis={savedKpis as WorkspaceKPI | null}
        remaining={remaining}
        quota={quota}
        connectedSources={(connectors ?? []).length}
        groupKpis={groupKpis}
        todayBriefContent={todayBriefContent}
      />
    </div>
  );
}
