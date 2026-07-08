"use server";

/**
 * CF ai — server actions (Phase 2: Advisor, read-only).
 *
 * The brief reads every venture in the org, so it is gated to the
 * workspace owner / group_ceo / org-wide admin only. CF ai writes
 * nothing here except its audit trail.
 */

import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { getCurrentWorkspace } from "@/lib/workspace";
import { assertOrgAdmin } from "@/lib/ceo-dashboard/access";
import {
  composeGroupBrief,
  narrateBrief,
  fallbackNarrative,
  type GroupBrief,
} from "@/lib/cf-ai/brief";

export type BriefResult =
  | { ok: true; brief: GroupBrief }
  | { ok: false; error: string };

export async function getGroupBrief(): Promise<BriefResult> {
  try {
    const user = await requireUser();
    const ctx = await getCurrentWorkspace();
    if (!ctx) return { ok: false, error: "No workspace selected" };

    await assertOrgAdmin(user.id, ctx.workspace.id);

    const brief = await narrateBrief(await composeGroupBrief(ctx.workspace.id));

    const admin = createSupabaseAdminClient();
    await admin.from("ceo_audit_log").insert({
      user_id: user.id,
      entity_id: null,
      table_name: "cf_ai:group_brief",
      record_id: null,
      action: "export",
      diff: {
        groupPulse: brief.groupPulse,
        topPriorities: brief.topPriorities,
        ventures: brief.ventures.length,
      },
    });

    return { ok: true, brief };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Brief generation failed",
    };
  }
}

/* ═══════════════ Ask CF ai ═══════════════ */

const askSchema = z.object({
  question: z.string().trim().min(2).max(600),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      }),
    )
    .max(10)
    .default([]),
});

export type AskResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

const CF_AI_SYSTEM = `You are CF ai — the AI group CEO of White Unicorn Ventures, built in Coach Fadzil's image and operating in ADVISOR MODE: you analyse and recommend, Coach decides. You are speaking directly to Coach.

Rules, non-negotiable:
- Answer ONLY from the group brief data provided. Never invent numbers. If the data is missing, say exactly what is missing and which venture needs to report it.
- Cash first, red first. Lead with what threatens the business.
- Plain, direct, warm language. Short paragraphs. No corporate padding. Numbers in RM.
- Every problem you raise must come with a recommended next action and who should own it.
- People, hiring/firing, and deen matters: you advise at most and say clearly the decision is Coach's alone.
- If asked to execute anything, remind Coach you are in advisor mode — recommendations only.`;

export async function askCfAi(input: unknown): Promise<AskResult> {
  try {
    const user = await requireUser();
    const ctx = await getCurrentWorkspace();
    if (!ctx) return { ok: false, error: "No workspace selected" };

    await assertOrgAdmin(user.id, ctx.workspace.id);

    const { question, history } = askSchema.parse(input);
    const brief = await composeGroupBrief(ctx.workspace.id);

    let answer: string;
    if (!process.env.ANTHROPIC_API_KEY) {
      answer = [
        "AI narrative is not configured yet (no API key), so here is the deterministic read of the group:",
        fallbackNarrative(brief),
      ].join("\n\n");
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 900,
        system: CF_AI_SYSTEM,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user" as const,
            content: `Today's group brief (generated ${brief.generatedAt}):\n${JSON.stringify(
              {
                groupPulse: brief.groupPulse,
                cashPositionRm: brief.cashPositionRm,
                topPriorities: brief.topPriorities,
                ventures: brief.ventures.map((v) => ({
                  name: v.name,
                  industry: v.industryType,
                  healthBadge: v.health.badge,
                  healthScore: v.health.score,
                  cashBankRm: v.cashBankRm,
                  findings: v.findings,
                })),
              },
              null,
              2,
            )}\n\nCoach's question: ${question}`,
          },
        ],
      });
      answer =
        response.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n")
          .trim() || fallbackNarrative(brief);
    }

    const admin = createSupabaseAdminClient();
    await admin.from("ceo_audit_log").insert({
      user_id: user.id,
      entity_id: null,
      table_name: "cf_ai:ask",
      record_id: null,
      action: "export",
      diff: {
        question,
        answeredWithAi: Boolean(process.env.ANTHROPIC_API_KEY),
      },
    });

    return { ok: true, answer };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) {
      return {
        ok: false,
        error: "Ask a question between 2 and 600 characters",
      };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "CF ai could not answer",
    };
  }
}
