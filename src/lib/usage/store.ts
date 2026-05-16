/**
 * src/lib/usage/store.ts
 *
 * In-memory mock usage store. Module-level Map — shared across all requests
 * in the same Node.js process. Resets on server restart / cold start.
 *
 * IMPORTANT — production TODO list:
 *
 * TODO: Replace getOrCreate() with a Supabase SELECT on `account_usage`.
 * TODO: Replace saveAccount() with a Supabase UPSERT (use account ID as key).
 * TODO: Replace incrementUsage() helpers with atomic Supabase RPC functions
 *   (e.g. `rpc('increment_usage', { account_id, field, delta })`) to avoid
 *   lost updates under concurrent requests.
 * TODO: Pull accountId from the authenticated session (see PRODUCTION_READINESS.md §3)
 *   instead of defaulting to DEMO_ACCOUNT_ID.
 * TODO: recordAIAction() should write an audit row to a `usage_events` table
 *   (accountId, actionType, timestamp) for billing reconciliation.
 * TODO: Add a monthly usage reset job (Supabase pg_cron or Vercel Cron) that
 *   resets monthly counters at the start of each billing period rather than
 *   relying on the lazy reset in resetMonthlyUsageIfNeeded().
 */

import {
  checkCanPerform,
  computeUsageSnapshot,
  currentPeriodKey,
  type AccountUsage,
  type AIActionType,
  type CanPerformResult,
  type UsageSnapshot,
  type UsageType,
} from "@/lib/usage/tracker";

// ── Demo account ID ───────────────────────────────────────────────────────────
// Without auth, every request uses this ID. When auth is added, replace
// all references to DEMO_ACCOUNT_ID with `session.user.accountId`.

export const DEMO_ACCOUNT_ID = "demo";

// ── In-memory store ───────────────────────────────────────────────────────────

const accounts = new Map<string, AccountUsage>();

function createDemoAccount(): AccountUsage {
  // Initialised with Business plan and realistic demo usage so that the
  // settings meters show something meaningful out of the box.
  return {
    id: DEMO_ACCOUNT_ID,
    planId: "single_business",
    monthlyPeriodKey: currentPeriodKey(),
    // Pre-seeded with realistic demo usage
    importsThisMonth: 3,
    aiActionsThisMonth: 47,
    weeklyDigestsGenerated: 2,
    activeInvoices: 23,
    clientLedgers: 1,
    savedImportMappings: 2,
    // Trial fields — not used for Business plan but kept for completeness
    trialImportsUsed: 0,
    trialAIActionsUsed: 0,
    trialStartedAt: null,
    trialEndsAt: null,
    gracePeriodEndsAt: null,
  };
}

/**
 * Create a blank trial account for any account ID that is not the demo.
 *
 * TODO (production): Replace this with a Supabase SELECT on `account_usage`.
 *   If no row exists the caller should redirect to onboarding / sign-up, not
 *   silently seed an in-memory row. Creating a row here is acceptable for the
 *   in-memory mock only.
 */
function createFreshAccount(accountId: string): AccountUsage {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    id: accountId,
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
    trialStartedAt: now.toISOString().slice(0, 10),
    trialEndsAt,
    gracePeriodEndsAt: null,
  };
}

function getOrCreate(accountId: string): AccountUsage {
  if (!accounts.has(accountId)) {
    accounts.set(
      accountId,
      accountId === DEMO_ACCOUNT_ID ? createDemoAccount() : createFreshAccount(accountId),
    );
  }
  return accounts.get(accountId)!;
}

