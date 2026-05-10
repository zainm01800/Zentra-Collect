"use client";

import { Mail, Save, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { UpgradePromptModal } from "@/components/billing-gates";
import { AutoSendModal } from "@/components/auto-send-modal";
import { EmailAddonUpgradeModal } from "@/components/email-addon-upgrade-modal";
import { AutoSendDemoLog } from "@/components/auto-send-demo-log";
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
import {
  readEmailUiSettings,
  disableAutoSend,
  isArmingCountdownActive,
  getDemoPhase,
  disableDemoAutoSend,
} from "@/lib/email/settings-store";
import { getPlanConfig } from "@/lib/account/plans";

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
            <Button className="rounded-full bg-[#1d1813] px-5 text-white hover:bg-[#3d3428]">
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
        <EmailSettingsCard />
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

function EmailSettingsCard() {
  const { account, user } = useLocalAccount();
  const [modalOpen, setModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isArming, setIsArming] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  const isDemoMode = account?.planId === "demo";

  function sync() {
    if (isDemoMode) {
      const phase = getDemoPhase();
      setIsEnabled(phase === "on");
      setIsArming(phase === "arming");
    } else {
      const s = readEmailUiSettings();
      setIsEnabled(s.isEnabled);
      setIsArming(isArmingCountdownActive());
      setConnectedEmail(s.connectedEmail);
    }
  }

  useEffect(() => {
    sync();
    window.addEventListener("zentra:emailSettingsChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("zentra:emailSettingsChanged", sync);
      window.removeEventListener("storage", sync);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  // Derive access tier
  type AccessTier = "none" | "addon-upgrade" | "full";
  let accessTier: AccessTier = "none";

  if (isDemoMode) {
    accessTier = "full";
  } else if (account) {
    try {
      const state = toAccountState(account as Parameters<typeof toAccountState>[0]);
      const features = getPlanConfig(state.planId).features;
      if (features.emailSending) {
        accessTier = "full";
      } else if (features.emailSendingAddon) {
        accessTier = user?.emailAddon ? "full" : "addon-upgrade";
      }
    } catch {
      accessTier = "none";
    }
  }

  let centralPlanId: Parameters<typeof EmailAddonUpgradeModal>[0]["planId"] | undefined;
  if (account) {
    try {
      centralPlanId = toAccountState(account as Parameters<typeof toAccountState>[0]).planId;
    } catch { /* */ }
  }

  const status = isEnabled ? "on" : isArming ? "arming" : connectedEmail ? "configured" : "off";

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Email auto-send
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {accessTier === "none" && (
            <p className="text-sm text-muted-foreground">
              Auto-send email is included on all Bookkeeper plans and available as an add-on on
              Starter and Single Business.{" "}
              <a href="mailto:hello@zentracollect.co.uk" className="underline">
                Contact us
              </a>{" "}
              to upgrade.
            </p>
          )}

          {accessTier === "addon-upgrade" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your plan supports email auto-send as an add-on. Add it to start sending
                automated chase emails on a schedule.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => setUpgradeOpen(true)}
              >
                <Zap className="size-3.5" />
                Add email auto-send
              </Button>
            </div>
          )}

          {accessTier === "full" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                {status === "on" ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : status === "arming" ? (
                  <AlertTriangle className="size-4 text-amber-500" />
                ) : (
                  <span className="size-4 rounded-full bg-zinc-200 inline-block" />
                )}
                <span className="text-muted-foreground">
                  {isDemoMode
                    ? status === "on"
                      ? "Demo active — simulated send log below"
                      : status === "arming"
                        ? "Demo arming — simulated countdown in progress"
                        : "Demo mode — no real emails sent"
                    : status === "on"
                      ? `Active — sending from ${connectedEmail}`
                      : status === "arming"
                        ? "Arming — 5-minute countdown in progress"
                        : connectedEmail
                          ? `Configured — ${connectedEmail} (not active)`
                          : "Not configured"}
                </span>
              </div>

              {!isDemoMode && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setModalOpen(true)}
                  >
                    {connectedEmail ? "Reconfigure" : "Set up auto-send"}
                  </Button>
                  {(isEnabled || isArming) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        disableAutoSend();
                        sync();
                        window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
                      }}
                    >
                      Disable
                    </Button>
                  )}
                </div>
              )}

              {isDemoMode && (isEnabled || isArming) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    disableDemoAutoSend();
                    sync();
                    window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
                  }}
                >
                  Disable demo auto-send
                </Button>
              )}

              <AutoSendDemoLog />
            </>
          )}
        </CardContent>
      </Card>

      <AutoSendModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          sync();
        }}
        isDemoMode={isDemoMode}
      />

      <EmailAddonUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        planId={centralPlanId}
      />
    </>
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
