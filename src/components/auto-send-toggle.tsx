"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, Zap } from "lucide-react";
import { AutoSendModal } from "@/components/auto-send-modal";
import { EmailAddonUpgradeModal } from "@/components/email-addon-upgrade-modal";
import {
  readEmailUiSettings,
  disableAutoSend,
  isArmingCountdownActive,
  getDemoPhase,
  startDemoArming,
  disableDemoAutoSend,
} from "@/lib/email/settings-store";
import type { PlanId } from "@/lib/account/plans";
import { getPlanConfig } from "@/lib/account/plans";

type Props = {
  planId?: PlanId;
  isDemoMode?: boolean;
  hasEmailAddon?: boolean;
};

type ToggleState =
  | "full"          // plan includes emailSending
  | "addon-active"  // addon purchased (emailSendingAddon plan + emailAddon=true)
  | "addon-upgrade" // addon purchasable but not bought
  | "demo"          // demo account — show fake UI
  | "locked";       // plan doesn't include email at all

function resolveState(
  planId: PlanId | undefined,
  isDemoMode: boolean,
  hasEmailAddon: boolean,
): ToggleState {
  if (isDemoMode) return "demo";
  if (!planId) return "locked";
  const features = getPlanConfig(planId).features;
  if (features.emailSending) return "full";
  if (features.emailSendingAddon) return hasEmailAddon ? "addon-active" : "addon-upgrade";
  return "locked";
}

export function AutoSendToggle({
  planId,
  isDemoMode = false,
  hasEmailAddon = false,
}: Props) {
  const state = resolveState(planId, isDemoMode, hasEmailAddon);

  const [isEnabled, setIsEnabled] = useState(false);
  const [isArming, setIsArming] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function sync() {
    if (state === "demo") {
      const phase = getDemoPhase();
      setIsEnabled(phase === "on");
      setIsArming(phase === "arming");
    } else {
      const settings = readEmailUiSettings();
      setIsEnabled(settings.isEnabled);
      setIsArming(isArmingCountdownActive());
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
  }, [state]);

  function handleToggle() {
    if (state === "addon-upgrade") {
      setUpgradeOpen(true);
      return;
    }
    if (state === "locked") return;

    if (state === "demo") {
      if (isEnabled || isArming) {
        disableDemoAutoSend();
        sync();
        window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
      } else {
        setModalOpen(true);
      }
      return;
    }

    // full or addon-active
    if (isEnabled || isArming) {
      disableAutoSend();
      sync();
      window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
    } else {
      setModalOpen(true);
    }
  }

  // ── Locked / upgrade states ──────────────────────────────────────────────
  if (state === "locked") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 text-sm cursor-not-allowed select-none">
        <Lock className="size-3.5" />
        <span>Auto-send</span>
        <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 rounded-full px-2 py-0.5">
          Upgrade
        </span>
      </div>
    );
  }

  if (state === "addon-upgrade") {
    return (
      <>
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-zinc-100 transition-colors group"
        >
          <Zap className="size-3.5 text-zinc-400 group-hover:text-zinc-600" />
          <span className="text-zinc-500 group-hover:text-zinc-700">Auto-send</span>
          <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 rounded-full px-2 py-0.5">
            Add-on
          </span>
        </button>
        <EmailAddonUpgradeModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          planId={planId}
        />
      </>
    );
  }

  // ── Active states (full / addon-active / demo) ───────────────────────────
  const statusDot = isEnabled
    ? "bg-emerald-500"
    : isArming
      ? "bg-amber-400 animate-pulse"
      : "bg-zinc-300";

  const label = isEnabled ? "Auto-send on" : isArming ? "Arming…" : "Auto-send";

  return (
    <>
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-zinc-100 transition-colors group"
      >
        <Mail className="size-3.5 text-zinc-500 group-hover:text-zinc-700" />
        <span className="text-zinc-700 group-hover:text-zinc-900">{label}</span>
        {state === "demo" && (
          <span className="text-[10px] bg-zinc-100 text-zinc-400 rounded-full px-1.5 py-0.5 leading-none">
            demo
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span
            className={`w-8 h-4 rounded-full flex items-center transition-colors ${
              isEnabled ? "bg-zinc-900" : "bg-zinc-200"
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ml-0.5 ${
                isEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
        </span>
      </button>

      <AutoSendModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          sync();
        }}
        isDemoMode={state === "demo"}
      />
    </>
  );
}
