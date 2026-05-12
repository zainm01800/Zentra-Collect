"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { writeEmailUiSettings, startArming, startDemoArming } from "@/lib/email/settings-store";

type Step = "risk" | "smtp" | "rules" | "confirm";

type Props = {
  open: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
};

type SmtpFields = {
  email: string;
  password: string;
  fromName: string;
};

type RulesFields = {
  sendHourUtc: number;
  sendDays: string;
  maxPerRun: number;
};

export function AutoSendModal({ open, onClose, isDemoMode = false }: Props) {
  const [step, setStep] = useState<Step>("risk");
  const [smtp, setSmtp] = useState<SmtpFields>({
    email: "",
    password: "",
    fromName: "Zentra Flow",
  });
  const [rules, setRules] = useState<RulesFields>({
    sendHourUtc: 9,
    sendDays: "1,2,3,4,5",
    maxPerRun: 5,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function reset() {
    setStep("risk");
    setSmtp({ email: "", password: "", fromName: "Zentra Flow" });
    setRules({ sendHourUtc: 9, sendDays: "1,2,3,4,5", maxPerRun: 5 });
    setTesting(false);
    setTestResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 1200));
        setTestResult({ ok: true });
      } else {
        const res = await fetch("/api/email/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: smtp.email,
            password: smtp.password,
            fromName: smtp.fromName,
          }),
        });
        const data = await res.json();
        setTestResult(data);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleConfirm() {
    if (!isDemoMode) {
      writeEmailUiSettings({
        connectedEmail: smtp.email,
        fromName: smtp.fromName,
        sendHourUtc: rules.sendHourUtc,
        sendDays: rules.sendDays,
        maxPerRun: rules.maxPerRun,
      });

      await fetch("/api/email/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "local",
          email: smtp.email,
          password: smtp.password,
          fromName: smtp.fromName,
          ...rules,
        }),
      }).catch(() => null);
    }

    if (isDemoMode) {
      startDemoArming();
    } else {
      startArming();
    }
    handleClose();
  }

  const dayLabels: Record<string, string> = {
    "1": "Mon",
    "2": "Tue",
    "3": "Wed",
    "4": "Thu",
    "5": "Fri",
    "6": "Sat",
    "0": "Sun",
  };

  function toggleDay(day: string) {
    const days = rules.sendDays ? rules.sendDays.split(",").filter(Boolean) : [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setRules({ ...rules, sendDays: next.sort().join(",") });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-send email setup</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
          {(["risk", "smtp", "rules", "confirm"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-medium ${
                  s === step
                    ? "bg-zinc-900 dark:bg-[#f0e8d5] text-white dark:text-[#1a1612]"
                    : "bg-zinc-100 dark:bg-[#28231c] text-zinc-400 dark:text-[#6a5f4e]"
                }`}
              >
                {i + 1}
              </span>
              {i < 3 && <ChevronRight className="size-3" />}
            </span>
          ))}
          <span className="ml-2 capitalize">{step}</span>
        </div>

        {step === "risk" && (
          <div className="space-y-4">
            {isDemoMode && (
              <div className="rounded-xl bg-zinc-100 dark:bg-[#28231c] border border-zinc-200 dark:border-[#2d2820] px-4 py-3 text-sm text-zinc-600 dark:text-[#8a7d69] flex items-start gap-2">
                <span className="font-semibold text-zinc-800 dark:text-[#d8ccb5] shrink-0">Demo mode.</span>
                <span>
                  No real emails will be sent. This walkthrough shows you exactly how auto-send
                  works — SMTP credentials are not saved and the send log is simulated.
                </span>
              </div>
            )}
            <div className="rounded-2xl border border-amber-200 dark:border-[#3d2a0a] bg-amber-50 dark:bg-[#221a08] p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-[#f0c060]">
                <AlertTriangle className="size-4" />
                {isDemoMode ? "How auto-send works" : "Important — read before enabling"}
              </div>
              <ul className="text-sm text-amber-800 dark:text-[#c8a040] space-y-1.5 list-disc pl-5">
                <li>Emails are sent automatically to your customers on a configured schedule.</li>
                <li>You must review your chase plan before enabling — auto-send acts on it as-is.</li>
                <li>
                  Only the AI-drafted message shown in the chase plan is sent. Review and edit
                  drafts first.
                </li>
                <li>Do not enable if your invoice data has not been reviewed recently.</li>
                <li>
                  There is a <strong>5-minute cancellation window</strong> after enabling —
                  you can abort before the first send fires.
                </li>
              </ul>
            </div>
            {!isDemoMode && (
              <p className="text-xs text-muted-foreground">
                Zentra Flow does not take responsibility for emails sent. You remain fully
                responsible for all outbound customer communications.
              </p>
            )}
            <Button className="w-full rounded-full" onClick={() => setStep("smtp")}>
              {isDemoMode ? "See how setup works" : "I understand — continue"}
            </Button>
          </div>
        )}

        {step === "smtp" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your email address and an <strong>app password</strong> (not your login
              password). Gmail and Outlook support app passwords in their security settings.
            </p>
            {isDemoMode && (
              <div className="rounded-xl bg-zinc-100 dark:bg-[#28231c] px-3 py-2 text-xs text-zinc-500 dark:text-[#8a7d69]">
                Demo mode — no real emails will be sent.
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="you@gmail.com"
                  value={smtp.email}
                  onChange={(e) => {
                    setSmtp({ ...smtp, email: e.target.value });
                    setTestResult(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>App password</Label>
                <Input
                  type="password"
                  placeholder="16-character app password"
                  value={smtp.password}
                  onChange={(e) => {
                    setSmtp({ ...smtp, password: e.target.value });
                    setTestResult(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Gmail:{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    myaccount.google.com/apppasswords
                  </a>
                  <br />
                  Outlook:{" "}
                  <a
                    href="https://account.microsoft.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    account.microsoft.com/security
                  </a>
                  {" "}→ Manage how I sign in → turn on Two-step verification → App passwords
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Display name (From)</Label>
                <Input
                  value={smtp.fromName}
                  onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                />
              </div>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${
                  testResult.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0" />
                )}
                {testResult.ok ? "Connection successful" : testResult.error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={handleTestConnection}
                disabled={testing || !smtp.email || !smtp.password}
              >
                {testing && <Loader2 className="size-3 mr-1.5 animate-spin" />}
                Test connection
              </Button>
              <Button
                className="flex-1 rounded-full"
                onClick={() => setStep("rules")}
                disabled={!smtp.email || !smtp.password || (!isDemoMode && !testResult?.ok)}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "rules" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set when and how many emails Zentra Flow will send automatically.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Send time (UTC hour)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={rules.sendHourUtc}
                  onChange={(e) =>
                    setRules({ ...rules, sendHourUtc: parseInt(e.target.value) || 9 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Hour 9 = 9am UTC. UK business hours: 8–17 (BST = UTC+1).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Send days</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {["1", "2", "3", "4", "5", "6", "0"].map((day) => {
                    const active = rules.sendDays.split(",").includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active
                            ? "bg-zinc-900 dark:bg-[#f0e8d5] text-white dark:text-[#1a1612] border-zinc-900 dark:border-transparent"
                            : "bg-white dark:bg-[#211d17] text-zinc-600 dark:text-[#8a7d69] border-zinc-200 dark:border-[#2d2820] hover:border-zinc-400 dark:hover:border-[#4a3f30]"
                        }`}
                      >
                        {dayLabels[day]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Max emails per run</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={rules.maxPerRun}
                  onChange={(e) =>
                    setRules({ ...rules, maxPerRun: parseInt(e.target.value) || 5 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Highest-priority invoices are sent first each run.
                </p>
              </div>
            </div>
            <Button
              className="w-full rounded-full"
              onClick={() => setStep("confirm")}
              disabled={!rules.sendDays}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-zinc-50 dark:bg-[#28231c] border border-zinc-200 dark:border-[#2d2820] p-4 space-y-2 text-sm">
              <div className="font-medium">Review your settings</div>
              <div className="text-muted-foreground space-y-1">
                <div>
                  <span className="text-zinc-900 dark:text-[#f0e8d5]">From:</span> {smtp.fromName} &lt;{smtp.email}&gt;
                </div>
                <div>
                  <span className="text-zinc-900 dark:text-[#f0e8d5]">Send time:</span> {rules.sendHourUtc}:00 UTC
                </div>
                <div>
                  <span className="text-zinc-900 dark:text-[#f0e8d5]">Days:</span>{" "}
                  {rules.sendDays
                    .split(",")
                    .map((d) => dayLabels[d])
                    .join(", ")}
                </div>
                <div>
                  <span className="text-zinc-900 dark:text-[#f0e8d5]">Max per run:</span> {rules.maxPerRun} emails
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-zinc-100 dark:bg-[#28231c] px-3 py-2 text-xs text-zinc-600 dark:text-[#8a7d69]">
              After clicking enable, there is a <strong>5-minute window</strong> to cancel
              before the first send is permitted.
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setStep("rules")}
              >
                Back
              </Button>
              <Button className="flex-1 rounded-full" onClick={handleConfirm}>
                Enable auto-send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
