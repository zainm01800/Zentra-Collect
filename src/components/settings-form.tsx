"use client";

import { Mail, Save, CheckCircle2, AlertTriangle, Zap, Eye, EyeOff } from "lucide-react";
import { NotificationToggle } from "@/components/push-permission";
import { useEffect, useState } from "react";
import { WorkspaceSetupCard } from "@/components/workspace-setup-card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export function SettingsForm({ defaultTab }: { defaultTab?: string }) {
  const { account } = useLocalAccount();
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);

  const validTabs = ["business", "workspace", "email", "system"];
  const initialTab = defaultTab && validTabs.includes(defaultTab) ? defaultTab : "business";

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
    <form className="space-y-0">
      <UpgradePromptModal
        open={Boolean(upgradePrompt)}
        title="Client ledger access"
        description={upgradePrompt ?? ""}
        onClose={() => setUpgradePrompt(null)}
      />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="mb-5 h-9 rounded-lg p-1 bg-muted w-full sm:w-auto">
          <TabsTrigger value="business"  className="rounded-md text-[13px] px-4">Business</TabsTrigger>
          <TabsTrigger value="workspace" className="rounded-md text-[13px] px-4">Workspace</TabsTrigger>
          <TabsTrigger value="email"     className="rounded-md text-[13px] px-4">Email</TabsTrigger>
          <TabsTrigger value="system"    className="rounded-md text-[13px] px-4">System</TabsTrigger>
        </TabsList>

        {/* ── Business tab ─────────────────────────────────────────────── */}
        <TabsContent value="business" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle>Business settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Field label="Business name"           defaultValue="Zentra Demo Studio" />
                <Field label="Sender name"             defaultValue="Zain from Zentra Demo Studio" />
                <Field label="Reply-to email"          defaultValue="accounts@yourbusiness.co.uk" />
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label>Payment terms</Label>
                  <Select defaultValue="14">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="21">21 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="45">45 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="receipt">On receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reminder schedule</Label>
                  <Select defaultValue="standard-extended">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gentle">Gentle — 7, 14, 30 days</SelectItem>
                      <SelectItem value="standard">Standard — 3, 10, 24 days</SelectItem>
                      <SelectItem value="standard-extended">Standard+ — 3, 10, 24, 45 days</SelectItem>
                      <SelectItem value="firm">Firm — 1, 5, 10, 21 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Brand voice notes</Label>
                  <Textarea
                    defaultValue="Professional, calm, clear, and relationship-preserving. Avoid legal language unless reviewed."
                    className="min-h-20 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Late fee language enabled</p>
                    <p className="text-xs text-muted-foreground">
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

            <div className="space-y-4">
              <Card className="rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle>Client ledgers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Add client ledgers on bookkeeper plans. Single-business plans stay focused on one company.
                  </p>
                  <Button type="button" variant="outline" className="w-full" onClick={addClientLedger}>
                    Add client ledger
                  </Button>
                </CardContent>
              </Card>
              <Card className="rounded-lg">
                <CardHeader className="pb-3">
                  <CardTitle>Accounting connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect Xero, QuickBooks, Sage, FreeAgent, or GoCardless to sync invoices automatically. CSV import still works.
                  </p>
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <a href="/settings/integrations">Open integrations</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Workspace tab ─────────────────────────────────────────────── */}
        <TabsContent value="workspace" className="mt-0">
          <WorkspaceSetupCard />
        </TabsContent>

        {/* ── Email tab ─────────────────────────────────────────────────── */}
        <TabsContent value="email" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-2">
            <OutboundEmailCard />
            <EmailSettingsCard />
          </div>
        </TabsContent>

        {/* ── System tab ────────────────────────────────────────────────── */}
        <TabsContent value="system" className="mt-0">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle>AI status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI drafting is active. Message suggestions are generated server-side and never sent automatically.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle>Stripe billing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Billing is managed securely via Stripe. To update your plan or payment details, contact support.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader className="pb-3">
                <CardTitle>Push notifications</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Get a morning digest and escalation alerts on this device — without opening the app.
                </p>
                <NotificationToggle />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Email auto-send
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {accessTier === "none" && (
            <p className="text-sm text-muted-foreground">
              Auto-send email is included on all Bookkeeper plans and available as an add-on on
              Starter and Business.{" "}
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
                  <span className="size-4 rounded-full bg-zinc-200 dark:bg-zinc-700 inline-block" />
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

function OutboundEmailCard() {
  const { user } = useLocalAccount();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Default the "from name" to the user's business name (falls back to their
  // own name, then to a generic label). Avoids emails going out branded as
  // "Zentra Collect" to the user's customers, which would confuse them.
  const fromNameFallback =
    user?.businessName?.trim() ||
    user?.name?.trim() ||
    "Accounts team";

  async function handleSave() {
    if (!email.trim() || !password.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/email/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "local",
          email: email.trim(),
          password,
          fromName: fromName.trim() || fromNameFallback,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaved(true);
        setPassword("");
        setTimeout(() => setSaved(false), 4000);
        window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
      } else {
        setError(json.error ?? "Save failed.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Outbound email
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Used when you click &ldquo;Send email&rdquo; in the chase drawer.
          Credentials are encrypted before storage.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-email">Your email address</Label>
            <Input
              id="smtp-email"
              type="email"
              placeholder="accounts@yourcompany.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password">Email password / app password</Label>
            <div className="relative">
              <Input
                id="smtp-password"
                type={showPass ? "text" : "password"}
                placeholder="App password or email password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              For Gmail use an App Password (requires 2FA). For Outlook use your regular password.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-name">From name (optional)</Label>
            <Input
              id="smtp-from-name"
              placeholder={fromNameFallback}
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown as the sender in your customer&apos;s inbox. Leave blank to use{" "}
              <span className="font-medium">{fromNameFallback}</span>.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Email credentials saved.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={saving || !email.trim() || !password.trim()}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save credentials"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={defaultValue} />
    </div>
  );
}
