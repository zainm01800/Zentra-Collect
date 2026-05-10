"use client";

// Stores non-sensitive email settings in localStorage.
// Sensitive credentials (smtp password) are stored server-side in Supabase.
// This store is only used for UI state.
//
// Demo mode uses sessionStorage under a separate key so the fake state resets
// on tab close and never pollutes the real settings.

export type EmailUiSettings = {
  isEnabled: boolean;
  armedAt: string | null;
  connectedEmail: string | null;
  fromName: string;
  sendHourUtc: number;
  sendDays: string;
  maxPerRun: number;
};

const STORAGE_KEY = "zentra.emailSettings.v1";
const DEMO_KEY = "zentra.emailSettings.demo.v1";
const ARM_GRACE_MS = 5 * 60 * 1000;

const defaults: EmailUiSettings = {
  isEnabled: false,
  armedAt: null,
  connectedEmail: null,
  fromName: "Zentra Collect",
  sendHourUtc: 9,
  sendDays: "1,2,3,4,5",
  maxPerRun: 5,
};

// ── Real settings (localStorage) ─────────────────────────────────────────────

export function readEmailUiSettings(): EmailUiSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function writeEmailUiSettings(settings: Partial<EmailUiSettings>): void {
  if (typeof window === "undefined") return;
  const current = readEmailUiSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
}

export function isArmingCountdownActive(): boolean {
  const settings = readEmailUiSettings();
  if (!settings.armedAt || settings.isEnabled) return false;
  const elapsed = Date.now() - new Date(settings.armedAt).getTime();
  return elapsed < ARM_GRACE_MS;
}

export function getArmingSecondsRemaining(): number {
  const settings = readEmailUiSettings();
  if (!settings.armedAt) return 0;
  const elapsed = Date.now() - new Date(settings.armedAt).getTime();
  return Math.max(0, Math.ceil((ARM_GRACE_MS - elapsed) / 1000));
}

export function startArming(): void {
  writeEmailUiSettings({ armedAt: new Date().toISOString(), isEnabled: false });
}

export function cancelArming(): void {
  writeEmailUiSettings({ armedAt: null, isEnabled: false });
}

export function completeArming(): void {
  writeEmailUiSettings({ isEnabled: true, armedAt: null });
}

export function disableAutoSend(): void {
  writeEmailUiSettings({ isEnabled: false, armedAt: null });
}

// ── Demo arming (sessionStorage — resets on tab close) ───────────────────────

type DemoPhase = "off" | "arming" | "on";

function readDemoPhase(): DemoPhase {
  if (typeof window === "undefined") return "off";
  return (sessionStorage.getItem(DEMO_KEY) as DemoPhase) ?? "off";
}

function writeDemoPhase(phase: DemoPhase): void {
  if (typeof window === "undefined") return;
  if (phase === "off") {
    sessionStorage.removeItem(DEMO_KEY);
  } else {
    sessionStorage.setItem(DEMO_KEY, phase);
  }
  window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
}

export function getDemoPhase(): DemoPhase {
  return readDemoPhase();
}

export function startDemoArming(): void {
  // Store the arming start time so the banner can compute seconds remaining.
  sessionStorage.setItem(DEMO_KEY, "arming");
  sessionStorage.setItem(`${DEMO_KEY}.armedAt`, new Date().toISOString());
  window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
}

export function cancelDemoArming(): void {
  sessionStorage.removeItem(DEMO_KEY);
  sessionStorage.removeItem(`${DEMO_KEY}.armedAt`);
  window.dispatchEvent(new Event("zentra:emailSettingsChanged"));
}

export function completeDemoArming(): void {
  writeDemoPhase("on");
}

export function disableDemoAutoSend(): void {
  writeDemoPhase("off");
  sessionStorage.removeItem(`${DEMO_KEY}.armedAt`);
}

export function isDemoArmingActive(): boolean {
  if (typeof window === "undefined") return false;
  if (readDemoPhase() !== "arming") return false;
  const armedAt = sessionStorage.getItem(`${DEMO_KEY}.armedAt`);
  if (!armedAt) return false;
  return Date.now() - new Date(armedAt).getTime() < ARM_GRACE_MS;
}

export function getDemoArmingSecondsRemaining(): number {
  if (typeof window === "undefined") return 0;
  const armedAt = sessionStorage.getItem(`${DEMO_KEY}.armedAt`);
  if (!armedAt) return 0;
  const elapsed = Date.now() - new Date(armedAt).getTime();
  return Math.max(0, Math.ceil((ARM_GRACE_MS - elapsed) / 1000));
}
