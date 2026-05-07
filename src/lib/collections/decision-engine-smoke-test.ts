import {
  demoCustomerBehaviourProfiles,
  demoCustomers,
  demoInvoices,
} from "../demo-data/zentra-demo-data";
import { groupActionsByCategory, rankCollectionActions } from "./decision-engine";

export function runDecisionEngineSmokeTests() {
  const plan = rankCollectionActions({
    invoices: demoInvoices,
    customers: demoCustomers,
    customerBehaviourProfiles: demoCustomerBehaviourProfiles,
    referenceDate: "2026-05-07",
  });
  const groups = groupActionsByCategory(plan);

  const failures: string[] = [];

  if (plan.length !== demoInvoices.length) {
    failures.push("Expected one plan item per invoice.");
  }

  if (!plan.some((item) => item.scenario === "PROMISE_TO_PAY_FOLLOW_UP")) {
    failures.push("Expected at least one promise-to-pay follow-up.");
  }

  if (!plan.some((item) => item.scenario === "REQUEST_REMITTANCE")) {
    failures.push("Expected at least one remittance request.");
  }

  if (!plan.some((item) => item.safetyStatus === "blocked")) {
    failures.push("Expected at least one blocked recommendation.");
  }

  if (!groups.chase_now.length) {
    failures.push("Expected chase_now group to contain recommendations.");
  }

  return {
    passed: failures.length === 0,
    failures,
    planCount: plan.length,
    groupCounts: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [key, value.length]),
    ),
    topRecommendation: plan[0],
  };
}
