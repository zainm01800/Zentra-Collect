"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  betaAccessCode,
  betaRequestStorageKey,
  betaRequestsStorageKey,
  createLocalAccount,
  ownerEmail,
  readOnboardingState,
  readPendingIdentity,
  writeLocalAccount,
  type BetaAccessRequest,
  type OnboardingState,
} from "@/lib/demo-auth";

function readBetaRequest() {
  if (typeof window === "undefined") return null;
  const rawRequest = window.localStorage.getItem(betaRequestStorageKey);
  if (!rawRequest) return null;
  try {
    return JSON.parse(rawRequest) as BetaAccessRequest;
  } catch {
    window.localStorage.removeItem(betaRequestStorageKey);
    return null;
  }
}

function saveBetaRequest(request: BetaAccessRequest) {
  window.localStorage.setItem(betaRequestStorageKey, JSON.stringify(request));
  const stored = window.localStorage.getItem(betaRequestsStorageKey);
  let requests: BetaAccessRequest[] = [];
  if (stored) {
    try {
      requests = JSON.parse(stored) as BetaAccessRequest[];
    } catch {
      requests = [];
    }
  }
  requests = [request, ...requests.filter((item) => item.email !== request.email)];
  window.localStorage.setItem(betaRequestsStorageKey, JSON.stringify(requests));
}

