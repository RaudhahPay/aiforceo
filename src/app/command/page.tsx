import { redirect } from "next/navigation";
import { type AgentRole } from "@/lib/prompts";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadKPIs } from "@/server/actions/dashboard";
import type { Task } from "@/server/actions/tasks";
import { Sidebar } from "@/app/_components/Sidebar";
import { CommandCentre } from "./CommandCentre";

const ROLES: AgentRole[] = ["aria", "cmo", "coo", "cfo", "ceo", "cto"];

type AgentStat = {
  convCount: number;
  msgCountMtd: number;
  lastActive: string | null;
  lastContent: string | null;
};

export default async function CommandPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const admin = createSupabaseAdminClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  // Load conversations + stats
  const { data: convRows } = await admin
    .from("conversations")
    .select("id, agent_role, updated_at")
    .eq("workspace_id", workspace.id);

  const convIds = (convRows ?? []).map((c) => c.id);

  const [{ data: msgRows }, { data: connectors }] = await Promise.all([
    convIds.length > 0
      ? admin.from("messages").select("conversation_id, created_at, role, content")
          .in("conversation_id", convIds).eq("role", "assistant")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("connectors").select("provider, status")
      .eq("workspace_id", workspace.id).eq("status", "active"),
  ]);

  const statsByRole: Record<AgentRole, AgentStat> = Object.fromEntries(
    ROLES.map((r) => [r, { convCount: 0, msgCountMtd: 0, lastActive: null, lastContent: null }]),
  ) as Record<AgentRole, AgentStat>;

  const convRoleMap: Record<string, AgentRole> = {};
  for (const c of convRows ?? []) {
    convRoleMap[c.id] = c.agent_role as AgentRole;
    const s = statsByRole[c.agent_role as AgentRole];
    if (s) { s.convCount++; if (!s.lastActive || c.updated_at > s.lastActive) s.lastActive = c.updated_at; }
  }
  for (const m of msgRows ?? []) {
    const role = convRoleMap[m.conversation_id];
    if (!role) continue;
    const s = statsByRole[role];
    if (!s) continue;
    if (m.created_at >= startOfMonth) s.msgCountMtd++;
    if (!s.lastContent) s.lastContent = m.content;
  }

  // Today's brief
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const ariaConvId = (convRows ?? []).find((c) => c.agent_role === "aria")?.id ?? null;
  let todayBriefContent: string | null = null;
  if (ariaConvId) {
    const { data: briefMsg } = await admin.from("messages").select("content")
      .eq("workspace_id", workspace.id).eq("conversation_id", ariaConvId)
      .eq("role", "assistant").gte("created_at", startOfToday.toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    todayBriefContent = briefMsg?.content ?? null;
  }

  // KPIs for health scores
  const savedKpis = await loadKPIs(workspace.id);

  // Setup status
  let hasBusinessProfile = false, hasBrandVoice = false, hasFinancials = false;
  const hasConnectors = (connectors ?? []).length > 0;
  try {
    const [{ data: bp }, { data: bv }, { data: fs }] = await Promise.all([
      admin.from("business_profiles").select("industry").eq("workspace_id", workspace.id).maybeSingle(),
      admin.from("brand_voice").select("voice_summary").eq("workspace_id", workspace.id).maybeSingle(),
      admin.from("financial_snapshots").select("id").eq("workspace_id", workspace.id).limit(1).maybeSingle(),
    ]);
    hasBusinessProfile = !!bp?.industry;
    hasBrandVoice = !!bv?.voice_summary;
    hasFinancials = !!fs;
  } catch { /* non-fatal */ }

  // Recent memories for AI recommendations
  const { data: memories } = await admin.from("agent_memories")
    .select("category, content, source_agent")
    .eq("workspace_id", workspace.id)
    .order("last_reinforced_at", { ascending: false })
    .limit(12);

  // Real tasks — open + in_progress, top 5 by priority
  const { data: taskRows } = await admin
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspace.id)
    .in("status", ["open", "in_progress"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);
  const tasks = (taskRows ?? []) as Task[];

  return (
    <div className="grid min-h-screen app-grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Sidebar
        active="command"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <CommandCentre
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        agentStats={statsByRole}
        todayBriefContent={todayBriefContent}
        savedKpis={savedKpis}
        remaining={remaining}
        quota={quota}
        ownerInitial={(ctx.user?.email ?? "B")[0]!.toUpperCase()}
        ownerName={ctx.user?.email?.split("@")[0] ?? "Boss"}
        hasBusinessProfile={hasBusinessProfile}
        hasBrandVoice={hasBrandVoice}
        hasFinancials={hasFinancials}
        hasConnectors={hasConnectors}
        memories={(memories ?? []) as Array<{ category: string; content: string; source_agent: string | null }>}
        tasks={tasks}
      />
    </div>
  );
}
