import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkCanPerform,
  computeTrialDaysRemaining,
  computeGracePeriodEndsAt,
  computeGracePeriodDaysRemaining,
  buildMeter,
  currentPeriodKey,
  computeUsageSnapshot,
} from "../tracker";
import type { AccountUsage } from "../tracker";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FUTURE = "2099-01-01";
const PAST   = "2020-01-01";

function trialAccount(overrides: Partial<AccountUsage> = {}): AccountUsage {
  return {
    id: "test-trial",
    planId: "trial",
    monthlyPeriodKey: currentPeriodKey(),
    importsThisMonth: 0,
    aiActionsThisMonth: 0,
    weeklyDigestsGenerated: 0,
    activeInvoices: 0,
    clientLedgers: 0,
    savedImportMappings: 0,
    trialImportsUsed: 0,
    trialAIActionsUsed: 0,
    trialStartedAt: "2026-01-01",
    trialEndsAt: FUTURE,
    gracePeriodEndsAt: null,
    ...overrides,
  };
}

function demoAccount(overrides: Partial<AccountUsage> = {}): AccountUsage {
  return {
    id: "demo",
    planId: "demo",
    monthlyPeriodKey: currentPeriodKey(),
    importsThisMonth: 0,
    aiActionsThisMonth: 0,
    weeklyDigestsGenerated: 0,
    activeInvoices: 0,
    clientLedgers: 0,
    savedImportMappings: 0,
    trialImportsUsed: 0,
    trialAIActionsUsed: 0,
    trialStartedAt: null,
    trialEndsAt: null,
    gracePeriodEndsAt: null,
    ...overrides,
  };
}

function paidAccount(planId: AccountUsage["planId"] = "single_business", overrides: Partial<AccountUsage> = {}): AccountUsage {
  return {
    id: "test-paid",
    planId,
    monthlyPeriodKey: currentPeriodKey(),
    importsThisMonth: 0,
    aiActionsThisMonth: 0,
    weeklyDigestsGenerated: 0,
    activeInvoices: 0,
    clientLedgers: 0,
    savedImportMappings: 0,
    trialImportsUsed: 0,
    trialAIActionsUsed: 0,
    trialStartedAt: null,
    trialEndsAt: null,
    gracePeriodEndsAt: null,
    ...overrides,
  };
}

// ── checkCanPerform — trial plan ──────────────────────────────────────────────

describe("checkCanPerform — trial import", () => {
  it("allows import when under the 2-import trial limit", () => {
    const result = checkCanPerform(trialAccount({ trialImportsUsed: 0 }), "import");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows last import when 1 used", () => {
    const result = checkCanPerform(trialAccount({ trialImportsUsed: 1 }), "import");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks import when trial limit (2) is reached", () => {
    const result = checkCanPerform(trialAccount({ trialImportsUsed: 2 }), "import");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toMatch(/limit/i);
  });

  it("blocks import when trial has expired", () => {
    const result = checkCanPerform(trialAccount({ trialEndsAt: PAST }), "import");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });
});

