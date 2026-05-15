"use client";

/**
 * src/app/reset-password/page.tsx
 *
 * Handles the password-reset link that Supabase emails to users.
 * The auth callback routes to here when the `next` param is /reset-password.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--zn-bg)" }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: "var(--zn-surface)",
          border: "1px solid var(--zn-line-soft)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div
            className="size-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white"
            style={{ background: "#1d1813" }}
          >
            Z
          </div>
          <span className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Zentra Flow
          </span>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div
              className="size-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--zn-safe-soft)" }}
            >
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: "var(--zn-safe)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Password updated
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              Redirecting you to your dashboard…
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold mb-1" style={{ color: "var(--zn-ink)" }}>
              Set new password
            </h1>
            <p className="text-[13.5px] mb-6" style={{ color: "var(--zn-ink-3)" }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--zn-ink-3)" }}>
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-shadow"
                  style={{
                    background: "var(--zn-bg-2)",
                    border: "1px solid var(--zn-line)",
                    color: "var(--zn-ink)",
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--zn-ink-3)" }}>
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-shadow"
                  style={{
                    background: "var(--zn-bg-2)",
                    border: "1px solid var(--zn-line)",
                    color: "var(--zn-ink)",
                  }}
                />
              </div>

              {error && (
                <p
                  className="text-[12.5px] rounded-lg px-3 py-2"
                  style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-2.5 text-[14px] font-semibold transition-opacity disabled:opacity-50"
                style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
