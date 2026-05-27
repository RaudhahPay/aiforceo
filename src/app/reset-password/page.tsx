"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    // Password updated — redirect to dashboard
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-6">
          <span className="logo-mark" />
          <span className="font-bold text-lg">
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>

        <h1 className="serif text-3xl mb-2">Set a new password.</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Choose a strong password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            className="input"
            placeholder="New password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            required
            className="input"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full justify-center"
          >
            {loading ? "Saving…" : "Update password →"}
          </button>
        </form>
      </div>
    </main>
  );
}
