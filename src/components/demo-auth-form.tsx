"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writePendingIdentity } from "@/lib/demo-auth";
import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";

type AuthMode = "signup" | "signin";

export function DemoAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("Alex Chen");
  const [businessName, setBusinessName] = useState("Acme Studio Ltd");
  const [email, setEmail] = useState("alex@acmestudio.co.uk");
  const [password, setPassword] = useState("demo-password");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabaseConfigured = hasSupabaseBrowserConfig();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Add an email and password to continue.");
      return;
    }

    if (mode === "signup" && (!name.trim() || !businessName.trim())) {
      setError("Add your name and business name so Zentra can set up your workspace.");
      return;
    }

    let nextName = name;
    let nextBusinessName = businessName;

    if (supabaseConfigured) {
      setIsSubmitting(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const redirectTo = `${window.location.origin}/auth/callback`;

        if (mode === "signup") {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                full_name: name,
                business_name: businessName,
              },
            },
          });
          if (signUpError) throw signUpError;
        } else {
          const { data, error: signInError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });
          if (signInError) throw signInError;
          const metadata = data.user?.user_metadata;
          if (metadata?.full_name && typeof metadata.full_name === "string") {
            nextName = metadata.full_name;
            setName(metadata.full_name);
          }
          if (
            metadata?.business_name &&
            typeof metadata.business_name === "string"
          ) {
            nextBusinessName = metadata.business_name;
            setBusinessName(metadata.business_name);
          }
        }
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Supabase authentication failed. Check your credentials and try again.";
        setError(message);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    writePendingIdentity({
      name: mode === "signin" ? nextName || "Returning user" : nextName,
      email,
      businessName:
        mode === "signin"
          ? nextBusinessName || "Demo business"
          : nextBusinessName,
    });
    router.push("/onboarding");
  }

  return (
    <main className="min-h-screen bg-[#fbf8f1] px-4 py-10 text-neutral-950">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-black/10 bg-white/70 p-6 shadow-sm lg:p-8">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Zentra Collect access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight lg:text-5xl">
            Choose the right way to test Zentra.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
            Create an account profile first, then choose demo, trial, or
            owner-approved beta access. The MVP stores this locally, so you can
            test the workflow before production auth is connected.
          </p>

          <div className="mt-8 space-y-6 text-sm text-neutral-700">
            <div className="flex items-start gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white border border-black/5 shadow-sm font-bold text-neutral-950">
                1
              </div>
              <div>
                <p className="font-bold text-neutral-950">Demo account</p>
                <p className="mt-1 leading-relaxed text-neutral-500">
                  Uses sample data only. Best for exploring the dashboard, ranked
                  chase plan, action drawer, and digest preview.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white border border-black/5 shadow-sm font-bold text-neutral-950">
                2
              </div>
              <div>
                <p className="font-bold text-neutral-950">Trial account</p>
                <p className="mt-1 leading-relaxed text-neutral-500">
                  Allows live invoice imports for 14 days with clear usage limits:
                  1 business, 100 active invoices, 2 imports, and 25 AI actions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white border border-black/5 shadow-sm font-bold text-neutral-950">
                3
              </div>
              <div>
                <p className="font-bold text-neutral-950">Founding beta</p>
                <p className="mt-1 leading-relaxed text-neutral-500">
                  Requires owner approval. Intended for early businesses and
                  bookkeepers who want to shape the product before launch.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-[2rem] border-black/10 bg-white/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl">
              {mode === "signup" ? "Create your account profile" : "Sign in"}
            </CardTitle>
            <p className="text-sm leading-6 text-neutral-600">
              {supabaseConfigured
                ? "Supabase auth is configured. Billing and owner approvals still need production wiring."
                : "This is a local MVP account. Production sign-in, password storage, billing, and owner approvals still need a backend."}
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid grid-cols-2 rounded-full border border-black/10 bg-[#fbf8f1] p-1">
                <button
                  type="button"
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    mode === "signup" ? "bg-neutral-950 text-white" : "text-neutral-600"
                  }`}
                  onClick={() => setMode("signup")}
                >
                  Create account
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    mode === "signin" ? "bg-neutral-950 text-white" : "text-neutral-600"
                  }`}
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </div>

              {mode === "signup" ? (
                <>
                  <Field id="name" label="Your name" value={name} onChange={setName} />
                  <Field
                    id="businessName"
                    label="Business name"
                    value={businessName}
                    onChange={setBusinessName}
                  />
                </>
              ) : null}

              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
              />

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <Button
                className="w-full rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Checking account..." : "Continue to account options"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border-black/10 bg-[#fbf8f1]"
      />
    </div>
  );
}
