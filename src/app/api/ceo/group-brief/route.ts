// CEO Dashboard — group brief READ seam (machine-to-machine).
//
// GET /api/ceo/group-brief[?org_id=uuid]
//   Auth: Authorization: Bearer CEO_BRIEF_SECRET. Built for the standalone
//   CF ai app (v2 topology, CF-AI-GROUP-PLAN.md §7): it pulls the whole
//   group picture without a browser session, narrates it itself, and files
//   recommendations. Read-only by design — external agents never write
//   financials through this seam; numbers arrive via /api/ceo/feed.
//
//   Without org_id, resolves the org that has the most active ventures
//   (single-HQ reality today; explicit org_id wins when passed).
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { composeGroupBrief } from "@/lib/cf-ai/brief";

function authOk(req: NextRequest): boolean {
  const secret = process.env.CEO_BRIEF_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  let orgId = req.nextUrl.searchParams.get("org_id");

  if (orgId && !UUID_RE.test(orgId)) {
    return NextResponse.json(
      { error: "org_id must be a UUID" },
      { status: 400 },
    );
  }

  if (!orgId) {
    const { data: entities } = await admin
      .from("ceo_entities")
      .select("org_id")
      .eq("is_active", true);
    const counts = new Map<string, number>();
    for (const e of entities ?? []) {
      counts.set(e.org_id, (counts.get(e.org_id) ?? 0) + 1);
    }
    for (const [id, n] of counts) {
      if (!orgId || n > (counts.get(orgId) ?? 0)) orgId = id;
    }
    if (!orgId) {
      return NextResponse.json(
        { error: "No active ventures on the dashboard yet" },
        { status: 404 },
      );
    }
  }

  try {
    const brief = await composeGroupBrief(orgId);

    await admin.from("ceo_audit_log").insert({
      user_id: null,
      entity_id: null,
      table_name: "cf_ai:group_brief_api",
      record_id: null,
      action: "export",
      diff: {
        org_id: orgId,
        ventures: brief.ventures.length,
        groupPulse: brief.groupPulse,
      },
    });

    return NextResponse.json({ brief });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Brief failed" },
      { status: 500 },
    );
  }
}
