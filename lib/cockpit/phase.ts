/**
 * Client-safe insolvency phase classification.
 *
 * Mirrors swift_v2.fn_cockpit_phase_label / fn_cockpit_phase_priority
 * (migration 0028) so the dashboard can classify company announcements without
 * a per-row RPC. Keep in sync with that SQL function. No data access here.
 */

export type PhaseLabel =
  | "vorlaeufig"
  | "eroeffnung"
  | "berichtstermin"
  | "pruefungstermin"
  | "verwertung"
  | "verteilung"
  | "schlussverteilung"
  | "aufhebung"
  | "einstellung_mangels_masse"
  | "unknown";

export type PhasePriority = "high" | "low" | "monitor" | "unknown";

/** Phases that are inside the active acquisition window (dashboard focus). */
export const ACQUISITION_WINDOW_PHASES: PhaseLabel[] = [
  "vorlaeufig",
  "eroeffnung",
  "berichtstermin",
  "pruefungstermin",
  "verwertung",
];

export const PHASE_LABEL_DE: Record<PhaseLabel, string> = {
  vorlaeufig: "Vorläufig",
  eroeffnung: "Eröffnung",
  berichtstermin: "Berichtstermin",
  pruefungstermin: "Prüfungstermin",
  verwertung: "Verwertung",
  verteilung: "Verteilung",
  schlussverteilung: "Schlussverteilung",
  aufhebung: "Aufhebung",
  einstellung_mangels_masse: "Einstellung (Masse)",
  unknown: "Unbekannt",
};

/** Order matters — matches the SQL CASE (schlussverteilung before verteilung). */
export function phaseLabel(
  announcementType: string | null | undefined,
  phaseHint?: string | null,
): PhaseLabel {
  const t = (announcementType ?? "").toLowerCase();
  if (/(vorläufig|vorlaeufig|anordnung|sicherungsma)/.test(t)) return "vorlaeufig";
  if (/(eröffnung|eroeffnung|eröffnet|eroeffnet)/.test(t)) return "eroeffnung";
  if (/berichtstermin/.test(t)) return "berichtstermin";
  if (/(prüfungstermin|pruefungstermin)/.test(t)) return "pruefungstermin";
  if (/(verwertung|masseverwertung)/.test(t)) return "verwertung";
  if (/(schlussverteilung|schlusstermin)/.test(t)) return "schlussverteilung";
  if (/verteilung/.test(t)) return "verteilung";
  if (/aufhebung/.test(t)) return "aufhebung";
  if (/(einstellung|mangels masse|masseunzulänglich|masseunzulaenglich)/.test(t))
    return "einstellung_mangels_masse";

  switch (phaseHint) {
    case "preliminary_administration":
      return "vorlaeufig";
    case "opening":
    case "administrator_appointed":
      return "eroeffnung";
    case "late_stage":
      return "verteilung";
    case "masseunzulaenglichkeit":
      return "einstellung_mangels_masse";
    default:
      return "unknown";
  }
}

export function phasePriority(label: PhaseLabel): PhasePriority {
  switch (label) {
    case "vorlaeufig":
    case "eroeffnung":
    case "berichtstermin":
    case "pruefungstermin":
    case "verwertung":
      return "high";
    case "verteilung":
      return "low";
    case "schlussverteilung":
    case "aufhebung":
    case "einstellung_mangels_masse":
      return "monitor";
    default:
      return "unknown";
  }
}

export function isAcquisitionWindow(label: PhaseLabel): boolean {
  return ACQUISITION_WINDOW_PHASES.includes(label);
}
