"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?type=recovery&next=/reset-password`
    });
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md">
        <Link href="/login" className="flex items-center gap-2.5 mb-6">
          <span className="logo-mark" />
          <span className="font-bold text-lg">
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>

        <h1 className="serif text-3xl mb-2">Reset your password.</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Enter your email address and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="rounded-xl p-4 bg-[var(--soft)] text-sm space-y-1">
            <p className="font-semibold">Email sent.</p>
            <p className="text-[var(--muted)]">
              Check your inbox at <strong>{email}</strong> for the reset link.
              It expires in 1 hour.
            </p>
            <p className="pt-2">
              <Link href="/login" className="underline text-[var(--ink)]">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              className="input"
              placeholder="you@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
            >
              {loading ? "Sending…" : "Send reset link →"}
            </button>
            <div className="text-center pt-1">
              <Link href="/login" className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline underline-offset-2">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
