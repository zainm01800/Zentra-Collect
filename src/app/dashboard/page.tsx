import { redirect } from "next/navigation";

// Stage 3 — "Dashboard" became "Today" so the home screen has one
// purpose ("what do I do?") rather than a stack of unrelated cards.
// The /dashboard URL still works — it just lands you on /today.
export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const entries = Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string");
  const qs = new URLSearchParams(entries).toString();
  redirect(`/today${qs ? `?${qs}` : ""}`);
}
