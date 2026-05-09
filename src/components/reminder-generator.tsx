"use client";

import { Copy, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Tone of voice</Label>
          <p className="mt-1 text-xs font-medium text-neutral-500">
            Automatically matched to customer pattern. You stay in control.
          </p>
        </div>
        <ToneSelector value={tone} onChange={changeTone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReminderSwitch
          label="Previous reminder"
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
          label="Warm relationship"
          checked={options.keepRelationshipWarm}
          onCheckedChange={(checked) => updateOption("keepRelationshipWarm", checked)}
        />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-900">
        <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
        Drafts avoid aggressive threats and prioritize warm client relations.
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-rose-100 bg-rose-50 text-rose-900">
          <AlertTitle className="text-sm font-black uppercase tracking-widest">Generation failed</AlertTitle>
          <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6 rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="subject" className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Subject line</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-11 rounded-xl border-black/5 bg-neutral-50 px-4 text-sm font-bold shadow-none transition-all focus-visible:bg-white focus-visible:shadow-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body" className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Email content</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-[350px] resize-none rounded-2xl border-black/5 bg-neutral-50 p-4 text-sm font-medium leading-relaxed shadow-none transition-all focus-visible:bg-white focus-visible:shadow-xl"
          />
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button 
            className="h-12 flex-1 rounded-full bg-neutral-950 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            onClick={generateReminder} 
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {loading ? "Polishing..." : "AI Improve Draft"}
          </Button>
          <Button 
            variant="outline" 
            className="h-12 rounded-full border-black/5 bg-white px-8 text-xs font-black uppercase tracking-widest text-neutral-500 transition-all hover:bg-neutral-50 hover:text-neutral-950"
            onClick={copyEmail}
          >
            <Copy className="mr-2 size-4" />
            Copy Email
          </Button>
        </div>
        
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Source: {source === "openai" ? "Zentra AI (Pro)" : "Smart Template"}
        </p>
      </div>
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
    <label className="group flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-neutral-50/50 px-4 py-3 transition-all hover:bg-white hover:shadow-md cursor-pointer">
      <span className="text-xs font-bold text-neutral-600 transition-colors group-hover:text-neutral-950">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-neutral-950" />
    </label>
  );
}
