/**
 * POST /api/connectors/sheets/test
 * Tests the currently configured Google Sheet for a workspace.
 * Called by the ConnectorsClient "Test connection" button.
 */
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { testSheetConnection } from "@/lib/google-sheets";

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  // Auth
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Get workspace — respect active-workspace cookie for multi-workspace users
  const admin = createSupabaseAdminClient();
  const activeWsId = req.cookies.get("boardroom_active_ws")?.value;
  const wsBase = admin.from("workspaces").select("id").eq("owner_id", user.id).limit(1);
  let { data: workspace } = activeWsId
    ? await wsBase.eq("id", activeWsId).maybeSingle()
    : await wsBase.order("created_at", { ascending: true }).maybeSingle();
  if (!workspace && activeWsId) {
    const { data: fb } = await admin.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    workspace = fb;
  }
  if (!workspace) return json({ error: "No workspace" }, 404);

  const result = await testSheetConnection(workspace.id);
  return json(result, result.ok ? 200 : 400);
}
