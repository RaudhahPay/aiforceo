// Edge middleware helper — refreshes the Supabase session on every request
// and returns the authenticated user (if any).
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          toSet: Array<{ name: string; value: string; options?: CookieOptions }>
        ) => {
          for (const { name, value, options } of toSet) {
            request.cookies.set({ name, value, ...options });
          }
          response = NextResponse.next({ request: { headers: request.headers } });
          for (const { name, value, options } of toSet) {
            response.cookies.set({ name, value, ...options });
          }
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
