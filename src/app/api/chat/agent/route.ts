// Authenticated streaming chat route.
// Streams Claude's response to the client and persists every message to DB.
//
// Security (SOP §4.2 / §4.3):
//   - Auth re-derived from cookies server-side; workspace_id never trusted from payload
//   - Token quota enforced BEFORE the model call
//   - All DB writes go through the admin client
import { z } from "zod";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt, type AgentRole } from "@/lib/prompts";
import { getRemainingTokens, recordUsage } from "@/lib/credits";
import { buildSheetsContext, fetchSheetByUrl } from "@/lib/google-sheets";
import { loadMemories, extractAndSaveMemories } from "@/lib/memory";
import { uploadAttachmentsToStorage } from "@/lib/attachments";
import { parseDelegationPlan, executeDelegation, synthesizeDelegation } from "@/lib/delegation";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const BUILTIN_ROLES = ["cmo", "coo", "cfo", "ceo", "cto", "aria"] as const;

// ── Attachment schema ───────────────────────────────────────────────────────
const AttachmentSchema = z.object({
  name:     z.string().max(255),
  mimeType: z.string().max(100),
  size:     z.number().int().min(1).max(10 * 1024 * 1024), // 10 MB
  base64:   z.string().max(15_000_000),                     // ~10 MB base64
});

type ReqAttachment = z.infer<typeof AttachmentSchema>;

const RequestSchema = z.object({
  conversationId: z.string().uuid(),
  // Built-in roles OR custom agent UUID
  role: z.string().min(3),
  messages: z
    .array(
      z.object({
        role:        z.enum(["user", "assistant"]),
        content:     z.string().min(0).max(30000), // assistant messages can be long (KPI tables, reports)
        attachments: z.array(AttachmentSchema).max(5).optional(),
      }),
    )
    .min(1)
    .max(60),
});

// ── Build Anthropic content blocks ─────────────────────────────────────────
function buildContentBlocks(
  text: string,
  attachments: ReqAttachment[] | undefined,
): MessageParam["content"] {
  if (!attachments?.length) return text || " ";

  const blocks: NonNullable<MessageParam["content"]> = [];

  for (const att of attachments) {
    if (att.mimeType.startsWith("image/")) {
      const mediaType = att.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      blocks.push({
        type:   "image",
        source: { type: "base64", media_type: mediaType, data: att.base64 },
      });
    } else if (att.mimeType === "application/pdf") {
      blocks.push({
        type:   "document",
        source: { type: "base64", media_type: "application/pdf", data: att.base64 },
      });
    } else {
      // TXT / CSV / DOCX → decode as UTF-8 text and inject as labelled text block
      const decoded = Buffer.from(att.base64, "base64").toString("utf-8").slice(0, 50_000);
      blocks.push({ type: "text", text: `[File: ${att.name}]\n${decoded}` });
    }
  }

  if (text.trim()) blocks.push({ type: "text", text });
  return blocks;
}

