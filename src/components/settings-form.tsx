"use client";

import { Save } from "lucide-react";
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

export function SettingsForm() {
  return (
    <form className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Business settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" defaultValue="CashPilot Demo Agency" />
          <Field label="Sender name" defaultValue="Zain from CashPilot Demo Agency" />
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
          <Button className="sm:col-span-2">
            <Save className="size-4" />
            Save settings
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Xero connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Demo mode is active. OAuth and invoice sync are stubbed in the Xero
              integration abstraction.
            </p>
            <Button type="button" variant="outline" className="w-full">
              Connect Xero
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
              is present. Otherwise CashPilot uses template reminders.
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
