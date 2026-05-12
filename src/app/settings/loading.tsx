import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48 rounded-md" style={{ background: "var(--zn-surface-2)" }} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-72 rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
          <Skeleton className="h-28 rounded-lg" style={{ background: "var(--zn-surface-2)" }} />
        </div>
      </div>
    </div>
  );
}
