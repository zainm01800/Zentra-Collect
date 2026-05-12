import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
      <Skeleton className="h-64 w-full rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
    </div>
  );
}
