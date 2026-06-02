"use server";

import { redirect } from "next/navigation";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadMonthlyKPIs } from "@/server/actions/dashboard";
import { buildKPIView, computeMoMTrend } from "@/lib/kpi/rollup";
import type { MoMTrend } from "@/lib/kpi/rollup";
import type {
  WorkspaceKPI,
  MonthlyKPIRecord,
} from "@/lib/kpi/types";
import type { WorkspaceStub } from "@/lib/workspace";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type DepartmentData = {
  workspace: { id: string; name: string; tier: string; onboarded: boolean };
  allWorkspaces: WorkspaceStub[];
  remainingTokens: number;
  monthlyQuota: number;
  kpi: WorkspaceKPI | null;
  monthlyRecords: MonthlyKPIRecord[];
  momTrend: MoMTrend | null;
  selectedMonth: string;
  // Chat
  conversationId: string;
  initialMessages: { role: "user" | "assistant"; content: string; id?: string }[];
  pastConversations: { id: string; title: string; updatedAt: string }[];
  // Agent
  agent: { name: string; title: string; tag: string; gradient: readonly [string, string] };
};

export async function loadDepartmentData(
  agentRole: AgentRole,
): Promise<DepartmentData> {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  // KPI data
  const monthlyRecords = await loadMonthlyKPIs(workspace.id);
  const month = currentMonth();
  const kpi = monthlyRecords.length > 0 ? buildKPIView(monthlyRecords, month) : null;
  const momTrend = monthlyRecords.length > 0 ? computeMoMTrend(monthlyRecords, month) : null;

  // Conversation: find or create
  const admin = createSupabaseAdminClient();

  let { data: conversation } = await admin
    .from("conversations")
    .select("id, agent_role, workspace_id, title, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("agent_role", agentRole)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    const ins = await admin
      .from("conversations")
      .insert({
        workspace_id: workspace.id,
        agent_role: agentRole,
        title: "New chat",
      })
      .select("id, agent_role, workspace_id, title, created_at, updated_at")
      .single();
    if (ins.error || !ins.data) {
      throw new Error("Failed to create conversation");
    }
    conversation = ins.data;
  }

  const [{ data: messages }, { data: pastConversations }] = await Promise.all([
    admin
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    admin
      .from("conversations")
      .select("id, title, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("agent_role", agentRole)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const agentMeta = AGENTS[agentRole];

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      tier: workspace.tier,
      onboarded: workspace.onboarded,
    },
    allWorkspaces,
    remainingTokens: remaining,
    monthlyQuota: quota,
    kpi,
    monthlyRecords,
    momTrend,
    selectedMonth: month,
    conversationId: conversation.id,
    initialMessages: (messages ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      id: m.id,
    })),
    pastConversations: (pastConversations ?? []).map((c) => ({
      id: c.id,
      title: c.title ?? "Chat",
      updatedAt: c.updated_at,
    })),
    agent: agentMeta,
  };
}
