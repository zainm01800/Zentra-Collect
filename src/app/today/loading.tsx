/**
 * src/app/today/loading.tsx
 *
 * Streamed loading skeleton for the Today / Chase-plan page.
 * Shown immediately while the server fetches invoice data from Supabase,
 * preventing the page from blocking on slow cold-starts.
 */

export default function TodayLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-current opacity-10" />
        <div className="h-7 w-48 rounded bg-current opacity-10" />
        <div className="h-3 w-72 rounded bg-current opacity-10" />
      </div>

      {/* KPI bar skeleton */}
      <div className="flex gap-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-20 rounded-[12px] bg-current opacity-[0.06]" />
        ))}
      </div>

      {/* Queue card skeletons */}
      <div className="space-y-2 pt-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-[12px] bg-current opacity-[0.06]" />
        ))}
      </div>
    </div>
  );
}