function makeJson(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Auth — re-derived from cookies, never from payload
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return makeJson({ error: "Unauthorized" }, 401);

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return makeJson({ error: "Invalid JSON" }, 400);
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Request validation failed:", JSON.stringify(parsed.error.issues.map(i => ({ path: i.path, message: i.message, code: i.code }))));
    return makeJson({ error: "Bad input", details: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) }, 400);
  }
  const { conversationId, role, messages } = parsed.data;

  // 3 + 4. Resolve workspace FROM the conversation (eliminates multi-workspace ambiguity).
  //   - Look up the conversation by id + agent_role
  //   - Then verify its workspace is actually owned by the authenticated user
  //   This is the only correct approach when a user has multiple workspaces.
  const admin = createSupabaseAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, workspace_id")
    .eq("id", conversationId)
    .eq("agent_role", role)
    .maybeSingle();
  if (!conv)
    return makeJson(
      { error: `Conversation not found (sent: ${conversationId} / ${role})` },
      404,
    );

  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, name, tier")
    .eq("id", conv.workspace_id)
    .eq("owner_id", user.id) // ownership check — ensures user owns this workspace
    .maybeSingle();
  if (!workspace) return makeJson({ error: "Unauthorized" }, 401);

  // 5. Token quota — enforced BEFORE the model call
  const remaining = await getRemainingTokens(workspace.id);
  if (remaining <= -30_000) {
    return makeJson(
      { error: "Token balance exhausted. Top up or upgrade your plan to continue." },
      402,
    );
  }

  // 6. Build system prompt with workspace context.
  //    Extract lastUser first so we can detect Google Sheets URLs in the message.
  const lastUser = messages[messages.length - 1]!;

  // If the user pasted a Google Sheets URL, fetch it on-the-fly using the
  // workspace's connected OAuth tokens (non-fatal if connector isn't set up).
  const sheetsUrlMatch =
    lastUser.content.match(
      /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+[^\s]*/,
    )?.[0] ?? null;

  const [{ data: profile }, { data: voice }, sheetsCtx, urlSheetCtx, memories, kpiMonths] =
    await Promise.all([
      admin
        .from("business_profiles")
        .select(
          "industry, size, challenges, goals_90d, primary_offer, target_customer",
        )
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      admin
        .from("brand_voice")
        .select("voice_summary, tone_attributes, words_to_use, words_to_avoid")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      // Pre-configured sheet stored in connector metadata
      buildSheetsContext(workspace.id).catch(() => null),
      // Ad-hoc sheet URL pasted in this message (takes priority in the prompt)
      sheetsUrlMatch
        ? fetchSheetByUrl(workspace.id, sheetsUrlMatch).catch(() => null)
        : Promise.resolve(null),
      // Agent memories — fast indexed read, non-fatal
      loadMemories(workspace.id, 12).catch(() => [] as Array<{ category: string; content: string; importance: number }>),
      // Monthly KPI data — so agents know real business numbers
      Promise.resolve(
        admin.from("workspace_kpi_months")
          .select("month, period_data, finance_data, ops_data")
          .eq("workspace_id", workspace.id)
          .order("month", { ascending: false })
          .limit(3)
      ).then(r => (r.data ?? []) as Array<{ month: string; period_data: Record<string, number>; finance_data: Record<string, number>; ops_data: Record<string, number> }>)
        .catch(() => [] as Array<{ month: string; period_data: Record<string, number>; finance_data: Record<string, number>; ops_data: Record<string, number> }>),
    ]);

  // URL-pasted sheet leads; pre-configured sheet fills in context below it.
  const connectorData =
    [urlSheetCtx, sheetsCtx].filter(Boolean).join("\n\n") || undefined;

  // When a URL was detected but the fetch failed, give Claude an explicit
  // instruction so it doesn't default to "I can't access external URLs."
  const sheetsHint =
    sheetsUrlMatch && !connectorData
      ? "The user pasted a Google Sheets URL in their message. The server attempted to " +
        "retrieve this sheet automatically using the workspace's connected Google account, " +
        "but the data could not be fetched (possible reasons: Google Sheets connector not " +
        "set up, OAuth tokens expired, or the sheet requires different permissions). " +
        "Do NOT tell the user you cannot access external URLs or Google Sheets — this " +
        "platform fetches data server-side on their behalf. Instead, tell them ONE of: " +
        "(1) Connect or reconnect Google Sheets at Settings → Connectors → Google Sheets " +
        "so the data loads automatically next time. " +
        "(2) Copy the spreadsheet contents and paste the raw data directly into this chat."
      : undefined;

  // For custom agents (UUID role), load the agent's system prompt override
  let customAgentSystemPrompt: string | null = null;
  const isCustomRole = !BUILTIN_ROLES.includes(role as typeof BUILTIN_ROLES[number]);
  if (isCustomRole) {
    const { data: customAgent } = await admin
      .from("custom_agents")
      .select("system_prompt, name, title")
      .eq("id", role)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    customAgentSystemPrompt = customAgent?.system_prompt ?? null;
    if (!customAgentSystemPrompt) return makeJson({ error: "Custom agent not found." }, 404);
  }

  // For custom agents: build the system prompt inline from their stored prompt.
  // For built-in roles: use the standard buildSystemPrompt() with full context.
  const finalSystem = customAgentSystemPrompt
    ? [
        customAgentSystemPrompt,
        `\n\n== Business profile ==\nName: ${workspace.name}`,
        profile?.industry ? `Industry: ${profile.industry}` : "",
        voice?.voice_summary ? `\n\n== Brand voice ==\n${voice.voice_summary}` : "",
        memories.length > 0
          ? `\n\n== What I remember about this business ==\n${memories.map((m: { category: string; content: string }) => `- [${m.category}] ${m.content}`).join("\n")}`
          : "",
        connectorData ? `\n\n${connectorData}` : "",
      ].filter(Boolean).join("\n")
    : buildSystemPrompt(role as AgentRole, {
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
    wordsToAvoid: voice?.words_to_avoid ?? [],
    connectorData,
    sheetsHint,
    memories,
    kpiSnapshot: kpiMonths.length > 0
      ? kpiMonths.map((m: { month: string; period_data: Record<string, number>; finance_data: Record<string, number>; ops_data: Record<string, number> }) => {
          const p = m.period_data;
          const f = m.finance_data;
          const o = m.ops_data;
          const rev = p.revenue ? `RM ${Math.round(p.revenue).toLocaleString()}` : (p.reach ? `RM ${Math.round(p.reach * (p.avgSale ?? 0) * (p.avgTxn ?? 1)).toLocaleString()} (computed)` : "n/a");
          return `${m.month}: Revenue ${rev} | Orders ${p.orders ?? p.reach ?? 0} | Customers ${o.customers ?? 0} | Repeat ${o.repeatRate ? (o.repeatRate * 100).toFixed(1) + "%" : "n/a"} | Headcount ${o.headcount ?? 0} | Cash In RM ${Math.round(f.cashIn ?? 0).toLocaleString()} | GP ${p.gpPct ? (p.gpPct * 100).toFixed(0) + "%" : "n/a"}`;
        }).join("\n")
      : undefined,
  });

  // 7. Persist the user message before streaming
  await admin.from("messages").insert({
    conversation_id: conversationId,
    workspace_id:    workspace.id,
    role:            "user",
    content:         lastUser.content,
    model:           ANTHROPIC_MODEL,
    // Store attachment metadata (without base64) — URLs backfilled by background upload
    attachments: (lastUser.attachments ?? []).map(({ name, mimeType, size }) => ({
      name, mimeType, size, url: "",
    })),
  });

  // 8. Stream from Anthropic, persist assistant message + usage when done
  const encoder = new TextEncoder();
  const anthropic = getAnthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const anthropicStream = anthropic.messages.stream({
          model:      ANTHROPIC_MODEL,
          max_tokens: 1500,
          system:     finalSystem,
          // Last user message uses content blocks (text + image/doc); history is plain strings
          messages: messages.map((m, idx) => ({
            role:    m.role,
            content: (idx === messages.length - 1 && m.role === "user")
              ? buildContentBlocks(m.content, m.attachments)
              : (m.content || " "),
          })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
            fullText += event.delta.text;
          } else if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
          } else if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens ?? 0;
          }
        }
        // ── Check for Aria delegation plan ──
        // If Aria output a delegation JSON, execute each agent task and synthesize
        const delegationPlan = (role === "aria") ? parseDelegationPlan(fullText) : null;

        if (delegationPlan && delegationPlan.tasks.length > 0) {
          // Don't close the stream yet — execute delegation
          controller.enqueue(encoder.encode(`\n\n[DELEGATION:start:${delegationPlan.tasks.length}]\n`));

          const delegationResult = await executeDelegation({
            plan: delegationPlan,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            promptContext: {
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
              wordsToAvoid: voice?.words_to_avoid ?? [],
              connectorData,
              memories,
            },
            controller,
            encoder,
          });

          // Synthesis — Aria combines all agent outputs
          controller.enqueue(encoder.encode(`\n\n[DELEGATION:synthesizing]\n\n`));

          const synthesis = await synthesizeDelegation({
            outputs: delegationResult.outputs,
            originalRequest: lastUser.content,
            promptContext: {
              businessName: workspace.name,
              memories,
            },
          });

          controller.enqueue(encoder.encode(synthesis.text));
          fullText += `\n\n---\n\n${synthesis.text}`;
          inputTokens += delegationResult.totalInputTokens + synthesis.inputTokens;
          outputTokens += delegationResult.totalOutputTokens + synthesis.outputTokens;

          controller.enqueue(encoder.encode(`\n[DELEGATION:done]\n`));
        }

        // ── Persist BEFORE closing stream ────────────────────────
        // On Cloudflare Workers, the execution context may terminate
        // after controller.close(). Persisting first ensures the
        // assistant message is always saved to DB.
        try {
          const { data: aMsg } = await admin
            .from("messages")
            .insert({
              conversation_id: conversationId,
              workspace_id: workspace.id,
              role: "assistant",
              content: fullText,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              model: ANTHROPIC_MODEL,
            })
            .select("id")
            .single();

          await recordUsage({
            workspaceId: workspace.id,
            inputTokens,
            outputTokens,
            messageId: aMsg?.id,
          });

          // Update conversation title from first user message
          await admin
            .from("conversations")
            .update({
              updated_at: new Date().toISOString(),
              ...(messages.length <= 2
                ? { title: lastUser.content.slice(0, 60) }
                : {}),
            })
            .eq("id", conversationId);

          // Fire-and-forget tasks (may or may not complete before Worker shuts down)
          if (lastUser.attachments?.length && aMsg?.id) {
            void uploadAttachmentsToStorage({
              workspaceId: workspace.id,
              messageId:   aMsg.id,
              attachments: lastUser.attachments,
            });
          }
          void extractAndSaveMemories({
            workspaceId:      workspace.id,
            agentRole:        role,
            userMessage:      lastUser.content,
            assistantMessage: fullText,
          });
        } catch {
          // Non-fatal — usage discrepancy handled in reconciliation
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n\n⚠ ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
