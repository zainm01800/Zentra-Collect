/**
 * Business settings — stored in localStorage so they persist across sessions
 * without requiring a backend. Keys use the "zentra.biz." prefix.
 */

const KEY = "zentra.businessSettings.v1";

export interface BusinessSettings {
  businessName: string;
  senderName: string;
  replyToEmail: string;
  defaultTone: "Friendly" | "Neutral" | "Firm" | "Final notice";
  paymentTermsDays: string;
  reminderSchedule: "gentle" | "standard" | "standard-extended" | "firm";
  brandVoiceNotes: string;
  lateFeeLanguageEnabled: boolean;
}

const DEFAULTS: BusinessSettings = {
  businessName: "",
  senderName: "",
  replyToEmail: "",
  defaultTone: "Neutral",
  paymentTermsDays: "30",
  reminderSchedule: "standard-extended",
  brandVoiceNotes:
    "Professional, calm, clear, and relationship-preserving. Avoid legal language unless reviewed.",
  lateFeeLanguageEnabled: false,
};

export function readBusinessSettings(): BusinessSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<BusinessSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function writeBusinessSettings(settings: BusinessSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("zentra:businessSettingsChanged"));
    void import("@/lib/sync/workspace-sync").then(({ pushDataType, getLocalSupabaseAccountId }) => {
      const id = getLocalSupabaseAccountId();
      if (id) return pushDataType("business_settings", id);
    }).catch(() => {});
  } catch {
    // quota exceeded — silently ignore
  }
}
