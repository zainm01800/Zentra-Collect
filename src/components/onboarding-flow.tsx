"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createLocalAccount,
  readPendingIdentity,
  writeLocalAccount,
  writeOnboardingState,
  type OnboardingAccountType,
  type PendingIdentity,
} from "@/lib/demo-auth";
import type { PlanId } from "@/lib/billing/plans";

type Option = {
  type: OnboardingAccountType;
  planId: PlanId;
  title: string;
  eyebrow: string;
  description: string;
  cta: string;
  price?: React.ReactNode;
  limited?: string;
  icon: React.ReactNode;
  points: string[];
};

const fallbackIdentity: PendingIdentity = {
  name: "Alex Chen",
  email: "alex@acmestudio.co.uk",
  businessName: "Acme Studio Ltd",
  createdAt: new Date().toISOString(),
};

export function OnboardingFlow() {
  const router = useRouter();
  const initialIdentity =
    typeof window === "undefined" ? fallbackIdentity : readPendingIdentity() ?? fallbackIdentity;
  const [identity] = useState<PendingIdentity>(initialIdentity);
  const [businessName, setBusinessName] = useState(initialIdentity.businessName);
  const [accountingSoftware] = useState("Xero");
  const [monthlyInvoiceVolume] = useState("51-100");
  const [mainArPainPoint] = useState("overdue invoices");
  const [selectedType, setSelectedType] = useState<OnboardingAccountType>("trial");
  const [error, setError] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingOption, setPendingOption] = useState<Option | null>(null);

  const options = useMemo<Option[]>(
    () => [
      {
        type: "demo",
        planId: "demo",
        title: "Explore demo",
        eyebrow: "Sample data",
        description:
          "Sample data only, immediate access.",
        cta: "Explore demo",
        icon: <Clock3 className="size-5" />,
        points: [
          "No real data required",
          "Dashboard, chase plan, drawer, and digest preview",
          "3 sample AI drafts",
        ],
      },
      {
        type: "trial",
        planId: "trial",
        title: "Start 14-day trial",
        eyebrow: "No card required",
        description:
          "No card required. Upload your own AR ageing file.",
        cta: "Start 14-day trial",
        icon: <FileSpreadsheet className="size-5" />,
        points: [
          "1 business",
          "100 active invoices",
          "2 imports",
          "25 AI actions",
        ],
      },
      {
        type: "founding_single_business",
        planId: "founding_single_business",
        title: "Paid plans",
        eyebrow: "From \u00A324/mo",
        description: "Starter Solo, Business, and Bookkeeper plans \u2014 pick what fits.",
        cta: "See pricing",
        icon: <Building2 className="size-5" />,
        points: [
          "Unlimited imports",
          "Unlimited AI actions",
          "Auto-send email",
          "No usage caps",
        ],
      },
    ],
    [],
  );

  function persistOnboarding(option: Option) {
    const now = new Date().toISOString();
    writeOnboardingState({
      selectedAccountType: option.type,
      selectedPlan: option.planId,
      trialStartedAt: option.type === "trial" ? now : undefined,
      businessName: businessName.trim() || identity.businessName,
      isBookkeeper: false,
      accountingSoftware,
      monthlyInvoiceVolume,
      mainArPainPoint,
    });
  }


  async function chooseOption(option: Option) {
    setError("");
    if (!businessName.trim()) {
      setError("Add a business name before choosing an account type.");
      return;
    }

    persistOnboarding(option);

    if (option.type === "demo") {
      router.push("/demo");
      return;
    }

    if (option.type === "founding_single_business") {
      router.push("/#pricing");
      return;
    }

    if (option.type === "trial") {
      // If Supabase is configured, send OTP to verify email and create a real account.
      if (hasSupabaseBrowserConfig()) {
        setOtpLoading(true);
        setPendingOption(option);
        try {
          const supabase = createSupabaseBrowserClient();
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: identity.email,
            options: { shouldCreateUser: true },
          });
          if (otpError) throw otpError;
          setOtpEmail(identity.email);
          setOtpStep(true);
        } catch {
          // Fall back to localStorage-only trial if OTP fails
          const account = createLocalAccount({ name: identity.name, email: identity.email, businessName, planId: option.planId });
          writeLocalAccount(account);
          router.push("/import");
        } finally {
          setOtpLoading(false);
        }
        return;
      }
      // No Supabase — localStorage-only trial
      const account = createLocalAccount({
        name: identity.name,
        email: identity.email,
        businessName,
        planId: option.planId,
      });
      writeLocalAccount(account);
      router.push("/import");
      return;
    }

    router.push("/#pricing");
  }

  async function verifyOtp() {
    if (!pendingOption || otpCode.length < 6) return;
    setOtpLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode,
        type: "email",
      });
      if (verifyError) throw verifyError;
      // Create localStorage account so existing UI works immediately
      const account = createLocalAccount({
        name: identity.name,
        email: identity.email,
        businessName,
        planId: pendingOption.planId,
      });
      writeLocalAccount(account);
      router.push("/import");
    } catch {
      setError("That code didn't match — check your email and try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  // ── OTP verification screen ──────────────────────────────────────────────
  if (otpStep) {
    return (
      <main className="min-h-screen bg-[#fbf8f1] dark:bg-[#211d17] flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-sm text-[#6b6253] dark:text-[#8a7d69]">
              We sent a 6-digit code to <strong>{otpEmail}</strong>. Enter it below to verify your account.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.5em] font-mono"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              className="w-full rounded-full"
              onClick={verifyOtp}
              disabled={otpCode.length < 6 || otpLoading}
            >
              {otpLoading ? "Verifying…" : "Verify & start trial"}
            </Button>
            <button
              className="w-full text-sm text-[#6b6253] dark:text-[#8a7d69] hover:text-[#1d1813] dark:text-[#f0e8d5]"
              onClick={async () => {
                const supabase = createSupabaseBrowserClient();
                await supabase.auth.signInWithOtp({ email: otpEmail, options: { shouldCreateUser: true } });
              }}
            >
              Resend code
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf8f1] dark:bg-[#211d17] px-4 py-10 text-neutral-950 dark:text-[#f0e8d5]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 rounded-[2rem] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#8a7d69]">
              Account setup
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight lg:text-5xl">
              How do you want to start?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-[#8a7d69]">
              Demo gives you instant access with sample data. Trial lets you
              upload your own exports. Paid plans unlock everything with no
              usage caps.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="rounded-2xl border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]"
              />
            </div>
            <div className="space-y-2 hidden">
              <Label>Placeholder</Label>
              <Select value={accountingSoftware}>
                <SelectTrigger className="rounded-2xl border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Xero">Xero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {options.map((option) => (
            <Card
              key={option.type}
              className={`rounded-[1.75rem] border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#28231c] shadow-sm transition ${
                selectedType === option.type ? "ring-2 ring-neutral-950" : ""
              }`}
              onMouseEnter={() => setSelectedType(option.type)}
            >
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fbf8f1] dark:bg-[#211d17] text-neutral-950 dark:text-[#f0e8d5]">
                    {option.icon}
                  </div>
                  {option.limited ? (
                    <span className="rounded-full border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] px-3 py-1 text-xs font-medium text-neutral-600 dark:text-[#8a7d69]">
                      {option.limited}
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-[#8a7d69]">
                  {option.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {option.title}
                </h2>
                {option.price ? (
                  <p className="mt-2 text-3xl font-semibold">{option.price}</p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
                  {option.description}
                </p>

                <ul className="mt-5 space-y-3 text-sm text-neutral-700 dark:text-[#d8ccb5]">
                  {option.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neutral-950 dark:text-[#f0e8d5]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-auto w-full rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                  onClick={() => chooseOption(option)}
                >
                  {option.cta}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
