"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { writePendingIdentity, createLocalAccount, writeLocalAccount, demoUserStorageKey } from "@/lib/demo-auth";
import type { PlanId } from "@/lib/billing/plans";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";
import { isDisposableEmailDomain } from "@/lib/anti-abuse";

type AuthMode = "signup" | "signin";

export function DemoAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams?.get("mode");
  const errorParam = searchParams?.get("error");
  // Audit §15: prefill email when the user comes from a forgot-password
  // or invite/referral link that put ?email= in the URL.
  const emailParam = searchParams?.get("email") ?? "";
  const initialMode: AuthMode = modeParam === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const urlErrorMessage =
    errorParam === "link_expired"
      ? "That link has expired. Please request a new one."
      : errorParam === "session_missing"
      ? "Your session could not be restored. Please sign in again."
      : null;

  const [error, setError] = useState(urlErrorMessage ?? "");

  // Clear any demo session so browser autofill can't accidentally
  // sign into the demo account instead of a real one.
  useEffect(() => {
    window.localStorage.removeItem(demoUserStorageKey);
  }, []);
  const [forgotKind, setForgotKind] = useState<"err" | "ok">("err");
  const supabaseConfigured = hasSupabaseBrowserConfig();

  // UX-7: SSO. Falls back to a clear message if the provider isn't
  // configured on Supabase so we don't silently fail.
  async function signInWithOAuth(provider: "google" | "azure") {
    setError("");
    if (!supabaseConfigured) {
      setError("Sign-in providers aren't configured on this deployment.");
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (authError) {
        setError(
          `Sign-in with ${provider === "google" ? "Google" : "Microsoft"} isn't enabled yet. Try email + password.`,
        );
      }
    } catch {
      setError("Sign-in failed. Please try email + password.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Add an email and password to continue.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim() || !businessName.trim()) {
        setError("Add your name and business name so Zentra can set up your workspace.");
        return;
      }
      if (isDisposableEmailDomain(email)) {
        setError("Please use a real business email — disposable / temporary addresses aren't accepted for trials.");
        return;
      }
      if (password.length < 8) {
        setError("Use a password of at least 8 characters.");
        return;
      }
    }

    let nextName = name;
    let nextBusinessName = businessName;

    if (supabaseConfigured) {
      setIsSubmitting(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const redirectTo = `${window.location.origin}/auth/callback`;

        if (mode === "signup") {
          // Server-side trial gate (rate-limit + abuse checks happen here)
          const gateRes = await fetch("/api/auth/trial-check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, businessName }),
          });
          const gate = await gateRes.json();
          if (!gateRes.ok || !gate.allowed) {
            setError(gate.reason ?? "We couldn't start a trial right now. Please try again later or contact support.");
            setIsSubmitting(false);
            return;
          }

          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: { full_name: name, business_name: businessName },
            },
          });
          if (signUpError) throw signUpError;
        } else {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          const metadata = data.user?.user_metadata;
          if (metadata?.full_name && typeof metadata.full_name === "string") {
            nextName = metadata.full_name;
            setName(metadata.full_name);
          }
          if (metadata?.business_name && typeof metadata.business_name === "string") {
            nextBusinessName = metadata.business_name;
            setBusinessName(metadata.business_name);
          }

          // Returning user check — if they already have an account row, skip
          // onboarding and go straight to the dashboard.
          if (data.user) {
            // Two separate queries to avoid RLS blocking nested joins.
            const { data: member } = await supabase
              .from("zentra_account_members")
              .select("account_id")
              .eq("user_id", data.user.id)
              .limit(1)
              .maybeSingle<{ account_id: string }>();

            if (member?.account_id) {
              const { data: accountRow } = await supabase
                .from("zentra_accounts")
                .select("plan_id")
                .eq("id", member.account_id)
                .maybeSingle<{ plan_id: string }>();

              // DB stores uppercase plan IDs (e.g. "BOOKKEEPER_STARTER") but
              // billing/plans.ts uses lowercase keys — normalise here.
              const planId = ((accountRow?.plan_id ?? "trial").toLowerCase()) as PlanId;
              const account = createLocalAccount({
                name: nextName || data.user.email?.split("@")[0] || "User",
                email: data.user.email ?? email,
                businessName: nextBusinessName || "My Business",
                planId,
              });
              writeLocalAccount(account);
              setIsSubmitting(false);
              router.push("/dashboard");
              return;
            }
          }
        }
      } catch (caught) {
        const raw = caught instanceof Error ? caught.message : "";
        setError(humaniseAuthError(raw));
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    writePendingIdentity({
      name: mode === "signin" ? nextName || "Returning user" : nextName,
      email,
      businessName:
        mode === "signin" ? nextBusinessName || "Demo business" : nextBusinessName,
    });
    router.push("/onboarding");
  }

  return (
    <main
      className="min-h-screen px-4 py-10 relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Top brand bar */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="zn-brand-mark">Z</span>
            <span className="flex flex-col leading-[1.1]">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">Zentra</span>
              <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
            </span>
          </Link>
          <Link href="/" className="text-[13px] underline-offset-2 hover:underline" style={{ color: "var(--zn-ink-3)" }}>
            ← Back to homepage
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Left: copy */}
          <section className="zn-card p-6 lg:p-8">
            <div
              className="size-10 rounded-lg inline-flex items-center justify-center mb-5"
              style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
            >
              <ShieldCheck className="size-5" />
            </div>
            <div className="zn-label !p-0 mb-2">Account access</div>
            <h1
              className="text-[34px] sm:text-[40px] tracking-[-0.015em] leading-[1.1] text-[#1d1813] dark:text-[#f0e8d5]"
              style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
            >
              {mode === "signup" ? "Start your free trial." : "Welcome back."}
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.65]" style={{ color: "var(--zn-ink-3)" }}>
              {mode === "signup"
                ? "14 days, no card required. Upload your own AR exports, draft and review messages, and export everything before the trial ends."
                : "Sign in to continue. We'll take you back into your workspace exactly where you left off."}
            </p>

            {mode === "signup" ? (
              <div className="mt-6 flex flex-col gap-2.5">
                {[
                  "Human approval before every send",
                  "Plain-English safety checks per invoice",
                  "Export your data anytime",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                    <ShieldCheck className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-safe)" }} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="mt-6 rounded-[10px] p-3 text-[12.5px]"
              style={{
                background: "var(--zn-surface-2)",
                border: "1px solid var(--zn-line-soft)",
                color: "var(--zn-ink-3)",
              }}
            >
              {mode === "signup"
                ? <>Just exploring? <Link href="/demo" className="underline underline-offset-2 text-[#1d1813] dark:text-[#f0e8d5] font-medium">Try the demo</Link> with sample data instead — no signup needed.</>
                : <>No account yet? <Link href="/login?mode=signup" className="underline underline-offset-2 text-[#1d1813] dark:text-[#f0e8d5] font-medium">Start a free 14-day trial</Link> — no card required.</>}
            </div>
          </section>

          {/* Right: form */}
          <section className="zn-card p-6 lg:p-8">
            <div className="flex items-center gap-1 mb-5 p-[3px] rounded-full" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)", width: "fit-content" }}>
              {(["signup", "signin"] as AuthMode[]).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(""); }}
                    className="zn-pill"
                    style={{
                      height: 28,
                      fontSize: 12,
                      padding: "0 14px",
                      background: active ? "var(--zn-ink)" : "transparent",
                      color: active ? "var(--zn-surface)" : "var(--zn-ink-2)",
                      border: 0,
                    }}
                  >
                    {m === "signup" ? "Create account" : "Sign in"}
                  </button>
                );
              })}
            </div>

            {/* UX-7: SSO buttons. Use providers Supabase commonly supports. */}
            <div className="flex flex-col gap-2 mb-4">
              <button
                type="button"
                onClick={() => signInWithOAuth("google")}
                className="zn-pill zn-pill-ghost w-full justify-center gap-2"
                style={{ height: 38, fontSize: 13 }}
              >
                <GoogleGlyph className="size-4" />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => signInWithOAuth("azure")}
                className="zn-pill zn-pill-ghost w-full justify-center gap-2"
                style={{ height: 38, fontSize: 13 }}
              >
                <MicrosoftGlyph className="size-4" />
                Continue with Microsoft
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
              <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>or use email</span>
              <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === "signup" ? (
                <>
                  <Field id="name" label="Your name" value={name} onChange={setName} placeholder="Full name" />
                  <Field id="business" label="Business name" value={businessName} onChange={setBusinessName} placeholder="Your business name" />
                </>
              ) : null}
              <Field
                id="email"
                label="Work email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@yourbusiness.co.uk"
              />
              <div>
                <Field
                  id="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder={mode === "signup" ? "At least 8 characters" : ""}
                />
                {mode === "signin" ? (
                  <ForgotPasswordRow
                    email={email}
                    onMessage={(msg, kind) => {
                      setError(msg);
                      setForgotKind(kind);
                    }}
                  />
                ) : null}
              </div>

              {error ? (
                <div
                  className="rounded-[10px] p-3 text-[12.5px]"
                  style={{
                    background: forgotKind === "ok"
                      ? "var(--zn-safe-soft)"
                      : "var(--zn-risk-soft)",
                    border: "1px solid transparent",
                    color: forgotKind === "ok"
                      ? "var(--zn-safe)"
                      : "var(--zn-risk)",
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="zn-pill mt-1 w-full justify-center"
                style={{ height: 40, fontSize: 14 }}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? mode === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "signup"
                    ? "Start free trial"
                    : "Sign in"}
                <ArrowRight className="size-4" />
              </button>

              {mode === "signup" ? (
                <p className="text-[11.5px] leading-[1.55]" style={{ color: "var(--zn-ink-3)" }}>
                  By starting a trial you agree to our{" "}
                  <a href="/terms" className="underline hover:no-underline" style={{ color: "var(--zn-ink-2)" }}>terms</a>.
                  {" "}We&apos;ll email you a confirmation link before the trial activates. Trials are limited to one per business email.
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

// Brand glyphs used in the SSO buttons. Inline SVG keeps bundle small
// and means we don't pull a separate icon library.
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium text-[#1d1813] dark:text-[#f0e8d5]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-[10px] border px-3 py-2.5 text-[13.5px] outline-none transition-colors focus:border-[#3d3428]"
        style={{
          background: "var(--zn-surface)",
          borderColor: "var(--zn-line)",
          color: "var(--zn-ink)",
        }}
      />
    </div>
  );
}

/**
 * Translate Supabase / network error strings into something a non-technical
 * UK bookkeeper can act on. Keeps the original message as a fallback so
 * legitimately new failure modes still surface.
 */
function humaniseAuthError(raw: string): string {
  const msg = raw.toLowerCase();

  // Supabase rejects email when the domain has no MX records / fails its
  // basic format check. Don't say "invalid" — bookkeepers will assume their
  // email IS fine. Nudge them to double-check.
  if (msg.includes("email") && (msg.includes("invalid") || msg.includes("not valid"))) {
    return "We couldn't verify that email. Double-check the spelling, or try a different address. If this is your real work email and you're sure it's correct, contact support.";
  }
  // Already-registered email
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  // Supabase / SMTP rate limit on confirmation emails
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "We're sending too many confirmation emails right now. Please wait a few minutes and try again.";
  }
  // Wrong password during sign-in
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "That email and password don't match. Check both, or reset your password.";
  }
  // Weak password
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("at least"))) {
    return "Pick a stronger password — at least 8 characters, mix of letters and numbers.";
  }
  // Network / unknown
  if (!raw.trim()) {
    return "Couldn't reach our auth service. Check your connection and try again.";
  }
  // Default — keep raw message but soften the framing
  return `Something went wrong: ${raw}. Try again or contact support.`;
}

