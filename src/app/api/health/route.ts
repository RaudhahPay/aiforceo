// Health check endpoint — used by monitoring, uptime checkers, and Cloudflare health checks.
// Returns 200 if the app is running and DB is reachable.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// No edge runtime — runs as Node.js on Cloudflare Workers via OpenNext
export async function GET(): Promise<NextResponse> {
  try {
    const admin = createSupabaseAdminClient();
    // Lightweight DB ping — just check the profiles table exists
    const { error } = await admin.from("profiles").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, db: "error", error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: true, db: "connected", ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 503 });
  }
}