describe("checkCanPerform — trial AI actions", () => {
  it("allows AI action when under 25-action trial limit", () => {
    const result = checkCanPerform(trialAccount({ trialAIActionsUsed: 10 }), "aiAction");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15);
  });

  it("blocks AI action when 25/25 trial actions used", () => {
    const result = checkCanPerform(trialAccount({ trialAIActionsUsed: 25 }), "aiAction");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

// ── checkCanPerform — demo plan ───────────────────────────────────────────────

describe("checkCanPerform — demo plan", () => {
  it("blocks real imports on demo plan", () => {
    const result = checkCanPerform(demoAccount(), "import");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/sample data/i);
  });

  it("allows AI actions up to the 3-action demo limit", () => {
    const result = checkCanPerform(demoAccount({ aiActionsThisMonth: 2 }), "aiAction");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks AI action at demo limit of 3", () => {
    const result = checkCanPerform(demoAccount({ aiActionsThisMonth: 3 }), "aiAction");
    expect(result.allowed).toBe(false);
  });

  it("blocks adding client ledgers on demo plan", () => {
    const result = checkCanPerform(demoAccount(), "addClientLedger");
    expect(result.allowed).toBe(false);
  });
});

// ── checkCanPerform — paid plan ───────────────────────────────────────────────

describe("checkCanPerform — paid plan (single_business)", () => {
  it("allows AI actions under monthly limit", () => {
    const result = checkCanPerform(paidAccount("single_business", { aiActionsThisMonth: 100 }), "aiAction");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100); // 200 limit - 100 used
  });

  it("blocks AI action when monthly limit reached", () => {
    const result = checkCanPerform(paidAccount("single_business", { aiActionsThisMonth: 200 }), "aiAction");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows adding a client ledger within plan limit", () => {
    const result = checkCanPerform(paidAccount("single_business", { clientLedgers: 0 }), "addClientLedger");
    expect(result.allowed).toBe(true);
  });

  it("blocks adding a second ledger on single-business plan (limit: 1)", () => {
    const result = checkCanPerform(paidAccount("single_business", { clientLedgers: 1 }), "addClientLedger");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/ledger/i);
  });

  it("allows weekly digest with no limit", () => {
    const result = checkCanPerform(paidAccount(), "weeklyDigest");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeNull();
  });
});

describe("checkCanPerform — bookkeeper plans allow multiple ledgers", () => {
  it("bookkeeper_starter allows up to 5 ledgers", () => {
    expect(checkCanPerform(paidAccount("bookkeeper_starter", { clientLedgers: 4 }), "addClientLedger").allowed).toBe(true);
    expect(checkCanPerform(paidAccount("bookkeeper_starter", { clientLedgers: 5 }), "addClientLedger").allowed).toBe(false);
  });

  it("bookkeeper_pro allows up to 20 ledgers", () => {
    expect(checkCanPerform(paidAccount("bookkeeper_pro", { clientLedgers: 19 }), "addClientLedger").allowed).toBe(true);
    expect(checkCanPerform(paidAccount("bookkeeper_pro", { clientLedgers: 20 }), "addClientLedger").allowed).toBe(false);
  });
});

// ── buildMeter ────────────────────────────────────────────────────────────────

describe("buildMeter", () => {
  it("computes percentUsed, remaining, isAtLimit correctly", () => {
    const m = buildMeter("Imports", 1, 2, true);
    expect(m.used).toBe(1);
    expect(m.limit).toBe(2);
    expect(m.remaining).toBe(1);
    expect(m.percentUsed).toBe(50);
    expect(m.isAtLimit).toBe(false);
    expect(m.resetsMonthly).toBe(true);
  });

  it("marks isAtLimit when used equals limit", () => {
    const m = buildMeter("Imports", 2, 2, true);
    expect(m.isAtLimit).toBe(true);
    expect(m.remaining).toBe(0);
    expect(m.percentUsed).toBe(100);
  });

  it("caps remaining at 0 when over limit (should not go negative)", () => {
    const m = buildMeter("Imports", 5, 2, true);
    expect(m.remaining).toBe(0);
    expect(m.isAtLimit).toBe(true);
  });

  it("returns nulls for unlimited meter (limit = null)", () => {
    const m = buildMeter("Weekly digests", 10, null, true);
    expect(m.limit).toBeNull();
    expect(m.remaining).toBeNull();
    expect(m.percentUsed).toBeNull();
    expect(m.isAtLimit).toBe(false);
  });

  it("handles zero-limit meter as 100% used", () => {
    const m = buildMeter("Ledgers", 0, 0, false);
    expect(m.percentUsed).toBe(100);
  });
});

// ── computeTrialDaysRemaining ─────────────────────────────────────────────────

