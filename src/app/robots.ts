import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing"],
        disallow: ["/dashboard", "/admin", "/agent", "/agents", "/onboarding", "/settings", "/connectors", "/workspaces", "/invite", "/search", "/saved", "/documents", "/autopilot", "/reports", "/api"]
      }
    ],
    sitemap: `${base}/sitemap.xml`
  };
}
