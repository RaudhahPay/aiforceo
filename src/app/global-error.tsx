"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

// Catches React render errors in the App Router (root layout crashes).
// Reports to Sentry when NEXT_PUBLIC_SENTRY_DSN is set.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0E1726", color: "#E8EDF6", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#8597B8", marginBottom: 24 }}>
              An unexpected error occurred. Our team has been notified.
              {error.digest && (
                <span style={{ display: "block", fontSize: 11, marginTop: 8, opacity: 0.5 }}>
                  Error ID: {error.digest}
                </span>
              )}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "10px 20px", borderRadius: 999, fontWeight: 600, fontSize: 13,
                  background: "#C5A572", color: "#0E1726", border: "none", cursor: "pointer",
                }}
              >
                Try again
              </button>
              <Link
                href="/"
                style={{
                  padding: "10px 20px", borderRadius: 999, fontWeight: 600, fontSize: 13,
                  background: "transparent", color: "#E8EDF6",
                  border: "1.5px solid #2A3B5E", textDecoration: "none", display: "inline-flex", alignItems: "center",
                }}
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
