// Morning brief generator.
// Called by the cron route — no user session, uses admin client throughout.
// Generates an Aria brief for a workspace and persists it as a conversation message.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { getRemainingTokens, recordUsage } from "@/lib/credits";
import { loadMemories } from "@/lib/memory";
import { sendMorningBriefEmail } from "@/lib/email";

const MIN_TOKENS_FOR_BRIEF = 5_000;

export type BriefResult =
  | { ok: true;  workspaceId: string; messageId: string }
  | { ok: false; workspaceId: string; reason: string };

/**
 * Generates and persists a morning brief for the given workspace.
 * The brief is saved as a user + assistant message pair in the Aria
 * conversation so it shows up naturally in the chat history.
 */
export async function generateMorningBrief(
  workspaceId: string,
  workspaceName: string,
): Promise<BriefResult> {
  const admin = createSupabaseAdminClient();

  // Guard: sufficient tokens to generate a brief
  const remaining = await getRemainingTokens(workspaceId);
  if (remaining < MIN_TOKENS_FOR_BRIEF) {
    return { ok: false, workspaceId, reason: "insufficient_tokens" };
  }

  // Load business context (same fields as the interactive agent route)
  const [{ data: profile }, { data: voice }, { data: latestPnl }, memories] =
    await Promise.all([
      admin
        .from("business_profiles")
        .select("industry, size, challenges, goals_90d, primary_offer, target_customer")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      admin
        .from("brand_voice")
        .select("voice_summary, tone_attributes, words_to_use, words_to_avoid")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      admin
        .from("financial_snapshots")
        .select("raw_text, period")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadMemories(workspaceId, 12).catch(() => []),
    ]);

  const system = buildSystemPrompt("aria", {
    businessName: workspaceName,
    industry:        profile?.industry       ?? undefined,
    size:            profile?.size           ?? undefined,
    primaryOffer:    profile?.primary_offer  ?? undefined,
    targetCustomer:  profile?.target_customer ?? undefined,
    challenges:      profile?.challenges     ?? [],
    goals90d:        profile?.goals_90d      ?? undefined,
    brandVoiceSummary: voice?.voice_summary  ?? undefined,
    toneAttributes:  voice?.tone_attributes  ?? [],
    wordsToUse:      voice?.words_to_use     ?? [],
    wordsToAvoid:    voice?.words_to_avoid   ?? [],
    connectorData: latestPnl?.raw_text
      ? `== Latest P&L (${latestPnl.period}) ==\n${latestPnl.raw_text}`
      : undefined,
    memories,
  });

  // Find or create the Aria conversation for this workspace
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("agent_role", "aria")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let conversationId: string;
  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({
        workspace_id: workspaceId,
        agent_role: "aria",
        title: "Morning Briefs",
      })
      .select("id")
      .single();
    if (convErr ?? !newConv) {
      return { ok: false, workspaceId, reason: convErr?.message ?? "conversation_create_failed" };
    }
    conversationId = newConv.id;
  }

  // Build the brief request prompt with today's date
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const briefPrompt =
    `Good morning. Today is ${today}. Please give me my morning executive brief — ` +
    `cover all five functional areas: marketing, operations, finance, strategy, and technology. ` +
    `Based on my business profile and 90-day goals, tell me: ` +
    `(1) Top 3 priorities for today, (2) Decisions I need to make, (3) Risks to watch. ` +
    `Keep it tight — executive summary style, under 400 words.`;

  // Persist the system-initiated user prompt
  await admin.from("messages").insert({
    conversation_id: conversationId,
    workspace_id:    workspaceId,
    role:            "user",
    content:         briefPrompt,
    model:           ANTHROPIC_MODEL,
  });

  // Call Anthropic — non-streaming since this runs in the background
  const anthropic = getAnthropic();
  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await anthropic.messages.create({
      model:      ANTHROPIC_MODEL,
      max_tokens: 1_200,
      system,
      messages:   [{ role: "user", content: briefPrompt }],
    });
    fullText     = response.content[0]?.type === "text" ? response.content[0].text : "";
    inputTokens  = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
  } catch (err) {
    return {
      ok: false,
      workspaceId,
      reason: err instanceof Error ? err.message : "anthropic_error",
    };
  }

  // Persist the brief as an assistant message
  const { data: aMsg, error: msgErr } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      workspace_id:    workspaceId,
      role:            "assistant",
      content:         fullText,
      input_tokens:    inputTokens,
      output_tokens:   outputTokens,
      model:           ANTHROPIC_MODEL,
    })
    .select("id")
    .single();

  if (msgErr ?? !aMsg) {
    return { ok: false, workspaceId, reason: msgErr?.message ?? "message_save_failed" };
  }

  await recordUsage({ workspaceId, inputTokens, outputTokens, messageId: aMsg.id });

  await admin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Send email to workspace owner (fire-and-forget, non-fatal)
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", (await admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle()).data?.owner_id ?? "")
      .maybeSingle();

    if (profile?.email) {
      const date = new Date().toLocaleDateString("en-MY", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      });
      void sendMorningBriefEmail({
        toEmail: profile.email,
        workspaceName,
        briefContent: fullText,
        date,
      });
    }
  } catch {
    // Email failure is non-fatal — brief is saved in DB regardless
  }

  return { ok: true, workspaceId, messageId: aMsg.id };
}

/**
 * Returns true if the current UTC time corresponds to briefHour in the
 * given IANA timezone. Used by the cron route to decide which workspaces
 * are due for their brief on this hourly tick.
 */
export function isTimeForBrief(timezone: string, briefHour: number): boolean {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      hour:     "numeric",
      hour12:   false,
      timeZone: timezone,
    }).format(new Date());
    return parseInt(hourStr, 10) === briefHour;
  } catch {
    return false;
  }
}
