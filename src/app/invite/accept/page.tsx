"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrorMsg("Invalid invite link."); return; }

    // Validate and accept invite via API
    void (async () => {
      try {
        const res = await fetch("/api/invite/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json() as { ok: boolean; workspaceName?: string; error?: string };
        if (data.ok) {
          setWorkspaceName(data.workspaceName ?? "");
          setStatus("success");
          setTimeout(() => router.push("/dashboard"), 2500);
        } else if (data.error?.includes("expired")) {
          setStatus("expired");
        } else {
          setStatus("error");
          setErrorMsg(data.error ?? "Could not accept invite.");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error — please try again.");
      }
    })();
  }, [token, router]);

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card text-center" style={{ width: "100%", maxWidth: 400, padding: 40 }}>
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="logo-mark" />
          <span className="font-bold text-xl">
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>

        {status === "loading" && (
          <>
            <p className="text-lg font-semibold mb-2">Accepting invite…</p>
            <p className="text-sm text-[var(--muted)]">Just a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <p className="text-4xl mb-4">🎉</p>
            <p className="text-lg font-bold mb-2">You&apos;re in!</p>
            <p className="text-sm text-[var(--muted)]">
              You now have access to <strong>{workspaceName}</strong>. Redirecting to your dashboard…
            </p>
          </>
        )}

        {status === "expired" && (
          <>
            <p className="text-4xl mb-4">⏰</p>
            <p className="text-lg font-bold mb-2">Invite expired</p>
            <p className="text-sm text-[var(--muted)] mb-6">
              This invite link has expired. Ask the workspace owner to send a new one.
            </p>
            <Link href="/login" className="btn">Go to login</Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-4xl mb-4">⚠️</p>
            <p className="text-lg font-bold mb-2">Something went wrong</p>
            <p className="text-sm text-[var(--muted)] mb-6">{errorMsg}</p>
            <Link href="/login" className="btn">Go to login</Link>
          </>
        )}
      </div>
    </main>
  );
}
