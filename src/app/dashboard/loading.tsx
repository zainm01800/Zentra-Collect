import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6" style={{ background: "var(--zn-bg)" }}>
      <Skeleton className="h-32 w-full rounded-3xl" style={{ background: "var(--zn-surface-2)" }} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" style={{ background: "var(--zn-surface-2)" }} />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" style={{ background: "var(--zn-surface-2)" }} />
    </div>
  );
}
