import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
      ))}
    </div>
  );
}
