import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 bg-[#fbf8f1] px-4 py-6">
      <Skeleton className="h-32 w-full rounded-3xl bg-white/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl bg-white/70" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-2xl bg-white/70" />
    </div>
  );
}
