/**
 * Google Sheets connector — token refresh, sheet reading, context builder.
 *
 * Used by:
 *   - /api/chat/agent  → buildSheetsContext() to inject live sheet data into prompts
 *   - /api/connectors/sheets/test  → testSheetConnection() for the UI "Test" button
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GoogleConnector = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  metadata: Record<string, string>;
};

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Returns a valid access token, refreshing it first if it's expired (or within
 * 5 minutes of expiry). Returns null if the connector has no refresh_token or if
 * the API call fails.
 */
export async function getValidAccessToken(
  connector: GoogleConnector,
): Promise<string | null> {
  if (!connector.access_token) return null;

  // Check if still valid (with 5-min buffer)
  if (connector.expires_at) {
    const expiresAt = new Date(connector.expires_at).getTime();
    if (Date.now() + 5 * 60_000 < expiresAt) {
      return connector.access_token; // still good
    }
  }

  // Refresh needed
  if (!connector.refresh_token) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "[google-sheets] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing from env — token refresh skipped",
    );
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connector.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(unreadable)");
      console.error(
        `[google-sheets] Token refresh failed: HTTP ${res.status} — ${errBody}`,
      );
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    const newExpiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    // Persist refreshed token
    const admin = createSupabaseAdminClient();
    await admin
      .from("connectors")
      .update({
        access_token: data.access_token,
        expires_at: newExpiresAt,
      })
      .eq("id", connector.id);

    return data.access_token;
  } catch (err) {
    console.error("[google-sheets] Token refresh threw:", err);
    return null;
  }
}

// ── Sheet utilities ───────────────────────────────────────────────────────────

/** Extract spreadsheet ID from any Google Sheets URL. */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

type ReadResult = {
  data: string;
  rowCount: number;
  headers: string[];
};

/**
 * Reads a range from a spreadsheet via the Google Sheets v4 API.
 * Returns formatted tab-separated rows, row count, and the header row.
 */
export async function readGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  range = "A1:Z500",
): Promise<ReadResult | null> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(unreadable)");
      console.error(
        `[google-sheets] Sheets API error: HTTP ${res.status} for sheet ${spreadsheetId} — ${errBody}`,
      );
      return null;
    }

    const json = (await res.json()) as { values?: string[][] };
    const rows: string[][] = json.values ?? [];
    if (rows.length === 0)
      return { data: "(Sheet is empty)", rowCount: 0, headers: [] };

    const headers = rows[0] ?? [];
    const data = rows.map((r) => r.join("\t")).join("\n");
    return { data, rowCount: rows.length, headers };
  } catch (err) {
    console.error("[google-sheets] readGoogleSheet threw:", err);
    return null;
  }
}

// ── Context builder (used by agent route) ────────────────────────────────────

/**
 * Full pipeline:
 *   1. Load the active Google Sheets connector for this workspace.
 *   2. Refresh the access token if needed.
 *   3. Read the configured sheet.
 *   4. Return a formatted context string ready to inject into the agent system prompt.
 *
 * Returns null if the connector isn't set up, sheet URL isn't configured, or any
 * step fails — callers should treat null as "no sheet data available" and continue.
 */
export async function buildSheetsContext(
  workspaceId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data: row } = await admin
    .from("connectors")
    .select("id, access_token, refresh_token, expires_at, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_sheets")
    .eq("status", "active")
    .maybeSingle();

  if (!row) return null;

  const meta: Record<string, string> = (row.metadata ?? {}) as Record<
    string,
    string
  >;
  const sheetUrl = meta.sheet_url;
  if (!sheetUrl) return null; // OAuth done but sheet not yet configured

  const spreadsheetId = extractSheetId(sheetUrl);
  if (!spreadsheetId) return null;

  const connector: GoogleConnector = {
    id: row.id as string,
    access_token: row.access_token as string | null,
    refresh_token: row.refresh_token as string | null,
    expires_at: row.expires_at as string | null,
    metadata: meta,
  };

  const accessToken = await getValidAccessToken(connector);
  if (!accessToken) return null;

  const range = meta.sheet_range || "A1:Z500";
  const result = await readGoogleSheet(accessToken, spreadsheetId, range);
  if (!result) return null;

  const sheetName = meta.sheet_name || "Google Sheet";
  return [
    `== Live Data: ${sheetName} (Google Sheets — ${result.rowCount} rows) ==`,
    result.data,
    "== End of Google Sheets data ==",
  ].join("\n");
}

