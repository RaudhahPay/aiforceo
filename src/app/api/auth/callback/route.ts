// Auth callback — handles email confirmation and password reset links.
// Exchanges the auth code for a session, then routes the user appropriately.
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type"); // "recovery" for password reset
  const next = url.searchParams.get("next") ?? "/dashboard";

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Password reset flow — send directly to the reset page.
  if (type === "recovery") {
    return NextResponse.redirect(`${url.origin}/reset-password`);
  }

  // Email confirmation / sign-in flow — route to onboarding or dashboard.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, onboarded")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!ws || !ws.onboarded) {
      return NextResponse.redirect(`${url.origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