// ── Forgot-password row ─────────────────────────────────────────────────────
// Replaces the inline button that swallowed Supabase errors silently
// (the user clicked, saw "we've sent a reset link", but nothing actually
// happened if the redirect URL wasn't allow-listed or Supabase rate-
// limited the call). Now we surface the real Supabase response — both
// successes and errors land in the parent's banner.

function ForgotPasswordRow({
  email,
  onMessage,
}: {
  email: string;
  onMessage: (msg: string, kind: "ok" | "err") => void;
}) {
  const [sending, setSending] = useState(false);

  async function handle() {
    if (!email.trim()) {
      onMessage("Enter your email above first, then click forgot password.", "err");
      return;
    }
    if (!hasSupabaseBrowserConfig()) {
      onMessage(
        "Password reset isn't available on this deployment (Supabase not configured). Contact support.",
        "err",
      );
      return;
    }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        // Show the real error so the user (and you) can debug — most
        // commonly: "Redirect URL not allowed" if Supabase Auth's
        // allow-list doesn't include the callback URL.
        onMessage(`Couldn't send reset link: ${error.message}`, "err");
        return;
      }
      onMessage(
        "Reset link sent. Check your inbox (and spam folder) — the link is valid for 1 hour.",
        "ok",
      );
    } catch (err) {
      onMessage(
        `Network error: ${err instanceof Error ? err.message : "unknown"}. Try again.`,
        "err",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-1.5 text-right">
      <button
        type="button"
        disabled={sending}
        onClick={handle}
        className="text-[12px] underline underline-offset-2 disabled:opacity-50"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {sending ? "Sending reset link…" : "Forgot password?"}
      </button>
    </div>
  );
}
