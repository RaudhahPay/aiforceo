"use server";

/**
 * CF ai — server actions (Phase 2: Advisor, read-only).
 *
 * The brief reads every venture in the org, so it is gated to the
 * workspace owner / group_ceo / org-wide admin only. CF ai writes
 * nothing here except its audit trail.
 */

import { requireUser, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import { assertOrgAdmin } from "@/lib/ceo-dashboard/access";
import {
  composeGroupBrief,
  narrateBrief,
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
