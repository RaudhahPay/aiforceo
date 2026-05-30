"use server";

import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";

export type SearchResult = {
  messageId: string;
  conversationId: string;
  agentRole: string;
  content: string;
  role: "user" | "assistant";
  createdAt: string;
  headline: string;
};

export async function searchConversations(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return [];

  const admin = createSupabaseAdminClient();

  // Full-text search using the generated content_tsv column
  const sanitized = query.trim().replace(/[^a-zA-Z0-9\s\-_]/g, "").slice(0, 100);
  if (!sanitized) return [];

  const { data } = await admin
    .from("messages")
    .select(`
      id,
      conversation_id,
      role,
      content,
      created_at,
      conversations!inner(agent_role, workspace_id)
    `)
    .eq("conversations.workspace_id", ctx.workspace.id)
    .textSearch("content_tsv", sanitized, { type: "websearch", config: "english" })
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((m) => {
    const convRaw = (m as unknown as { conversations: { agent_role: string } }).conversations;
    const conv = Array.isArray(convRaw) ? convRaw[0] : convRaw;
    // Build a simple headline: first 150 chars around the match
    const lower = m.content.toLowerCase();
    const idx = lower.indexOf(sanitized.toLowerCase());
    const start = Math.max(0, idx - 60);
    const snippet = m.content.slice(start, start + 150);
    const headline = (start > 0 ? "…" : "") + snippet + (start + 150 < m.content.length ? "…" : "");
    return {
      messageId: m.id,
      conversationId: m.conversation_id,
      agentRole: conv.agent_role,
      content: m.content,
      role: m.role as "user" | "assistant",
      createdAt: m.created_at,
      headline,
    };
  });
}

export async function toggleStarMessage(messageId: string, starred: boolean): Promise<{ ok: boolean }> {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("messages")
    .update({ starred })
    .eq("id", messageId)
    .eq("workspace_id", ctx.workspace.id);

  return { ok: !error };
}

export async function getStarredMessages() {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("messages")
    .select("id, conversation_id, role, content, created_at, conversations(agent_role)")
    .eq("workspace_id", ctx.workspace.id)
    .eq("starred", true)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}
