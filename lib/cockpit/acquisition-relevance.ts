/**
 * Acquisition Gate relevance model (Phase 0043).
 *
 * The Acquisition Gate triages insolvency cases by acquisition value instead of
 * dumping every recent notice. Buckets ("gates"):
 *
 *  - acquisition : NEW company cases with pre-Verteilung relevance (high value):
 *                  Vorläufig / Eröffnung / Berichtstermin / Prüfungstermin /
 *                  Verwertung / administrator appointed / opening.   (DEFAULT)
 *  - watchlist   : cases the user actively follows (watching / pursuing).
 *  - ignored     : cases the user has passed/ignored.
 *  - monitor     : NEW company cases that are low-value / late-stage / procedural
 *                  (Restschuldbefreiung, Schlussverteilung, Verteilung, Aufhebung,
 *                  Einstellung mangels Masse, Vergütungsfestsetzung, Schlussrechnung,
 *                  Unbekannt …). Not deleted — just out of the default triage.
 *  - nachlass    : Nachlass / estate cases (kept separate from the company feed).
 *  - all         : everything loaded (explicit opt-in).
 *
 * Relevance is decided from SAFE structured fields already on
 * v_cockpit_acquisition_inbox (pre_verteilung_relevance, phase_priority,
 * inbox_status, kind, source) — never from raw announcement text.
 */

export type Gate =
  | "acquisition"
  | "watchlist"
  | "ignored"
  | "monitor"
  | "all";

export const DEFAULT_GATE: Gate = "acquisition";

export const GATES: { key: Gate; label: string; description: string }[] = [
  {
    key: "acquisition",
    label: "Akquiserelevant",
    description: "Neue, akquiserelevante Firmenfälle vor der Verteilung.",
  },
  {
    key: "watchlist",
    label: "Watchlist",
    description: "Aktiv beobachtete / verfolgte Fälle.",
  },
  {
    key: "ignored",
    label: "Ignoriert",
    description: "Ignorierte Fälle.",
  },
  {
    key: "monitor",
    label: "Monitor",
    description: "Spätphasen / geringwertige, rein verfahrensbezogene Fälle.",
  },
  {
    key: "all",
    label: "Alle Fälle",
    description: "Alle geladenen Fälle.",
  },
];

const GATE_KEYS = new Set<Gate>(GATES.map((g) => g.key));

/** Clamp an arbitrary value to a valid Gate; falls back to the default. */
export function sanitizeGate(value: unknown): Gate {
  return typeof value === "string" && GATE_KEYS.has(value as Gate)
    ? (value as Gate)
    : DEFAULT_GATE;
}

export function gateLabel(gate: Gate): string {
  return GATES.find((g) => g.key === gate)?.label ?? gate;
}
