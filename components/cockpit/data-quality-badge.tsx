import { Badge } from "@/components/ui/badge";

type BadgeVariant = "green" | "yellow" | "red" | "blue" | "gray" | "muted";

/**
 * Maps a data-source status value (Handelsregister / Bundesanzeiger / financial
 * data, etc.) to a colored badge with a German label. Conservative defaults:
 * unknown values render neutral rather than implying a positive state.
 */
const STATUS_META: Record<string, { variant: BadgeVariant; label: string }> = {
  verified: { variant: "green", label: "Verifiziert" },
  available: { variant: "green", label: "Vorhanden" },
  vorhanden: { variant: "green", label: "Vorhanden" },
  missing: { variant: "yellow", label: "Fehlt" },
  unverified: { variant: "yellow", label: "Unbestätigt" },
  not_applicable: { variant: "muted", label: "Nicht zutreffend" },
  unavailable: { variant: "gray", label: "Nicht verfügbar" },
  retired: { variant: "gray", label: "Eingestellt" },
};

export function DataQualityBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const meta = STATUS_META[status] ?? {
    variant: "muted" as BadgeVariant,
    label: status,
  };
  return <Badge variant={meta.variant}>{label ? `${label}: ${meta.label}` : meta.label}</Badge>;
}
