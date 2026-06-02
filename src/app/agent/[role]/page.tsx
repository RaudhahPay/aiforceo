import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChatClient } from "./ChatClient";

const BUILTIN_ROLES: AgentRole[] = ["cmo", "coo", "cfo", "ceo", "cto", "aria"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ conv?: string; task?: string }>;
}) {
  const [{ role: rawRole }, { conv: requestedConvId, task: taskPrompt }] = await Promise.all([params, searchParams]);
  const role = rawRole.toLowerCase();
  const isBuiltin = BUILTIN_ROLES.includes(role as AgentRole);
  const isCustom  = UUID_RE.test(role);
  if (!isBuiltin && !isCustom) notFound();

  const ctx = await getCurrentWorkspace();
  if (!ctx) {
    redirect("/onboarding");
  }
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  // Get or create the active conversation. Conversation creation is a write,
  // so it goes through the admin client. The ownership of the workspace was
  // already established via getCurrentWorkspace() (which uses the RLS client
  // and confirmed auth.uid() = owner_id).
  const admin = createSupabaseAdminClient();
  // If a specific conversation was requested (from history panel), load it.
  // Otherwise load the most recently updated conversation.
  const convQuery = admin
    .from("conversations")
    .select("id, agent_role, workspace_id, title, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("agent_role", role);

  let { data: conversation } = requestedConvId
    ? await convQuery.eq("id", requestedConvId).maybeSingle()
    : await convQuery.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!conversation) {
    const ins = await admin
      .from("conversations")
      .insert({
        workspace_id: workspace.id,
        agent_role: role,
        title: "New chat",
      })
      .select("id, agent_role, workspace_id, title, created_at, updated_at")
      .single();
    if (ins.error || !ins.data) {
      throw new Error("Failed to create conversation");
    }
    conversation = ins.data;
  }

  // Load custom agent metadata if this is a UUID role
  let customAgentMeta: { name: string; title: string; tag: string; gradient: readonly [string, string] } | null = null;
  if (isCustom) {
    const { data: ca } = await admin
      .from("custom_agents")
      .select("name, title, description, gradient_from, gradient_to")
      .eq("id", role)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (ca) {
      customAgentMeta = {
        name: ca.name,
        title: ca.title,
        tag: ca.description || "Custom specialist",
        gradient: [ca.gradient_from, ca.gradient_to] as const,
      };
    } else {
      notFound();
    }
  }

  const agentMeta = customAgentMeta ?? AGENTS[role as AgentRole];

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
      .eq("agent_role", role)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div
      className="grid min-h-screen app-grid"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      <Sidebar
        active={isBuiltin ? (role as AgentRole) : ("agents" as const)}
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      {/* key=conversationId forces a full remount when switching agents,
          preventing stale React state (e.g. old error messages) from leaking
          between routes in Next.js App Router. */}
      <ChatClient
        key={conversation.id}
        role={role}
        agent={agentMeta}
        workspaceName={workspace.name}
        conversationId={conversation.id}
        initialMessages={(messages ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          id: m.id,
        }))}
        pastConversations={(pastConversations ?? []).map((c) => ({
          id: c.id,
          title: c.title ?? "Chat",
          updatedAt: c.updated_at,
        }))}
        autoSendPrompt={taskPrompt ? decodeURIComponent(taskPrompt) : undefined}
      />
    </div>
  );
}
