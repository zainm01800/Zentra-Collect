import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </main>
  );
}
