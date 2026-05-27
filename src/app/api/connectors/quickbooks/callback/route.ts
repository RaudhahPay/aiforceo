// QuickBooks OAuth2 callback.
// Required env vars:
//   QUICKBOOKS_CLIENT_ID
//   QUICKBOOKS_CLIENT_SECRET
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code      = searchParams.get("code");
  const state     = searchParams.get("state");
  const realmId   = searchParams.get("realmId"); // QuickBooks company ID
  const error     = searchParams.get("error");
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/connectors?error=qb_denied`);
  }

  let workspaceId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    workspaceId = decoded.workspace_id;
    if (!workspaceId) throw new Error("missing workspace_id");
  } catch {
    return NextResponse.redirect(`${appUrl}/connectors?error=invalid_state`);
  }

  const clientId     = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/connectors?error=not_configured`);
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`
    },
    body: new URLSearchParams({
      code,
      redirect_uri: `${appUrl}/api/connectors/quickbooks/callback`,
      grant_type:   "authorization_code"
    })
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/connectors?error=qb_token_failed`);
  }
  const tokens = await tokenRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const admin = createSupabaseAdminClient();
  await admin.from("connectors").upsert(
    {
      workspace_id:  workspaceId,
      provider:      "quickbooks",
      status:        "active",
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      metadata:      { realm_id: realmId }
    },
    { onConflict: "workspace_id,provider" }
  );

  return NextResponse.redirect(`${appUrl}/connectors?connected=quickbooks`);
}
