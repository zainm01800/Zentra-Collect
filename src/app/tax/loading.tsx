import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
    </div>
  );
}
