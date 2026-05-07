import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SyncStatus() {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Xero sync confidence</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo data is fresh as of 07 May 2026 at 09:30. In production this
              panel will show the last Xero sync, imported invoice count, and any
              sync failures.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline">
            <RefreshCw className="size-4" />
            Check sync
          </Button>
          <Button variant="ghost">
            <TriangleAlert className="size-4" />
            Sync log
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
