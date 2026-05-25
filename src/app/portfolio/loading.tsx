import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-10 w-48 rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" style={{ background: "var(--zn-surface-2)" }} />
      ))}
    </div>
  );
}
