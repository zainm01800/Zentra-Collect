"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { writePendingIdentity } from "@/lib/demo-auth";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";
import { isDisposableEmailDomain } from "@/lib/anti-abuse";

type AuthMode = "signup" | "signin";

export function DemoAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: AuthMode = searchParams?.get("mode") === "signin" ? "signin" : "signup";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseConfigured = hasSupabaseBrowserConfig();

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
          // Sign-in: authenticate then go straight to dashboard.
          // AccountSync will pull the real plan from Supabase on mount.
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;
          const metadata = data.user?.user_metadata;
          nextName = (metadata?.full_name as string | undefined) || nextName;
          nextBusinessName = (metadata?.business_name as string | undefined) || nextBusinessName;
          writePendingIdentity({
            name: nextName || "Returning user",
            email,
            businessName: nextBusinessName || "",
          });
          router.push("/dashboard");
          return;
        }
      } catch (caught) {
        const raw = caught instanceof Error ? caught.message : "";
        setError(humaniseAuthError(raw));
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    // Sign-up path: go to onboarding to pick a plan
    writePendingIdentity({
      name: nextName,
      email,
      businessName: nextBusinessName,
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
              <span className="zn-section-label !p-0 !mt-0.5">Flow</span>
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
              className="text-[34px] sm:text-[40px] tracking-[-0.015em] leading-[1.1] text-[#1d1813]"
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
                ? <>Just exploring? <Link href="/demo" className="underline underline-offset-2 text-[#1d1813] font-medium">Try the demo</Link> with sample data instead — no signup needed.</>
                : <>No account yet? <Link href="/login?mode=signup" className="underline underline-offset-2 text-[#1d1813] font-medium">Start a free 14-day trial</Link> — no card required.</>}
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

            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === "signup" ? (
                <>
                  <Field id="name" label="Your name" value={name} onChange={setName} placeholder="Jane Smith" />
                  <Field id="business" label="Business name" value={businessName} onChange={setBusinessName} placeholder="Acme Studio Ltd" />
                </>
              ) : null}
              <Field
                id="email"
                label="Work email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="jane@acmestudio.co.uk"
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
                  <div className="mt-1.5 text-right">
                    <button
                      type="button"
                      className="text-[12px] underline underline-offset-2"
                      style={{ color: "var(--zn-ink-3)" }}
                      onClick={async () => {
                        if (!email.trim()) {
                          setError("Enter your email above first, then click forgot password.");
                          return;
                        }
                        setError("");
                        if (hasSupabaseBrowserConfig()) {
                          const supabase = createSupabaseBrowserClient();
                          await supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
                          });
                        }
                        setError("If that email exists, we've sent a reset link. Check your inbox.");
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div
                  className="rounded-[10px] p-3 text-[12.5px]"
                  style={{
                    background: "var(--zn-risk-soft)",
                    border: "1px solid var(--zn-risk-soft)",
                    color: "var(--zn-risk)",
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
                  By starting a trial you agree to our terms. We&apos;ll email you a confirmation link before the trial activates. Trials are limited to one per business email.
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </main>
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
      <label htmlFor={id} className="text-[12.5px] font-medium text-[#1d1813]">
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
