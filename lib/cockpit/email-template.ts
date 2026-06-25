/**
 * Client-safe German outreach email TEMPLATES (preview/reference only).
 *
 * These build the wording shown in the lead profile so the user can see what an
 * outreach email would say. They DO NOT send anything. The actual editable
 * draft is created server-side via the existing
 * cockpit_create_outreach_draft_from_watchlist RPC. No PII is fetched here; for
 * Nachlass, a person name/birth date is only included if the caller already has
 * it from an approved internal source (the safe watchlist view does not expose
 * it, so these stay undefined there).
 */

export interface OutreachTemplateInput {
  kind: "company" | "nachlass";
  caseLabel: string;
  aktenzeichen: string | null;
  latestPublicationDate: string | null;
  /** Nachlass only, optional — used only when available from an approved view. */
  personName?: string | null;
  birthDate?: string | null;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function buildOutreachPreview(input: OutreachTemplateInput): {
  subject: string;
  body: string;
} {
  const az = input.aktenzeichen?.trim() || "—";
  const pubDate = fmtDate(input.latestPublicationDate);
  const intro =
    "Die Swift Assets UG (haftungsbeschränkt) mit Sitz in Solingen ist ein Handelsunternehmen, das Vermögenswerte aus Insolvenzverfahren von Unternehmen sowie aus Nachlassinsolvenzverfahren prüft und – je nach Sachlage – selbst oder vermittelnd für Dritte erwerben kann. Unser Fokus liegt auf einer rechtssicheren, zügigen und verlässlichen Abwicklung im Rahmen der jeweils geltenden insolvenzrechtlichen und verfahrensrechtlichen Vorgaben.";
  const ask =
    `Auf Grundlage der letzten öffentlichen Bekanntmachung vom ${pubDate} bitten wir höflich um Mitteilung, ob in dem oben genannten Verfahren verwertbare Vermögensgegenstände, Warenbestände, Betriebsausstattung, Fahrzeuge, Forderungen, Immobilien oder sonstige zur Verwertung stehende Positionen vorhanden sind.`;
  const close =
    "Sofern verfügbar, bitten wir um Übersendung einer Übersicht bzw. eines Verzeichnisses der zur Verwertung kommenden Gegenstände sowie um Angaben zum weiteren Verfahren, zu Besichtigungsmöglichkeiten und zu etwaigen Fristen.\n\nGerne stehen wir für eine kurzfristige Rückmeldung oder Abstimmung zur Verfügung.\n\nMit freundlichen Grüßen\n\nSwift Assets UG (haftungsbeschränkt)\nSolingen";

  if (input.kind === "nachlass") {
    const person = input.personName?.trim() || input.caseLabel;
    const birthClause = input.birthDate?.trim()
      ? `, geboren am ${fmtDate(input.birthDate)}`
      : "";
    return {
      subject: `Anfrage zu verwertbaren Vermögenswerten im Nachlassinsolvenzverfahren ${az} – ${person}`,
      body: `Sehr geehrte Damen und Herren,\n\nwir wenden uns an Sie im Zusammenhang mit dem Nachlassinsolvenzverfahren ${az} betreffend ${person}${birthClause}.\n\n${intro}\n\n${ask}\n\n${close}`,
    };
  }

  return {
    subject: `Anfrage zu verwertbaren Vermögenswerten im Verfahren ${az} – ${input.caseLabel}`,
    body: `Sehr geehrte Damen und Herren,\n\nwir wenden uns an Sie im Zusammenhang mit dem Insolvenzverfahren ${az} betreffend ${input.caseLabel}.\n\n${intro}\n\n${ask}\n\n${close}`,
  };
}
