"use client";

import { Copy, Loader2, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { ToneSelector } from "@/components/tone-selector";
import { generateTemplateReminder } from "@/lib/reminders";
import { getRecommendedTone } from "@/lib/invoice-logic";
import type {
  Invoice,
  InvoiceStatus,
  ReminderOptions,
  ReminderTone,
} from "@/types/cashpilot";

export function ReminderGenerator({
  invoice,
  onStatusChange,
}: {
  invoice: Invoice;
  onStatusChange: (status: InvoiceStatus, title: string, description: string) => void;
}) {
  const initialTone = getRecommendedTone(invoice);
  const defaultOptions: ReminderOptions = {
    mentionPreviousReminder: true,
    askForPaymentDate: true,
    includePaymentLink: true,
    avoidLateFeeWording: true,
    keepRelationshipWarm: true,
  };
  const initialReminder = generateTemplateReminder(invoice, initialTone, defaultOptions);
  const [tone, setTone] = useState<ReminderTone>(initialTone);
  const [options, setOptions] = useState<ReminderOptions>(defaultOptions);
  const [subject, setSubject] = useState(initialReminder.subject);
  const [body, setBody] = useState(initialReminder.body);
  const [source, setSource] = useState<"openai" | "template" | null>("template");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeTone(nextTone: ReminderTone) {
    const reminder = generateTemplateReminder(invoice, nextTone, options);
    setTone(nextTone);
    setSubject(reminder.subject);
    setBody(reminder.body);
    setSource("template");
  }

  function updateOption(key: keyof ReminderOptions, value: boolean) {
    const nextOptions = { ...options, [key]: value };
    const reminder = generateTemplateReminder(invoice, tone, nextOptions);
    setOptions(nextOptions);
    setSubject(reminder.subject);
    setBody(reminder.body);
    setSource("template");
  }

  async function generateReminder() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice, tone, options }),
      });

      if (!response.ok) throw new Error("Unable to generate reminder.");
      const data = (await response.json()) as {
        subject: string;
        body: string;
        source: "openai" | "template";
      };

      setSubject(data.subject);
      setBody(data.body);
      setSource(data.source);
      onStatusChange(
        "Reminder drafted",
        `${tone} reminder drafted`,
        `Draft generated using ${data.source === "openai" ? "OpenAI" : "template"} mode.`,
      );
    } catch {
      setError("Could not generate a new reminder. The template draft is still available.");
    } finally {
      setLoading(false);
    }
  }

  async function copyEmail() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div>
          <Label>Tone</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Recommended from days overdue and customer status. You stay in control.
          </p>
        </div>
        <ToneSelector value={tone} onChange={changeTone} />
      </div>

      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
        <ReminderSwitch
          label="Mention previous reminder"
          checked={options.mentionPreviousReminder}
          onCheckedChange={(checked) =>
            updateOption("mentionPreviousReminder", checked)
          }
        />
        <ReminderSwitch
          label="Ask for payment date"
          checked={options.askForPaymentDate}
          onCheckedChange={(checked) => updateOption("askForPaymentDate", checked)}
        />
        <ReminderSwitch
          label="Include payment link"
          checked={options.includePaymentLink}
          onCheckedChange={(checked) => updateOption("includePaymentLink", checked)}
        />
        <ReminderSwitch
          label="Keep relationship warm"
          checked={options.keepRelationshipWarm}
          onCheckedChange={(checked) => updateOption("keepRelationshipWarm", checked)}
        />
      </div>

      <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Drafts are review-first. CashPilot avoids aggressive legal threats and
        keeps late-fee wording out unless you deliberately add it.
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Email body</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-72 resize-y"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={generateReminder} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Improve draft
        </Button>
        <Button variant="outline" onClick={copyEmail}>
          <Copy className="size-4" />
          Copy email
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Draft source: {source === "openai" ? "OpenAI" : "template fallback"}.
        Review before sending.
      </p>
    </div>
  );
}

function ReminderSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
