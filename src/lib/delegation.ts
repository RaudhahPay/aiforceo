// Multi-agent delegation orchestration.
// When Aria returns a delegation plan, this module executes each
// delegated task sequentially, streams progress markers to the client,
// and returns all outputs for Aria to synthesize.
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt, type AgentRole, AGENTS } from "@/lib/prompts";
import { loadMemories } from "@/lib/memory";
import { recordUsage } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { BuildPromptContext } from "@/lib/prompts";

export type DelegationTask = {
  agent: string;
  instruction: string;
};

export type DelegationPlan = {
  type: "delegation";
  tasks: DelegationTask[];
};

const VALID_AGENTS = new Set(["cmo", "coo", "cfo", "ceo", "cto"]);

/** Try to extract a delegation plan from Aria's response text. */
export function parseDelegationPlan(text: string): DelegationPlan | null {
  // Look for ```json ... ``` block containing delegation
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?"type"\s*:\s*"delegation"[\s\S]*?\})\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]!) as DelegationPlan;
    if (parsed.type !== "delegation" || !Array.isArray(parsed.tasks)) return null;

    // Validate each task
    const validTasks = parsed.tasks.filter(
      (t) => VALID_AGENTS.has(t.agent) && typeof t.instruction === "string" && t.instruction.length > 0
    );
    if (validTasks.length === 0) return null;

    return { type: "delegation", tasks: validTasks };
  } catch {
    return null;
  }
}

/** Execute all delegated tasks sequentially, streaming progress to the client. */
export async function executeDelegation(opts: {
  plan: DelegationPlan;
  workspaceId: string;
  workspaceName: string;
  promptContext: BuildPromptContext;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}): Promise<{ outputs: Array<{ agent: string; output: string }>; totalInputTokens: number; totalOutputTokens: number }> {
  const { plan, workspaceId, workspaceName, promptContext, controller, encoder } = opts;
  const anthropic = getAnthropic();
  const admin = createSupabaseAdminClient();
  const outputs: Array<{ agent: string; output: string }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Load memories once for all agents
  const memories = await loadMemories(workspaceId, 12).catch(() => []);

  for (const task of plan.tasks) {
    const agentRole = task.agent as AgentRole;
    const agentName = AGENTS[agentRole]?.name ?? task.agent;

    // Stream progress marker
    controller.enqueue(encoder.encode(`\n\n[AGENT:${task.agent}:start:${agentName}]\n`));

    try {
      // Build system prompt for this agent
      const system = buildSystemPrompt(agentRole, { ...promptContext, memories });

      // Call Claude for this agent
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system,
        messages: [
          {
            role: "user",
            content: task.instruction +
              (outputs.length > 0
                ? `\n\n== Context from other executives ==\n${outputs.map(o => `[${o.agent.toUpperCase()}]: ${o.output.slice(0, 500)}`).join("\n\n")}`
                : ""),
          },
        ],
      });

      const output = response.content[0]?.type === "text" ? response.content[0].text : "";
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      outputs.push({ agent: task.agent, output });

      // Stream agent's output preview
      controller.enqueue(encoder.encode(`${output.slice(0, 200)}…\n`));
      controller.enqueue(encoder.encode(`[AGENT:${task.agent}:done:${agentName}]\n`));

      // Record usage for this agent call
      await recordUsage({
        workspaceId,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      // Persist the agent's output to their conversation
      const { data: conv } = await admin
        .from("conversations")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("agent_role", task.agent)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conv) {
        await admin.from("messages").insert([
          { conversation_id: conv.id, workspace_id: workspaceId, role: "user", content: `[Delegated by Aria] ${task.instruction}`, model: ANTHROPIC_MODEL },
          { conversation_id: conv.id, workspace_id: workspaceId, role: "assistant", content: output, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens, model: ANTHROPIC_MODEL },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Agent call failed";
      controller.enqueue(encoder.encode(`[AGENT:${task.agent}:error:${msg}]\n`));
      outputs.push({ agent: task.agent, output: `Error: ${msg}` });
    }
  }

  // Fire-and-forget audit log after all delegated tasks complete
  void logAudit({
    workspaceId,
    actorType: "agent",
    agentRole: "aria",
    action: "agent.delegation",
    summary: `Aria delegated to ${plan.tasks.map((t) => t.agent).join(", ")}`,
    metadata: {
      tasks: plan.tasks.map((t) => ({
        agent: t.agent,
        instruction: t.instruction.slice(0, 100),
      })),
    },
  });

  return { outputs, totalInputTokens, totalOutputTokens };
}

/** Generate Aria's synthesis of all delegated outputs. */
export async function synthesizeDelegation(opts: {
  outputs: Array<{ agent: string; output: string }>;
  originalRequest: string;
  promptContext: BuildPromptContext;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const anthropic = getAnthropic();

  const memories = opts.promptContext.memories ?? [];
  const system = buildSystemPrompt("aria", { ...opts.promptContext, memories });

  const agentOutputs = opts.outputs
    .map((o) => `== ${AGENTS[o.agent as AgentRole]?.name ?? o.agent} (${o.agent.toUpperCase()}) ==\n${o.output}`)
    .join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2000,
    system,
    messages: [
      {
        role: "user",
        content: `The Founder originally asked: "${opts.originalRequest}"

I delegated to the following executives and here are their outputs:

${agentOutputs}

Now synthesize these into ONE cohesive deliverable. Combine the best from each executive's output into a polished, board-ready document. Use proper formatting (headers, bullets, tables where appropriate). Do not just concatenate — synthesize and add your editorial perspective as Chief of Staff.`,
      },
    ],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
