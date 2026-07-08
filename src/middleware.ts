import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/pricing",
  "/forgot-password",
  "/reset-password",
  // Team invite accept page — must be public so invitees can open the link
  "/invite/accept",
  "/api/invite/accept",
  // Health check — for uptime monitoring
  "/api/health",
  // Cron routes — protected by CRON_SECRET, not session
  "/api/cron/morning-brief",
  "/api/cron/ceo-evaluate",
  // Venture data feed — machine-to-machine, protected by HMAC (CEO_FEED_SECRET)
  "/api/ceo/feed",
  // Auth callback + payment webhook
  "/api/auth/callback",
  "/api/stripe/webhook",
  // Invite accept — must be public so anyone with the link can land here
  "/invite",
  // Agent chat (token-gated inside the route, not session-gated here)
  "/api/chat/prospect",
  "/api/chat/agent",
  // OAuth callbacks — must be public because the browser follows these redirects
  // FROM Google/QuickBooks after leaving the app. The session cookie may not be
  // present on the redirect leg. Each callback verifies the request via the
  // signed `state` parameter + the provider's token exchange instead.
  "/api/connectors/google/callback",
  "/api/connectors/quickbooks/callback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static");

  // Wrap updateSession so a crash never turns into an HTML 500 page.
  let response = NextResponse.next();
  let user: { id: string } | null = null;
  try {
    const result = await updateSession(request);
    response = result.response;
    user = result.user;
  } catch {
    // Session update failed (e.g. Supabase unreachable).
    // Treat as unauthenticated — protected routes will redirect/401 below.
  }

  if (!isPublic && !user) {
    // API routes must return JSON, not an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
