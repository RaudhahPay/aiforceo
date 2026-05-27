"use server";

// Chat server action — streams Claude's response back to the client.
// Per SOP §4.2/§4.3:
//   * 'use server' file exports only async functions
//   * Input zod-validated
//   * Workspace ownership re-derived via requireWorkspaceOwner() — never
//     trusted from the client payload
//   * Token quota enforced BEFORE the model call (D-005)
//   * Writes to messages + credit_ledger go through admin client (D-004)
import { z } from "zod";
import { requireWorkspaceOwner, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt, type AgentRole } from "@/lib/prompts";
import { getRemainingTokens, recordUsage } from "@/lib/credits";

const SendMessage = z.object({
  conversationId: z.string().uuid(),
  role: z.enum(["cmo", "coo", "cfo", "ceo", "cto", "aria"]),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(8000)
    })
  ).min(1).max(40)
});

/**
 * Streams a chat reply as a ReadableStream of UTF-8 text chunks. The caller
 * (a server component or another action) consumes it and forwards to the
 * client. Returning a stream from a 'use server' file is valid in Next 15.
 */
export async function sendChatMessage(input: unknown): Promise<ReadableStream<Uint8Array> | { error: string; code: number }> {
  const parsed = SendMessage.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message, code: 400 };
  const { conversationId, role, messages } = parsed.data;

  let ownerCtx: Awaited<ReturnType<typeof requireWorkspaceOwner>>;
  try {
    ownerCtx = await requireWorkspaceOwner();
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.message, code: err.code === "UNAUTHENTICATED" ? 401 : 403 };
    }
    throw err;
  }
  const { workspace } = ownerCtx;

  // Verify the conversation belongs to this workspace via admin client.
  // Ownership is already proven by requireWorkspaceOwner() above; we use
  // admin here so cookie-forwarding quirks in server actions don't interfere.
  const admin = createSupabaseAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("id, workspace_id, agent_role")
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .eq("agent_role", role)
    .maybeSingle();
  if (!conv) {
    return { error: "Conversation not found", code: 404 };
  }

  // Enforce token quota BEFORE invoking the model (D-005).
  const remaining = await getRemainingTokens(workspace.id);
  if (remaining <= 0) {
    return { error: "Out of credits this month. Visit /pricing to upgrade.", code: 402 };
  }

  // Build context.
  const [{ data: profile }, { data: voice }] = await Promise.all([
    admin.from("business_profiles").select("*").eq("workspace_id", workspace.id).maybeSingle(),
    admin.from("brand_voice").select("*").eq("workspace_id", workspace.id).maybeSingle()
  ]);

  const system = buildSystemPrompt(role as AgentRole, {
    businessName: workspace.name,
    industry: profile?.industry ?? undefined,
    size: profile?.size ?? undefined,
    primaryOffer: profile?.primary_offer ?? undefined,
    targetCustomer: profile?.target_customer ?? undefined,
    challenges: profile?.challenges ?? [],
    goals90d: profile?.goals_90d ?? undefined,
    brandVoiceSummary: voice?.voice_summary ?? undefined,
    toneAttributes: voice?.tone_attributes ?? [],
    wordsToUse: voice?.words_to_use ?? [],
    wordsToAvoid: voice?.words_to_avoid ?? []
  });

  const lastUser = messages[messages.length - 1];
  if (!lastUser) return { error: "No message provided", code: 400 };

  // Persist the user message via admin client (D-004).
  await admin.from("messages").insert({
    conversation_id: conversationId,
    workspace_id: workspace.id,
    role: "user",
    content: lastUser.content,
    model: ANTHROPIC_MODEL
  });

  // Stream from Anthropic.
  const anthropic = getAnthropic();
  const stream = anthropic.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            full += event.delta.text;
          } else if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
          } else if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens ?? 0;
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n\n[stream error: ${msg}]`));
        controller.close();
      }

      // Persist assistant message + token usage via admin client.
      try {
        const { data: aMsg } = await admin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            workspace_id: workspace.id,
            role: "assistant",
            content: full,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            model: ANTHROPIC_MODEL
          })
          .select("id")
          .single();
        await recordUsage({
          workspaceId: workspace.id,
          inputTokens,
          outputTokens,
          messageId: aMsg?.id
        });
        await admin
          .from("conversations")
          .update({
            updated_at: new Date().toISOString(),
            ...(messages.length <= 2 ? { title: lastUser.content.slice(0, 60) } : {})
          })
          .eq("id", conversationId);
      } catch {
        // Persistence failure is non-fatal to the user-visible response.
        // It will surface in CI / monitoring; reconciliation handled in v0.2.
      }
    }
  });
}
