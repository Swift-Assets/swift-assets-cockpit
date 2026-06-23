import { Badge } from "@/components/ui/badge";

export type TrafficStatus = "green" | "yellow" | "red" | "gray";

const STATUS_META: Record<
  TrafficStatus,
  { variant: "green" | "yellow" | "red" | "muted"; label: string }
> = {
  green: { variant: "green", label: "Normal" },
  yellow: { variant: "yellow", label: "Prüfung" },
  red: { variant: "red", label: "Kritisch" },
  gray: { variant: "muted", label: "Noch nicht verbunden" },
};

/**
 * Traffic-light status badge with German labels. Pass `label` to override the
 * default wording for a given status.
 */
export function StatusBadge({
  status,
  label,
}: {
  status: TrafficStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{label ?? meta.label}</Badge>;
}
