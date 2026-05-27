"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

const UpdateProfile = z.object({
  businessName: z.string().min(1).max(120),
  industry: z.string().min(1).max(120),
  size: z.enum(["solo", "small", "mid", "large", "xlarge"]),
  challenges: z.array(z.string().max(60)).max(6),
  goals90d: z.string().max(800).default(""),
  primaryOffer: z.string().max(300).default(""),
  targetCustomer: z.string().max(300).default(""),
  voiceSample: z.string().max(8000).default(""),
  pnlText: z.string().max(8000).default(""),
});

type Result = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: unknown): Promise<Result> {
  const parsed = UpdateProfile.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const user = await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found" };

  const admin = createSupabaseAdminClient();
  const wsId = ctx.workspace.id;

  // 1. Update workspace name
  const { error: wsErr } = await admin
    .from("workspaces")
    .update({ name: data.businessName })
    .eq("id", wsId)
    .eq("owner_id", user.id);
  if (wsErr) return { ok: false, error: wsErr.message };

  // 2. Upsert business profile
  const { error: bpErr } = await admin.from("business_profiles").upsert({
    workspace_id: wsId,
    industry: data.industry,
    size: data.size,
    challenges: data.challenges,
    goals_90d: data.goals90d,
    primary_offer: data.primaryOffer || null,
    target_customer: data.targetCustomer || null,
  });
  if (bpErr) return { ok: false, error: bpErr.message };

  // 3. Update brand voice if a new sample was provided
  if (data.voiceSample.length >= 30) {
    await admin
      .from("brand_voice")
      .upsert({ workspace_id: wsId, source_text: data.voiceSample });

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = getAnthropic();
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8_000),
        );
        const extraction = client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 600,
          system:
            "Analyze the sample of writing and return JSON only with keys: " +
            "summary (one paragraph), tone (4-6 adjectives), " +
            "wordsToUse (5-10 signature words), wordsToAvoid (5-10 phrases to avoid). " +
            "No prose, no markdown — just the JSON.",
          messages: [{ role: "user", content: data.voiceSample }],
        });
        const out = await Promise.race([extraction, timeout]);
        const txt =
          out.content[0]?.type === "text" ? out.content[0].text : "{}";
        const v = JSON.parse(
          txt
            .replace(/^```(?:json)?/m, "")
            .replace(/```$/m, "")
            .trim(),
        ) as {
          summary?: string;
          tone?: string[];
          wordsToUse?: string[];
          wordsToAvoid?: string[];
        };
        await admin
          .from("brand_voice")
          .update({
            voice_summary: v.summary ?? null,
            tone_attributes: v.tone ?? null,
            words_to_use: v.wordsToUse ?? null,
            words_to_avoid: v.wordsToAvoid ?? null,
          })
          .eq("workspace_id", wsId);
      } catch {
        // Non-fatal — raw sample already saved
      }
    }
  }

  // 4. Save new P&L snapshot if provided
  if (data.pnlText.length >= 20) {
    await admin.from("financial_snapshots").insert({
      workspace_id: wsId,
      period: new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      raw_text: data.pnlText,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