export function BetaRequestConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pending = readPendingIdentity();
  const initialRequest = readBetaRequest();
  const [request, setRequest] = useState<BetaAccessRequest | null>(initialRequest);
  const [onboarding] = useState<OnboardingState | null>(() => readOnboardingState());
  const [name, setName] = useState(initialRequest?.name ?? pending?.name ?? "");
  const [email, setEmail] = useState(initialRequest?.email ?? pending?.email ?? "");
  const [businessName, setBusinessName] = useState(
    initialRequest?.businessName ?? pending?.businessName ?? "",
  );
  const [isBookkeeper, setIsBookkeeper] = useState(
    initialRequest?.isBookkeeper ?? searchParams.get("type") === "bookkeeper",
  );
  const [clientCountEstimate, setClientCountEstimate] = useState(
    initialRequest?.clientCountEstimate ?? onboarding?.clientCountEstimate ?? 1,
  );
  const [accountingSoftware, setAccountingSoftware] = useState(
    initialRequest?.accountingSoftware ?? "Xero",
  );
  const [monthlyInvoiceVolume, setMonthlyInvoiceVolume] = useState(
    initialRequest?.monthlyInvoiceVolume ?? "51-100",
  );
  const [mainArPainPoint, setMainArPainPoint] = useState(
    initialRequest?.mainArPainPoint ?? "overdue invoices",
  );
  const [wouldUploadSampleFile, setWouldUploadSampleFile] = useState(
    initialRequest?.wouldUploadSampleFile ?? "yes",
  );
  const [wouldPayFoundingPricing, setWouldPayFoundingPricing] = useState(
    initialRequest?.wouldPayFoundingPricing ?? "maybe",
  );
  const [optionalMessage, setOptionalMessage] = useState(
    initialRequest?.optionalMessage ?? "",
  );
  const [approvalCode, setApprovalCode] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(initialRequest));

  const mailto = useMemo(() => {
    const body = encodeURIComponent(
      [
        "Hi,",
        "",
        "Please review this Zentra Collect beta access request.",
        "",
        `Name: ${request?.name ?? name}`,
        `Email: ${request?.email ?? email}`,
        `Business: ${request?.businessName ?? businessName}`,
        `Requested plan: ${isBookkeeper ? "Bookkeeper Starter" : "Single Business"}`,
        `Bookkeeper/accountant: ${isBookkeeper ? "Yes" : "No"}`,
        `Client ledgers: ${clientCountEstimate}`,
        `Accounting software: ${accountingSoftware}`,
        `Monthly invoice volume: ${monthlyInvoiceVolume}`,
        `Main AR pain: ${mainArPainPoint}`,
        `Would upload sample AR ageing file: ${wouldUploadSampleFile}`,
        `Would pay founding pricing if useful: ${wouldPayFoundingPricing}`,
        `Message: ${optionalMessage || "None"}`,
        "",
        "If approved, please send the beta access code.",
      ].join("\n"),
    );
    return `mailto:${ownerEmail}?subject=${encodeURIComponent(
      "Zentra Collect beta access request",
    )}&body=${body}`;
  }, [
    accountingSoftware,
    businessName,
    clientCountEstimate,
    email,
    isBookkeeper,
    mainArPainPoint,
    monthlyInvoiceVolume,
    name,
    optionalMessage,
    request,
    wouldPayFoundingPricing,
    wouldUploadSampleFile,
  ]);

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !businessName.trim()) {
      setError("Add your name, email, and business name before submitting.");
      return;
    }

    const nextRequest: BetaAccessRequest = {
      name: name.trim(),
      email: email.trim(),
      businessName: businessName.trim(),
      role: isBookkeeper ? "Bookkeeper / accountant" : "Single business owner",
      reason: `${mainArPainPoint}. Uses ${accountingSoftware}. ${optionalMessage}`.trim(),
      isBookkeeper,
      clientCountEstimate: isBookkeeper ? clientCountEstimate : undefined,
      accountingSoftware,
      monthlyInvoiceVolume,
      mainArPainPoint,
      wouldUploadSampleFile,
      wouldPayFoundingPricing,
      optionalMessage,
      requestedAt: new Date().toISOString(),
      status: "pending",
    };
    saveBetaRequest(nextRequest);
    setRequest(nextRequest);
    setSubmitted(true);
  }

  function unlockApprovedBeta() {
    setError("");
    if (approvalCode.trim() !== betaAccessCode) {
      setError("That approval code is not valid. Ask the owner for permission first.");
      return;
    }

    const selectedPlan = isBookkeeper
      ? "bookkeeper_starter"
      : "single_business";
    const account = createLocalAccount({
      name: request?.name ?? name,
      email: request?.email ?? email,
      businessName: request?.businessName ?? businessName,
      planId: selectedPlan,
    });
    writeLocalAccount(account);
    router.push(selectedPlan === "bookkeeper_starter" ? "/portfolio" : "/dashboard");
  }

  function openDemoWhileWaiting() {
    const account = createLocalAccount({
      name: (request?.name ?? name) || "Demo user",
      email: (request?.email ?? email) || "demo@example.co.uk",
      businessName: (request?.businessName ?? businessName) || "Demo business",
      planId: "demo",
    });
    writeLocalAccount(account);
    router.push(isBookkeeper ? "/portfolio" : "/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#fbf8f1] dark:bg-[#211d17] px-4 py-10 text-neutral-950 dark:text-[#f0e8d5]">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-6 shadow-sm lg:p-8">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-white">
            <LockKeyhole className="size-5" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#8a7d69]">
            Request founding access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Tell us where AR gets messy.
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-600 dark:text-[#8a7d69]">
            Founding access is limited while Zentra Collect is in beta. We use
            this request to prioritise serious early users and bookkeepers.
          </p>
          <div className="mt-8 grid gap-3">
            <PriceCard title="Single Business" price={"\u00A359/month"} detail="One business, 500 active invoices, 200 AI actions/month." />
            <PriceCard title="Bookkeeper Starter" price={"\u00A3119/month"} detail="Up to 5 client ledgers, 2,000 active invoices, portfolio view." />
          </div>
          <p className="mt-6 text-xs leading-5 text-neutral-500 dark:text-[#8a7d69]">
            TODO: replace local request storage with Supabase, a beta_requests
            table, and an owner email notification before production.
          </p>
        </section>

        <Card className="rounded-[2rem] border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#28231c] shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl">
              {submitted ? "Thanks - request received" : "Request founding access"}
            </CardTitle>
            <p className="text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
              {submitted
                ? "Thanks - we'll review your request and contact you about early access."
                : "A few quick details help us understand whether Zentra is a good fit."}
            </p>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <ConfirmationPanel
                request={request}
                isBookkeeper={isBookkeeper}
                mailto={mailto}
                approvalCode={approvalCode}
                setApprovalCode={setApprovalCode}
                unlockApprovedBeta={unlockApprovedBeta}
                openDemoWhileWaiting={openDemoWhileWaiting}
                error={error}
              />
            ) : (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitRequest}>
                <Field id="name" label="Name" value={name} onChange={setName} />
                <Field id="email" label="Email" type="email" value={email} onChange={setEmail} />
                <Field
                  id="businessName"
                  label="Business name"
                  value={businessName}
                  onChange={setBusinessName}
                />
                <SelectField
                  label="Are you a bookkeeper/accountant?"
                  value={isBookkeeper ? "yes" : "no"}
                  onChange={(value) => setIsBookkeeper(value === "yes")}
                  options={["yes", "no"]}
                />
                <Field
                  id="clientCountEstimate"
                  label="Client ledgers managed"
                  type="number"
                  value={String(clientCountEstimate)}
                  onChange={(value) => setClientCountEstimate(Number(value) || 0)}
                />
                <SelectField
                  label="Accounting software used"
                  value={accountingSoftware}
                  onChange={setAccountingSoftware}
                  options={["Xero", "QuickBooks", "FreeAgent", "Sage", "Stripe", "Excel/other"]}
                />
                <SelectField
                  label="Approx invoices per month"
                  value={monthlyInvoiceVolume}
                  onChange={setMonthlyInvoiceVolume}
                  options={["1-25", "26-50", "51-100", "101-250", "250+"]}
                />
                <SelectField
                  label="Biggest AR pain"
                  value={mainArPainPoint}
                  onChange={setMainArPainPoint}
                  options={[
                    "overdue invoices",
                    "missed promises",
                    "disputes",
                    "remittance matching",
                    "statement requests",
                    "messy client files",
                    "not enough time",
                  ]}
                />
                <SelectField
                  label="Would you upload a sample AR ageing file?"
                  value={wouldUploadSampleFile}
                  onChange={setWouldUploadSampleFile}
                  options={["yes", "no"]}
                />
                <SelectField
                  label="Would you pay founding pricing if useful?"
                  value={wouldPayFoundingPricing}
                  onChange={setWouldPayFoundingPricing}
                  options={["yes", "maybe", "no"]}
                />
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="optionalMessage">Optional message</Label>
                  <Textarea
                    id="optionalMessage"
                    value={optionalMessage}
                    onChange={(event) => setOptionalMessage(event.target.value)}
                    className="min-h-28 rounded-2xl border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]"
                    placeholder="Anything useful about your current collections process?"
                  />
                </div>
                {error ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
                    {error}
                  </p>
                ) : null}
                <Button className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800 sm:col-span-2">
                  Submit request
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ConfirmationPanel({
  request,
  isBookkeeper,
  mailto,
  approvalCode,
  setApprovalCode,
  unlockApprovedBeta,
  openDemoWhileWaiting,
  error,
}: {
  request: BetaAccessRequest | null;
  isBookkeeper: boolean;
  mailto: string;
  approvalCode: string;
  setApprovalCode: (value: string) => void;
  unlockApprovedBeta: () => void;
  openDemoWhileWaiting: () => void;
  error: string;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4" />
          Thanks - we&apos;ll review your request and contact you about early access.
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <SummaryItem label="Name" value={request?.name} />
          <SummaryItem label="Business" value={request?.businessName} />
          <SummaryItem
            label="Plan"
            value={isBookkeeper ? "Bookkeeper beta" : "Single Business beta"}
          />
          <SummaryItem label="Accounting software" value={request?.accountingSoftware} />
          <SummaryItem label="Monthly invoices" value={request?.monthlyInvoiceVolume} />
          <SummaryItem label="Biggest AR pain" value={request?.mainArPainPoint} />
        </dl>
      </div>

      <Button asChild className="w-full rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
        <a href={mailto}>
          <Mail className="size-4" />
          Email owner for approval
        </a>
      </Button>

      <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-5">
        <Label htmlFor="approvalCode">Owner approval code</Label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Input
            id="approvalCode"
            value={approvalCode}
            onChange={(event) => setApprovalCode(event.target.value)}
            className="rounded-2xl border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17]"
            placeholder="Enter approval code"
          />
          <Button
            type="button"
            className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
            onClick={unlockApprovedBeta}
          >
            Open beta
            <ArrowRight className="size-4" />
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full border-black/10 dark:border-white/10 bg-transparent"
        onClick={openDemoWhileWaiting}
      >
        View demo while waiting
      </Button>
    </div>
  );
}

function PriceCard({
  title,
  price,
  detail,
}: {
  title: string;
  price: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{price}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">{detail}</p>
    </div>
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
        className="rounded-2xl border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full rounded-2xl border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <dt className="text-emerald-700">{label}</dt>
      <dd className="font-medium">{value || "Not provided"}</dd>
    </div>
  );
}
