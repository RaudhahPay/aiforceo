// RLS-respecting server-side client.
// Per SOP §4.2 — READ-ONLY in practice: use this in server components and
// for `select` calls inside server actions. NEVER use it for writes; writes
// go through createSupabaseAdminClient() (see ./admin.ts) gated by a
// require*() check.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          toSet: Array<{ name: string; value: string; options?: CookieOptions }>
        ) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies; safe to ignore.
          }
        }
      }
    }
  );
}
