import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const debug: Record<string, unknown> = {};

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    debug.userId = user?.id ?? null;
    debug.userEmail = user?.email ?? null;
    debug.authError = authErr?.message ?? null;

    const jar = await cookies();
    debug.activeWsCookie = jar.get("ai4c_active_ws")?.value ?? null;
    debug.hasAuthCookie = jar.getAll().some(c => c.name.includes("auth-token"));

    if (user) {
      const admin = createSupabaseAdminClient();
      const { data: workspaces, error: wsErr } = await admin
        .from("workspaces")
        .select("id, name, onboarded, owner_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      debug.workspaces = workspaces;
      debug.wsError = wsErr?.message ?? null;
      debug.workspaceCount = workspaces?.length ?? 0;
      debug.onboardedCount = workspaces?.filter(w => w.onboarded).length ?? 0;
    }
  } catch (e) {
    debug.exception = String(e);
  }

  return NextResponse.json(debug);
}
