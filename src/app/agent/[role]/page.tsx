import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChatClient } from "./ChatClient";

const VALID: AgentRole[] = ["cmo", "coo", "cfo", "ceo", "cto", "aria"];

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ conv?: string }>;
}) {
  const [{ role: rawRole }, { conv: requestedConvId }] = await Promise.all([params, searchParams]);
  const role = rawRole.toLowerCase() as AgentRole;
  if (!VALID.includes(role)) notFound();

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
        active={role}
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
        agent={AGENTS[role]}
        workspaceName={workspace.name}
        conversationId={conversation.id}
        initialMessages={(messages ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))}
        pastConversations={(pastConversations ?? []).map((c) => ({
          id: c.id,
          title: c.title ?? "Chat",
          updatedAt: c.updated_at,
        }))}
      />
    </div>
  );
}