function save(account: AccountUsage): void {
  accounts.set(account.id, account);
  // TODO: await supabase.from("account_usage").upsert(account);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Reset monthly counters if the stored period key is stale.
 * Call this at the start of every mutation to guarantee counters are fresh.
 * Returns the (possibly mutated) account — always use the return value.
 */
export function resetMonthlyUsageIfNeeded(account: AccountUsage): AccountUsage {
  const now = currentPeriodKey();
  if (account.monthlyPeriodKey === now) return account;

  const reset: AccountUsage = {
    ...account,
    monthlyPeriodKey: now,
    importsThisMonth: 0,
    aiActionsThisMonth: 0,
    weeklyDigestsGenerated: 0,
    // activeInvoices, clientLedgers, savedImportMappings are NOT monthly
  };
  save(reset);
  return reset;
}

/**
 * Increment (or set) a single usage counter.
 *
 * For "setActiveInvoices", amount is treated as the new absolute value,
 * not a delta. This is intentional — active invoices reflect current state,
 * not an accumulator.
 *
 * Does NOT enforce limits — call canPerformUsage() first if you want
 * gate-checking before writing.
 *
 * TODO: Add plan-enforcement gate once auth is wired up.
 */
export function incrementUsage(
  accountId: string,
  usageType: UsageType,
  amount = 1,
): void {
  let account = resetMonthlyUsageIfNeeded(getOrCreate(accountId));

  switch (usageType) {
    case "aiAction":
      account = { ...account, aiActionsThisMonth: account.aiActionsThisMonth + amount };
      if (account.planId === "trial") {
        account = { ...account, trialAIActionsUsed: account.trialAIActionsUsed + amount };
      }
      break;

    case "import":
      account = { ...account, importsThisMonth: account.importsThisMonth + amount };
      if (account.planId === "trial") {
        account = { ...account, trialImportsUsed: account.trialImportsUsed + amount };
      }
      break;

    case "setActiveInvoices":
      // 'amount' is the new total, not a delta
      account = { ...account, activeInvoices: amount };
      break;

    case "addClientLedger":
      account = { ...account, clientLedgers: account.clientLedgers + amount };
      break;

    case "addImportMapping":
      account = { ...account, savedImportMappings: account.savedImportMappings + amount };
      break;

    case "weeklyDigest":
      account = { ...account, weeklyDigestsGenerated: account.weeklyDigestsGenerated + amount };
      break;
  }

  save(account);
}

/**
 * Check whether an operation is currently allowed for this account.
 * Does not mutate anything.
 */
export function canPerformUsage(
  accountId: string,
  usageType: UsageType,
  amount = 1,
): CanPerformResult {
  const account = resetMonthlyUsageIfNeeded(getOrCreate(accountId));
  return checkCanPerform(account, usageType, amount);
}

/**
 * Return a complete usage snapshot for the given account.
 * Safe to call frequently — read-only, no mutations.
 */
export function getUsageSnapshot(accountId: string): UsageSnapshot {
  const account = resetMonthlyUsageIfNeeded(getOrCreate(accountId));
  return computeUsageSnapshot(account);
}

/**
 * Record a successful AI action.
 *
 * Call this ONLY after an AI provider (Gemini or OpenAI) returns a
 * successful response. Do NOT call for:
 *   - Template fallbacks (no AI was called)
 *   - Failed AI requests (error caught, fell back to template)
 *   - Rules-based reply classification (where AI was never invoked)
 *
 * Returns { recorded: true } if counted, { recorded: false, reason } if
 * the account is at-limit or on an ineligible plan.
 *
 * NOTE: In the current demo, at-limit accounts are still allowed to proceed
 * (the operation is recorded as overuse rather than blocked). Hard blocking
 * should be added at the route level once real auth and billing are live.
 */
export function recordAIAction(
  accountId: string,
  actionType: AIActionType,
): { recorded: boolean; reason?: string } {
  const account = resetMonthlyUsageIfNeeded(getOrCreate(accountId));
  const check = checkCanPerform(account, "aiAction", 1);

  // TODO: Once billing is live, return { recorded: false, reason } and
  //   have the caller return a 429 to the client.
  // For now, we always record (even over-limit) to avoid breaking the demo.

  incrementUsage(accountId, "aiAction", 1);

  // TODO: Write audit row: { accountId, actionType, timestamp } to usage_events table.
  console.log(
    `[usage] AI action — account:${accountId} type:${actionType} withinLimit:${check.allowed}`,
  );

  return { recorded: true };
}

/**
 * Record a successful invoice import.
 *
 * Call this ONLY after invoices have been successfully committed to storage
 * (localStorage in the mock; Supabase in production). Do NOT call on
 * validation failures or cancelled imports.
 *
 * Updates:
 *   - importsThisMonth (+ trialImportsUsed if on trial)
 *   - activeInvoices (set to activeInvoiceCount — not an increment)
 */
export function recordImport(
  accountId: string,
  batch: {
    fileName: string;
    invoiceCount: number;
    activeInvoiceCount: number;
  },
): { recorded: boolean; reason?: string } {
  const account = resetMonthlyUsageIfNeeded(getOrCreate(accountId));
  const check = checkCanPerform(account, "import", 1);

  // TODO: Same as recordAIAction — enforce at-limit once billing is live.

  incrementUsage(accountId, "import", 1);
  incrementUsage(accountId, "setActiveInvoices", batch.activeInvoiceCount);

  console.log(
    `[usage] Import — account:${accountId} file:"${batch.fileName}" ` +
    `invoices:${batch.invoiceCount} active:${batch.activeInvoiceCount} withinLimit:${check.allowed}`,
  );

  return { recorded: true };
}
