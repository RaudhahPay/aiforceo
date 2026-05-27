"use server";

import { z } from "zod";
import { requireWorkspaceOwner } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ── Custom API connector ───────────────────────────────────────────────────────

const CustomApiSchema = z.object({
  name:        z.string().min(1).max(60).trim(),
  endpoint:    z.string().url("Must be a valid URL"),
  authType:    z.enum(["none", "api_key", "bearer", "basic"]),
  authHeader:  z.string().max(200).optional(),
  authValue:   z.string().max(500).optional(),
  description: z.string().max(200).optional()
});

export async function saveCustomApiConnector(input: unknown) {
  const { workspace } = await requireWorkspaceOwner();
  const parsed = CustomApiSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.message };

  const { name, endpoint, authType, authHeader, authValue, description } = parsed.data;

  const admin = createSupabaseAdminClient();

  // Upsert: one custom API connector per name per workspace
  const { error } = await admin
    .from("connectors")
    .upsert(
      {
        workspace_id: workspace.id,
        provider: "custom_api",
        status: "active",
        metadata: { name, endpoint, authType, authHeader, authValue, description }
      },
      { onConflict: "workspace_id,provider", ignoreDuplicates: false }
    );

  if (error) return { error: "Could not save connector." };
  return { ok: true };
}

// ── Disconnect any connector ────────────────────────────────────────────────────

export async function disconnectConnector(connectorId: string) {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  await admin
    .from("connectors")
    .delete()
    .eq("id", connectorId)
    .eq("workspace_id", workspace.id);

  return { ok: true };
}

// ── Google Sheets sheet configuration ─────────────────────────────────────────

const SheetConfigSchema = z.object({
  sheet_url:   z.string().url("Must be a valid Google Sheets URL"),
  sheet_name:  z.string().max(80).optional(),
  sheet_range: z.string().max(40).optional(),
});

/**
 * Save (or update) the sheet URL on an already-connected Google Sheets connector.
 * The OAuth tokens stay untouched; only metadata is updated.
 */
export async function saveGoogleSheetConfig(input: unknown) {
  const { workspace } = await requireWorkspaceOwner();
  const parsed = SheetConfigSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid sheet URL." };

  const admin = createSupabaseAdminClient();

  // Load the current connector so we can merge metadata
  const { data: existing } = await admin
    .from("connectors")
    .select("id, metadata")
    .eq("workspace_id", workspace.id)
    .eq("provider", "google_sheets")
    .eq("status", "active")
    .maybeSingle();

  if (!existing) return { error: "Google Sheets is not connected. Connect it first." };

  const meta: Record<string, string> = { ...(existing.metadata as Record<string, string> ?? {}) };
  meta.sheet_url   = parsed.data.sheet_url;
  if (parsed.data.sheet_name)  meta.sheet_name  = parsed.data.sheet_name;
  if (parsed.data.sheet_range) meta.sheet_range = parsed.data.sheet_range;

  const { error } = await admin
    .from("connectors")
    .update({ metadata: meta })
    .eq("id", existing.id);

  if (error) return { error: "Could not save sheet configuration." };
  return { ok: true };
}

// ── OAuth init URLs ─────────────────────────────────────────────────────────────
// These build the authorization URL. The actual OAuth exchange happens in
// /api/connectors/[provider]/callback.

export async function getGoogleSheetsAuthUrl() {
  const { workspace } = await requireWorkspaceOwner();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { error: "GOOGLE_CLIENT_ID not configured. Add it to your Cloudflare secrets." };

  const state = Buffer.from(JSON.stringify({ workspace_id: workspace.id })).toString("base64url");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/connectors/google/callback`,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

export async function getQuickBooksAuthUrl() {
  const { workspace } = await requireWorkspaceOwner();
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  if (!clientId) return { error: "QUICKBOOKS_CLIENT_ID not configured. Add it to your Cloudflare secrets." };

  const state = Buffer.from(JSON.stringify({ workspace_id: workspace.id })).toString("base64url");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: `${appUrl}/api/connectors/quickbooks/callback`,
    state
  });
  return { url: `https://appcenter.intuit.com/connect/oauth2?${params}` };
}
