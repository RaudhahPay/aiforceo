// Auto task extraction from AI agent responses.
// Same fire-and-forget pattern as memory extraction in src/lib/memory.ts.
//
// Call with `void extractAndCreateTasks(...)` — never await.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import type { TaskType, TaskPriority } from "@/server/actions/tasks";

type ExtractedTask = {
  title: string;
  type: TaskType;
  priority: TaskPriority;
};

const VALID_TYPES = new Set<TaskType>([
  "action",
  "approval",
  "review",
  "follow-up",
  "alert",
]);

const EXTRACTION_SYSTEM = `You are an action-item extractor for an AI business advisor system.
You receive one AI assistant message from a business conversation.
Your job: identify concrete action items that require the business owner to DO something.

Rules:
- Only extract CLEAR, SPECIFIC actions (not general advice or observations).
- Each action must be something the business owner needs to actually do.
- Return at most 3 items. If there are no clear action items, return [].
- Do NOT extract things the AI is doing — only things the HUMAN needs to do.
- Keep titles short (max 80 characters), imperative form ("Review Q2 report", "Follow up with supplier").
- type: 'action' (general task) | 'review' (requires review) | 'follow-up' (follow up needed) | 'approval' (requires approval) | 'alert' (urgent issue needing attention)
- priority: 1=low, 2=medium, 3=high (3=urgent/time-sensitive)

Return a JSON array only. Schema: [{"title":"...","type":"action","priority":2}]
If no clear action items, return: []`;

/**
 * Extract action items from an AI response and persist them as tasks.
 * Always call with `void` — never await. Silently swallows all errors.
 */
export async function extractAndCreateTasks(opts: {
  workspaceId: string;
  agentRole: string;
  assistantMessage: string;
  messageId: string;
}): Promise<void> {
  try {
    const { workspaceId, agentRole, assistantMessage, messageId } = opts;

    const anthropic = getAnthropic();

    const extraction = anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `AI RESPONSE:\n${assistantMessage.slice(0, 3000)}`,
        },
      ],
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("task extraction timeout")), 6_000),
    );

    const out = await Promise.race([extraction, timeout]);
    const first = out.content[0];
    if (!first || first.type !== "text") return;

    const raw = first.text
      .replace(/^```(?:json)?/m, "")
      .replace(/```$/m, "")
      .trim();

    let items: ExtractedTask[];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      items = parsed
        .filter(
          (x): x is ExtractedTask =>
            typeof x === "object" &&
            x !== null &&
            "title" in x &&
            "type" in x &&
            "priority" in x &&
            typeof (x as ExtractedTask).title === "string" &&
            (x as ExtractedTask).title.length > 0 &&
            (x as ExtractedTask).title.length <= 120 &&
            VALID_TYPES.has((x as ExtractedTask).type) &&
            [1, 2, 3].includes((x as ExtractedTask).priority),
        )
        .slice(0, 3); // max 3 tasks per message
    } catch {
      return;
    }

    if (items.length === 0) return;

    const admin = createSupabaseAdminClient();

    await admin.from("tasks").insert(
      items.map((item) => ({
        workspace_id: workspaceId,
        title: item.title,
        type: item.type,
        priority: item.priority,
        source_agent: agentRole,
        source_msg_id: messageId,
        status: "open",
      })),
    );
  } catch {
    // Silently swallow — task extraction must never crash the caller
  }
}
