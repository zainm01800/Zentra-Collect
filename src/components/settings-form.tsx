"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { UpgradePromptModal } from "@/components/billing-gates";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { requirePlanAccess, toAccountState } from "@/lib/account/access";
import { incrementClientLedgerUsage } from "@/lib/account/usage";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { incrementUsage } from "@/lib/demo-auth";

export function SettingsForm() {
  const { account } = useLocalAccount();
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);

  function addClientLedger() {
    const access = requirePlanAccess(account, "add_client_ledger");
    if (!access.allowed) {
      setUpgradePrompt(
        access.reason ?? "Create an account before adding client ledgers.",
      );
      return;
    }
    if (account) {
      incrementClientLedgerUsage(toAccountState(account));
      incrementUsage("clientLedgers");
    }
    setUpgradePrompt(
      "Client ledger creation is enabled for this plan, but real multi-tenant setup is still stubbed in the MVP.",
    );
  }

  return (
    <form className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <UpgradePromptModal
        open={Boolean(upgradePrompt)}
        title="Client ledger access"
        description={upgradePrompt ?? ""}
        onClose={() => setUpgradePrompt(null)}
      />
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Business settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" defaultValue="Zentra Demo Studio" />
          <Field label="Sender name" defaultValue="Zain from Zentra Demo Studio" />
          <Field label="Reply-to email" defaultValue="accounts@example.co.uk" />
          <div className="space-y-2">
            <Label>Default tone</Label>
            <Select defaultValue="Neutral">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Friendly">Friendly</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="Firm">Firm</SelectItem>
                <SelectItem value="Final notice">Final notice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Payment terms" defaultValue="14 days" />
          <Field label="Default reminder schedule" defaultValue="3, 10, 24, 45 days overdue" />
          <div className="space-y-2 sm:col-span-2">
            <Label>Brand voice notes</Label>
            <Textarea
              defaultValue="Professional, calm, clear, and relationship-preserving. Avoid legal language unless reviewed."
              className="min-h-28"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Late fee language enabled</p>
              <p className="text-sm text-muted-foreground">
                Keep off until terms and statutory rules are confirmed.
              </p>
            </div>
            <Switch />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800">
              <Save className="size-4" />
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Client ledgers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add client ledgers on bookkeeper plans. Single-business plans stay
              focused on one company.
            </p>
            <Button type="button" variant="outline" className="w-full" onClick={addClientLedger}>
              Add client ledger
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Accounting connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Demo mode is active. CSV import is available now; accounting
              integrations are stubbed for a later production pass.
            </p>
            <Button type="button" variant="outline" className="w-full">
              Connect accounting system
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>AI status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              OpenAI runs server-side when <span className="font-mono">OPENAI_API_KEY</span>{" "}
              is present. Otherwise Zentra uses template drafts.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Stripe billing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Subscription billing is reserved for production setup.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={defaultValue} />
    </div>
  );
}
