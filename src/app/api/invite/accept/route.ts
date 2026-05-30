// Accept invite route — called by the invite accept page.
// Validates the token, marks the invite as accepted.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let token: string;
  try {
    const body = await req.json() as { token?: string };
    token = body.token ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Token required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: invite, error } = await admin
    .from("workspace_invites")
    .select("id, workspace_id, email, role, accepted_at, expires_at, workspace:workspaces(name)")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ ok: false, error: "Invite not found" }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ ok: false, error: "Invite already accepted" }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "Invite expired" }, { status: 410 });
  }

  // Mark invite as accepted
  await admin
    .from("workspace_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const wsName = (invite.workspace as { name?: string } | null)?.name ?? "";
  return NextResponse.json({ ok: true, workspaceName: wsName });
}