describe("computeTrialDaysRemaining", () => {
  it("returns null for no trial", () => {
    expect(computeTrialDaysRemaining(null)).toBeNull();
  });

  it("returns 0 for expired trial", () => {
    expect(computeTrialDaysRemaining(PAST)).toBe(0);
  });

  it("returns a positive number for future trial end", () => {
    const days = computeTrialDaysRemaining(FUTURE);
    expect(days).toBeGreaterThan(0);
  });

  it("returns 1 for trial expiring tomorrow", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const days = computeTrialDaysRemaining(tomorrow);
    expect(days).toBeGreaterThanOrEqual(1);
  });
});

// ── computeGracePeriodEndsAt ──────────────────────────────────────────────────

describe("computeGracePeriodEndsAt", () => {
  it("returns null for no trial end date", () => {
    expect(computeGracePeriodEndsAt(null)).toBeNull();
  });

  it("adds exactly 30 days to the trial end date", () => {
    const result = computeGracePeriodEndsAt("2026-01-01");
    expect(result).toBe("2026-01-31");
  });

  it("handles month boundary correctly", () => {
    const result = computeGracePeriodEndsAt("2026-01-15");
    expect(result).toBe("2026-02-14");
  });
});

// ── computeGracePeriodDaysRemaining ──────────────────────────────────────────

describe("computeGracePeriodDaysRemaining", () => {
  it("returns null when trial is not expired", () => {
    expect(computeGracePeriodDaysRemaining(FUTURE, false)).toBeNull();
  });

  it("returns null when gracePeriodEndsAt is null", () => {
    expect(computeGracePeriodDaysRemaining(null, true)).toBeNull();
  });

  it("returns null when grace period has passed", () => {
    expect(computeGracePeriodDaysRemaining(PAST, true)).toBeNull();
  });

  it("returns positive days when expired and within grace period", () => {
    const days = computeGracePeriodDaysRemaining(FUTURE, true);
    expect(days).toBeGreaterThan(0);
  });
});

// ── currentPeriodKey ──────────────────────────────────────────────────────────

describe("currentPeriodKey", () => {
  it("returns a YYYY-MM string", () => {
    const key = currentPeriodKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ── computeUsageSnapshot ──────────────────────────────────────────────────────

describe("computeUsageSnapshot", () => {
  it("isTrial is true for trial accounts", () => {
    const snap = computeUsageSnapshot(trialAccount());
    expect(snap.isTrial).toBe(true);
  });

  it("isTrial is false for paid accounts", () => {
    const snap = computeUsageSnapshot(paidAccount());
    expect(snap.isTrial).toBe(false);
  });

  it("isExpired is true when trial end date is in the past", () => {
    const snap = computeUsageSnapshot(trialAccount({ trialEndsAt: PAST }));
    expect(snap.isExpired).toBe(true);
    expect(snap.canPerformImport).toBe(false);
    expect(snap.canPerformAIAction).toBe(false);
  });

  it("isExpired is false for active trial", () => {
    const snap = computeUsageSnapshot(trialAccount({ trialEndsAt: FUTURE }));
    expect(snap.isExpired).toBe(false);
  });

  it("isInGracePeriod is true when expired but grace not over", () => {
    const snap = computeUsageSnapshot(trialAccount({ trialEndsAt: PAST, gracePeriodEndsAt: FUTURE }));
    expect(snap.isExpired).toBe(true);
    expect(snap.isInGracePeriod).toBe(true);
    expect(snap.gracePeriodDaysRemaining).toBeGreaterThan(0);
  });

  it("snapshot includes planName and tier", () => {
    const snap = computeUsageSnapshot(trialAccount());
    expect(snap.planName).toBeTruthy();
    expect(snap.tier).toBe("trial");
  });

  it("trial meter uses lifetime counter, not monthly", () => {
    const snap = computeUsageSnapshot(trialAccount({
      trialImportsUsed: 1,
      importsThisMonth: 0, // monthly counter shouldn't matter for trial
    }));
    expect(snap.meters.imports.used).toBe(1);
  });
});
