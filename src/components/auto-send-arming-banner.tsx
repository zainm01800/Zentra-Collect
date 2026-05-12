"use client";

import { useEffect, useState } from "react";
import { X, Mail } from "lucide-react";
import {
  getArmingSecondsRemaining,
  isArmingCountdownActive,
  cancelArming,
  completeArming,
  isDemoArmingActive,
  getDemoArmingSecondsRemaining,
  cancelDemoArming,
  completeDemoArming,
} from "@/lib/email/settings-store";

export function AutoSendArmingBanner() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    function tick() {
      if (isArmingCountdownActive()) {
        const secs = getArmingSecondsRemaining();
        if (secs <= 0) {
          completeArming();
          setSecondsLeft(null);
          window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
        } else {
          setIsDemo(false);
          setSecondsLeft(secs);
        }
      } else if (isDemoArmingActive()) {
        const secs = getDemoArmingSecondsRemaining();
        if (secs <= 0) {
          completeDemoArming();
          setSecondsLeft(null);
          window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
        } else {
          setIsDemo(true);
          setSecondsLeft(secs);
        }
      } else {
        setSecondsLeft(null);
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    window.addEventListener("zentra:emailSettingsChanged", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("zentra:emailSettingsChanged", tick);
    };
  }, []);

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  function handleCancel() {
    if (isDemo) {
      cancelDemoArming();
    } else {
      cancelArming();
    }
    setSecondsLeft(null);
    window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
  }

  return (
    <div className="bg-amber-50 dark:bg-[#221a08] border-b border-amber-200 dark:border-[#3d2a0a] px-4 py-2.5 flex items-center gap-3 text-sm">
      <Mail className="size-4 text-amber-700 dark:text-[#f0c060] shrink-0" />
      <span className="flex-1 text-amber-900 dark:text-[#f0c060]">
        {isDemo ? (
          <>
            <strong>Demo:</strong> Auto-send arming simulation — would activate in{" "}
            <strong className="tabular-nums">{timeStr}</strong>.
          </>
        ) : (
          <>
            Auto-send arming — first email send will be permitted in{" "}
            <strong className="tabular-nums">{timeStr}</strong>. Review your chase plan before
            this window closes.
          </>
        )}
      </span>
      <button
        onClick={handleCancel}
        className="text-amber-700 dark:text-[#c8a040] hover:text-amber-900 dark:hover:text-[#f0c060] flex items-center gap-1 shrink-0 font-medium"
      >
        <X className="size-3.5" />
        Cancel
      </button>
    </div>
  );
}
