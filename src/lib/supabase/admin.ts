// Service-role admin client. Bypasses RLS.
//
// USE ONLY for writes, and only inside a `'use server'` action that has
// already called a require*() helper (see src/lib/auth/require.ts).
//
// Reason (SOP §4.2): the RLS-respecting client's write context is unreliable
// on Cloudflare Workers — auth.uid() does not always reach Postgres, so the
// UPDATE silently matches zero rows. The require*() check IS the security
// gate; this client is the reliable write path.
//
// NEVER import this from a client component. NEVER expose
// SUPABASE_SERVICE_ROLE_KEY to the browser.
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
