"use client";

import { useEffect, useState } from "react";
import { Mail, Lock } from "lucide-react";
import { AutoSendModal } from "@/components/auto-send-modal";
import {
  readEmailUiSettings,
  disableAutoSend,
  isArmingCountdownActive,
  getDemoPhase,
  startArming,
  disableDemoAutoSend,
} from "@/lib/email/settings-store";
import { AutoSendResumeModal } from "@/components/auto-send-resume-modal";
import type { EmailUiSettings } from "@/lib/email/settings-store";
import type { PlanId } from "@/lib/account/plans";
import { getPlanConfig } from "@/lib/account/plans";

type Props = {
  planId?: PlanId;
  isDemoMode?: boolean;
};

type ToggleState = "full" | "demo" | "locked";

function resolveState(planId: PlanId | undefined, isDemoMode: boolean): ToggleState {
  if (isDemoMode) return "demo";
  if (!planId) return "locked";
  const features = getPlanConfig(planId).features;
  if (features.autoSendEmail) return "full";
  return "locked";
}

export function AutoSendToggle({ planId, isDemoMode = false }: Props) {
  const state = resolveState(planId, isDemoMode);

  const [isEnabled, setIsEnabled] = useState(false);
  const [isArming, setIsArming] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [savedSettings, setSavedSettings] = useState<EmailUiSettings | null>(null);

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

    if (isEnabled || isArming) {
      disableAutoSend();
      sync();
      window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
    } else {
      const settings = readEmailUiSettings();
      if (settings.connectedEmail) {
        setSavedSettings(settings);
        setResumeOpen(true);
      } else {
        setModalOpen(true);
      }
    }
  }

  if (state === "locked") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-400 dark:text-[#6a5f4e] text-sm cursor-not-allowed select-none">
        <Lock className="size-3.5" />
        <span>Auto-send</span>
        <span className="ml-auto text-xs bg-zinc-100 dark:bg-[#28231c] text-zinc-500 dark:text-[#8a7d69] rounded-full px-2 py-0.5">
          Business+
        </span>
      </div>
    );
  }

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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-zinc-100 dark:hover:bg-[#28231c] transition-colors group"
      >
        <Mail className="size-3.5 text-zinc-500 dark:text-[#8a7d69] group-hover:text-zinc-700 dark:group-hover:text-[#c8b99a]" />
        <span className="text-zinc-700 dark:text-[#c8b99a] group-hover:text-zinc-900 dark:group-hover:text-[#f0e8d5]">{label}</span>
        {state === "demo" && (
          <span className="text-[10px] bg-zinc-100 dark:bg-[#28231c] text-zinc-400 dark:text-[#6a5f4e] rounded-full px-1.5 py-0.5 leading-none">
            demo
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span
            className={`w-8 h-4 rounded-full flex items-center transition-colors ${
              isEnabled ? "bg-zinc-900 dark:bg-[#f0e8d5]" : "bg-zinc-200 dark:bg-[#2d2820]"
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full bg-white dark:bg-[#211d17] shadow-sm transition-transform ml-0.5 ${
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

      {savedSettings && (
        <AutoSendResumeModal
          open={resumeOpen}
          settings={savedSettings}
          onEnable={() => {
            setResumeOpen(false);
            startArming();
            sync();
            window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
          }}
          onEdit={() => {
            setResumeOpen(false);
            setModalOpen(true);
          }}
          onClose={() => {
            setResumeOpen(false);
            sync();
          }}
        />
      )}
    </>
  );
}