// ── Ad-hoc URL fetch (used by agent route when user pastes a URL) ────────────

/**
 * Fetches a Google Sheet by an arbitrary URL using the workspace's connected
 * Google OAuth tokens. Call this when the user pastes a Sheets URL in chat.
 *
 * Returns null if:
 *   - The URL can't be parsed as a Sheets link
 *   - No active Google Sheets connector exists for this workspace
 *   - The token can't be refreshed
 *   - The Sheets API call fails
 */
export async function fetchSheetByUrl(
  workspaceId: string,
  url: string,
): Promise<string | null> {
  const spreadsheetId = extractSheetId(url);
  if (!spreadsheetId) {
    console.error(
      "[google-sheets] fetchSheetByUrl: could not parse spreadsheet ID from URL:",
      url,
    );
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("connectors")
    .select("id, access_token, refresh_token, expires_at, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_sheets")
    .eq("status", "active")
    .maybeSingle();

  if (!row) {
    console.error(
      `[google-sheets] fetchSheetByUrl: no active google_sheets connector for workspace ${workspaceId}`,
    );
    return null;
  }

  const meta: Record<string, string> = (row.metadata ?? {}) as Record<
    string,
    string
  >;
  const connector: GoogleConnector = {
    id: row.id as string,
    access_token: row.access_token as string | null,
    refresh_token: row.refresh_token as string | null,
    expires_at: row.expires_at as string | null,
    metadata: meta,
  };

  const accessToken = await getValidAccessToken(connector);
  if (!accessToken) {
    console.error(
      `[google-sheets] fetchSheetByUrl: getValidAccessToken returned null for connector ${row.id}`,
    );
    return null;
  }

  const result = await readGoogleSheet(accessToken, spreadsheetId);
  if (!result) {
    console.error(
      `[google-sheets] fetchSheetByUrl: readGoogleSheet returned null for sheet ${spreadsheetId}`,
    );
    return null;
  }

  // Prefer a saved sheet_name; fall back to a generic label
  const label = meta.sheet_name || "Shared Google Sheet";
  return [
    `== Live Data: ${label} (from shared URL — ${result.rowCount} rows) ==`,
    result.data,
    "== End of Google Sheets data ==",
  ].join("\n");
}

// ── Test connection (used by connector UI) ────────────────────────────────────

export type TestResult =
  | { ok: true; rowCount: number; headers: string[]; preview: string }
  | { ok: false; error: string };

/**
 * Tests the configured Google Sheet connection for a workspace.
 * Returns up to 5 rows as a preview so the user can confirm the right sheet is loaded.
 */
export async function testSheetConnection(
  workspaceId: string,
): Promise<TestResult> {
  const admin = createSupabaseAdminClient();

  const { data: row } = await admin
    .from("connectors")
    .select("id, access_token, refresh_token, expires_at, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_sheets")
    .eq("status", "active")
    .maybeSingle();

  if (!row) return { ok: false, error: "Google Sheets is not connected." };

  const meta: Record<string, string> = (row.metadata ?? {}) as Record<
    string,
    string
  >;
  const sheetUrl = meta.sheet_url;
  if (!sheetUrl) return { ok: false, error: "No sheet URL configured yet." };

  const spreadsheetId = extractSheetId(sheetUrl);
  if (!spreadsheetId)
    return {
      ok: false,
      error: "Could not parse the spreadsheet ID from that URL.",
    };

  const connector: GoogleConnector = {
    id: row.id as string,
    access_token: row.access_token as string | null,
    refresh_token: row.refresh_token as string | null,
    expires_at: row.expires_at as string | null,
    metadata: meta,
  };

  const accessToken = await getValidAccessToken(connector);
  if (!accessToken)
    return {
      ok: false,
      error:
        "Could not get a valid access token. Please reconnect Google Sheets.",
    };

  // Read just 5 rows for preview
  const result = await readGoogleSheet(accessToken, spreadsheetId, "A1:Z5");
  if (!result)
    return {
      ok: false,
      error:
        "Could not read the spreadsheet. Check that it is shared with the connected account and is not empty.",
    };

  return {
    ok: true,
    rowCount: result.rowCount,
    headers: result.headers,
    preview: result.data,
  };
}
