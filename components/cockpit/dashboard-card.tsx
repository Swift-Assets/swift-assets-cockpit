import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge, type TrafficStatus } from "@/components/cockpit/status-badge";

/**
 * Presentational dashboard card: title + traffic-light status, an optional main
 * value, a short description and optional extra content. No data fetching.
 */
export function DashboardCard({
  title,
  status,
  statusLabel,
  value,
  description,
  children,
}: {
  title: string;
  status: TrafficStatus;
  statusLabel?: string;
  value?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          {title}
          <StatusBadge status={status} label={statusLabel} />
        </CardTitle>
        {value !== undefined ? (
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
