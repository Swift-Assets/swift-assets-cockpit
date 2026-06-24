import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge, type TrafficStatus } from "@/components/cockpit/status-badge";
import { cn } from "@/lib/utils";

/**
 * Compact KPI tile: label + large value, optional traffic-light status, hint
 * line and leading icon. Presentational only — no data fetching.
 */
export function MetricCard({
  label,
  value,
  hint,
  status,
  statusLabel,
  icon,
  emphasize,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  status?: TrafficStatus;
  statusLabel?: string;
  icon?: ReactNode;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon ? <span className="text-muted-foreground/80">{icon}</span> : null}
          <span className="truncate">{label}</span>
        </div>
        {status ? <StatusBadge status={status} label={statusLabel} withDot /> : null}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          emphasize ? "text-status-red" : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}
