import { Badge } from "@/components/ui/badge";

/**
 * Renders a single acquisition risk/data-gap flag as a small badge with a
 * humanized German label. Unknown tokens fall back to the raw flag so nothing
 * is silently hidden. Presentational only.
 */
const FLAG_LABELS: Record<string, string> = {
  no_administrator_email: "Keine Verwalter-E-Mail",
  no_administrator_name: "Kein Verwaltername",
  no_court: "Kein Gericht",
  no_aktenzeichen: "Kein Aktenzeichen",
  handelsregister_missing: "HR fehlt",
  handelsregister_not_applicable: "HR n. a.",
  missing_recipient_email: "Empfänger-E-Mail fehlt",
  missing_case_reference: "Fallreferenz fehlt",
  missing_email: "E-Mail fehlt",
  no_financial_data: "Keine Finanzdaten",
  late_stage_phase: "Späte Phase",
  unverified_hr: "HR unbestätigt",
  nachlass_sensitivity: "Nachlass-Sensibilität",
};

export function humanizeFlag(flag: string): string {
  return FLAG_LABELS[flag] ?? flag.replace(/_/g, " ");
}

export function RiskFlagBadge({ flag }: { flag: string }) {
  return <Badge variant="yellow">{humanizeFlag(flag)}</Badge>;
}

/** Convenience: render a wrapping row of risk-flag badges. */
export function RiskFlagList({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <RiskFlagBadge key={f} flag={f} />
      ))}
    </div>
  );
}
