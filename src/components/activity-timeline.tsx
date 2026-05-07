import { Clock3 } from "lucide-react";
import { formatDate } from "@/lib/formatters";

type ActivityLike = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

export function ActivityTimeline({ items }: { items: ActivityLike[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No activity yet. Generate or send a reminder to start the timeline.
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
            <Clock3 className="size-3.5 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium">{item.title}</p>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDate(item.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
