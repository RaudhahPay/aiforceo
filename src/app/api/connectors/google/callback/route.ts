// Google Sheets OAuth2 callback.
// Exchanges the authorization code for access + refresh tokens and saves
// them to the connectors table.
//
// Required env vars (add via `pnpm wrangler secret put`):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/connectors?error=google_denied`);
  }

  // Decode workspace_id from state
  let workspaceId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    workspaceId = decoded.workspace_id;
    if (!workspaceId) throw new Error("missing workspace_id");
  } catch {
    return NextResponse.redirect(`${appUrl}/connectors?error=invalid_state`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/connectors?error=not_configured`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  `${appUrl}/api/connectors/google/callback`,
      grant_type:    "authorization_code"
    })
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/connectors?error=google_token_failed`);
  }
  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token?: string;
    expires_in:    number;
  };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const admin = createSupabaseAdminClient();
  await admin.from("connectors").upsert(
    {
      workspace_id:  workspaceId,
      provider:      "google_sheets",
      status:        "active",
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at:    expiresAt,
      metadata:      { scopes: ["spreadsheets", "drive.readonly"] }
    },
    { onConflict: "workspace_id,provider" }
  );

  return NextResponse.redirect(`${appUrl}/connectors?connected=google`);
}
