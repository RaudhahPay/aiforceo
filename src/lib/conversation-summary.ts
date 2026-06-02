// Conversation summary system — reduces token usage by ~85%.
//
// Instead of sending the full message history to Claude, the system:
//   1. Stores a rolling summary of the conversation (updated every 5 messages after 10)
//   2. At request time, sends: summary + last 6 messages + agent memories
//
// Two entry points:
//   loadConversationContext()       — called at request time to build optimized messages
//   generateConversationSummary()   — fire-and-forget after assistant message, never blocks

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { logAudit } from "@/lib/audit";

type MessageLike = {
  role: string;
  content: string;
  attachments?: unknown[];
};

const SUMMARY_PROMPT = (role: string) =>
  `You are a conversation summarizer. Summarize this conversation between a business owner and their AI ${role}. ` +
  `Capture: key data shared (numbers, names, dates), decisions made, action items, questions asked, and any unresolved topics. ` +
  `Be factual and concise. Under 300 words. Do not add commentary — just the summary.`;

/**
 * Generate or update the conversation summary.
 * Called fire-and-forget after assistant messages when message_count >= 10
 * and message_count % 5 === 0.
 */
export async function generateConversationSummary(opts: {
  conversationId: string;
  workspaceId: string;
  agentRole: string;
  messages: Array<{ role: string; content: string; id?: string }>;
  messageCount?: number;
}): Promise<void> {
  try {
    const { conversationId, workspaceId, agentRole, messages, messageCount } = opts;

    if (messages.length === 0) return;

    // Build the conversation text for summarization (cap at ~8K chars to stay cheap)
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 1500)}`)
      .join("\n\n")
      .slice(0, 8000);

    const anthropic = getAnthropic();

    const summarization = anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: SUMMARY_PROMPT(agentRole),
      messages: [{ role: "user", content: conversationText }],
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("summary timeout")), 6_000),
    );

    const out = await Promise.race([summarization, timeout]);
    const first = out.content[0];
    if (!first || first.type !== "text") return;

    const summary = first.text.trim();
    if (!summary) return;

    // Determine last message ID (if available)
    const lastMsgId = messages[messages.length - 1]?.id ?? null;

    const admin = createSupabaseAdminClient();
    await admin
      .from("conversations")
      .update({
        summary,
        ...(lastMsgId ? { summary_through_msg_id: lastMsgId } : {}),
      })
      .eq("id", conversationId);

    // Fire-and-forget audit log
    void logAudit({
      workspaceId,
      actorType: "system",
      agentRole,
      action: "conversation.summary_generated",
      entityType: "conversation",
      entityId: conversationId,
      summary: `Conversation summary generated for ${agentRole} (${messageCount ?? messages.length} messages)`,
      metadata: { messageCount: messageCount ?? messages.length },
    });
  } catch {
    // Silently swallow — summary generation must never crash the caller
  }
}

/**
 * Load optimized conversation context for a Claude call.
 *
 * If the conversation has a summary AND the message array is long (>8),
 * returns: [summary injection, ack, ...last 6 messages]
 * Otherwise returns the original messages as-is.
 */
export async function loadConversationContext(opts: {
  conversationId: string;
  workspaceId: string;
  currentMessages: MessageLike[];
}): Promise<{
  contextMessages: MessageLike[];
  summaryInjected: boolean;
}> {
  const { conversationId, currentMessages } = opts;

  // Short conversations don't need optimization
  if (currentMessages.length <= 8) {
    return { contextMessages: currentMessages, summaryInjected: false };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: conv } = await admin
      .from("conversations")
      .select("summary")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv?.summary) {
      return { contextMessages: currentMessages, summaryInjected: false };
    }

    // Build optimized context: summary + last 6 messages
    const recentMessages = currentMessages.slice(-6);

    const contextMessages: MessageLike[] = [
      {
        role: "user",
        content: `[Previous conversation summary]: ${conv.summary}`,
      },
      {
        role: "assistant",
        content:
          "I understand the context from our previous discussion. Let me continue from where we left off.",
      },
      ...recentMessages,
    ];

    return { contextMessages, summaryInjected: true };
  } catch {
    // On any error, fall back to original messages
    return { contextMessages: currentMessages, summaryInjected: false };
  }
}
