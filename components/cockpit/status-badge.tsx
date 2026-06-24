import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TrafficStatus = "green" | "yellow" | "red" | "gray";

const STATUS_META: Record<
  TrafficStatus,
  { variant: "green" | "yellow" | "red" | "muted"; label: string; dot: string }
> = {
  green: { variant: "green", label: "Normal", dot: "bg-status-green" },
  yellow: { variant: "yellow", label: "Prüfung", dot: "bg-status-yellow" },
  red: { variant: "red", label: "Kritisch", dot: "bg-status-red" },
  gray: { variant: "muted", label: "Nicht verbunden", dot: "bg-status-gray" },
};

/**
 * Traffic-light status badge with German labels. Pass `label` to override the
 * default wording and `withDot` to prefix a colored status dot.
 */
export function StatusBadge({
  status,
  label,
  withDot = false,
}: {
  status: TrafficStatus;
  label?: string;
  withDot?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant}>
      {withDot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      ) : null}
      {label ?? meta.label}
    </Badge>
  );
}
