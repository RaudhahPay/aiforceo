"use server";

// Onboarding write action.
// Per SOP §4.2 + §4.3: server-only async exports, zod-validated input,
// `requireUser()` before any write, every write via the admin client.
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";

const SaveOnboarding = z.object({
  businessName: z.string().min(1).max(120),
  industry: z.string().min(1).max(120),
  size: z.enum(["solo", "small", "mid", "large", "xlarge"]),
  challenges: z.array(z.string().max(60)).max(6),
  goals90d: z.string().max(800).default(""),
  voiceSample: z.string().max(8000).default(""),
  pnlText: z.string().max(8000).default("")
});

type SaveOnboardingResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export async function saveOnboarding(input: unknown): Promise<SaveOnboardingResult> {
  const parsed = SaveOnboarding.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const data = parsed.data;

  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  // 1. Create the workspace.
  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: data.businessName,
      slug: `${slugify(data.businessName)}-${user.id.slice(0, 6)}`,
      tier: "trial",
      monthly_token_quota: 100_000,
      onboarded: true
    })
    .select("id")
    .single();
  if (wsErr || !ws) return { ok: false, error: wsErr?.message ?? "Workspace insert failed" };

  // 2. Save the business profile.
  const { error: bpErr } = await admin.from("business_profiles").upsert({
    workspace_id: ws.id,
    industry: data.industry,
    size: data.size,
    challenges: data.challenges,
    goals_90d: data.goals90d
  });
  if (bpErr) return { ok: false, error: bpErr.message };

  // 3. Persist the raw brand-voice sample immediately so onboarding never
  //    blocks on AI. If ANTHROPIC_API_KEY is set, extract structured voice
  //    attributes in the background-but-awaited path with a hard 8s timeout.
  //    Per Decision Log D-016: never let an external API hang a server
  //    action long enough to risk the 30s Worker timeout.
  if (data.voiceSample.length >= 30) {
    await admin.from("brand_voice").upsert({
      workspace_id: ws.id,
      source_text: data.voiceSample
    });

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const client = getAnthropic();
        const extraction = client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 600,
          system:
            "Analyze the sample of writing and return JSON only with keys: " +
            "summary (one paragraph), tone (4-6 adjectives), " +
            "wordsToUse (5-10 signature words), wordsToAvoid (5-10 phrases to avoid). " +
            "No prose, no markdown — just the JSON.",
          messages: [{ role: "user", content: data.voiceSample }]
        });
        // Race against an 8s timeout so onboarding stays snappy even if
        // Anthropic is slow / unreachable / mis-keyed.
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("anthropic timeout")), 8_000)
        );
        const out = await Promise.race([extraction, timeout]);
        const first = out.content[0];
        const txt = first && first.type === "text" ? first.text : "{}";
        const cleaned = txt.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
        const v = JSON.parse(cleaned) as {
          summary?: string;
          tone?: string[];
          wordsToUse?: string[];
          wordsToAvoid?: string[];
        };
        await admin.from("brand_voice").update({
          voice_summary: v.summary ?? null,
          tone_attributes: v.tone ?? null,
          words_to_use: v.wordsToUse ?? null,
          words_to_avoid: v.wordsToAvoid ?? null
        }).eq("workspace_id", ws.id);
      } catch {
        // Raw sample already saved above; user can re-trigger extraction
        // from inside the app later.
      }
    }
  }

  // 4. Save P&L snapshot if provided.
  if (data.pnlText.length >= 20) {
    await admin.from("financial_snapshots").insert({
      workspace_id: ws.id,
      period: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      raw_text: data.pnlText
    });
  }

  // 5. Grant trial token quota.
  await admin.from("credit_ledger").insert({
    workspace_id: ws.id,
    delta_tokens: 100_000,
    reason: "monthly_reset"
  });

  return { ok: true, workspaceId: ws.id };
}
