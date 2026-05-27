"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        if (err.message.toLowerCase().includes("invalid login credentials") ||
            err.message.toLowerCase().includes("invalid credentials")) {
          setError('Incorrect email or password. If you signed in with a magic link before, use "Forgot password?" below to set one.');
        } else if (err.message.toLowerCase().includes("email not confirmed")) {
          setError("Please confirm your email first — check your inbox for the confirmation link.");
        } else {
          setError(err.message);
        }
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` }
      });
      if (err) {
        if (err.message.toLowerCase().includes("already registered") ||
            err.message.toLowerCase().includes("already been registered")) {
          setError('An account with this email already exists. Switch to "Sign in", or use "Forgot password?" to reset.');
        } else {
          setError(err.message);
        }
        setLoading(false);
        return;
      }
      // Try immediate sign-in (works when email confirmation is disabled)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInErr) {
        router.push("/dashboard");
        return;
      }
      setSignupDone(true);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="logo-mark" style={{ width: 32, height: 32, borderRadius: 9 }} />
          <span className="font-bold text-xl">
            Boardroom <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>

        <div className="card" style={{ padding: "32px 28px" }}>
          {/* Mode toggle */}
          <div style={{
            display: "flex",
            background: "var(--panel2)",
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
            border: "1px solid var(--line)",
          }}>
            {(["signin", "signup"] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); }}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: 9,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.15s",
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#0E1726" : "var(--muted)",
                  }}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              );
            })}
          </div>

          {signupDone ? (
            <div style={{
              background: "rgba(63,185,132,0.08)",
              border: "1px solid rgba(63,185,132,0.25)",
              borderRadius: 12,
              padding: "16px 18px",
            }}>
              <p className="font-semibold text-sm" style={{ color: "var(--success)" }}>✓ Check your inbox</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                A confirmation link was sent to <strong style={{ color: "var(--ink)" }}>{email}</strong>.
                Click it to activate your account, then sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="you@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="input"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {mode === "signup" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    className="input"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              )}

              {error && (
                <div style={{
                  background: "rgba(229,84,75,0.08)",
                  border: "1px solid rgba(229,84,75,0.25)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "var(--red)",
                  lineHeight: 1.5,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn w-full justify-center"
                style={{ marginTop: 4 }}
              >
                {loading
                  ? (mode === "signin" ? "Signing in…" : "Creating account…")
                  : (mode === "signin" ? "Sign in →" : "Create account →")}
              </button>

              {mode === "signin" && (
                <div className="text-center" style={{ marginTop: 4 }}>
                  <Link
                    href="/forgot-password"
                    style={{ fontSize: 12, color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
