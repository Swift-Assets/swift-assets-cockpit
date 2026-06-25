/**
 * Deterministic Arabic case-summary helpers (Phase 0045A).
 *
 * Pure functions only — NO AI, NO data access, NO invented financial numbers.
 * They turn already-safe structured fields (phase, announcement type, dates,
 * relevance) into concise Arabic text for the internal Cockpit. German legal
 * terms are kept inline because they are the canonical case vocabulary.
 */

import type { CaseTimelineEvent } from "@/lib/cockpit/case-timeline.queries";

export interface ArabicCaseSummary {
  headlineAr: string;
  statusAr: string;
  relevanceAr: string;
  nextActionAr: string;
  riskFlagsAr: string[];
}

/** German display label per internal phase key (canonical case vocabulary). */
const PHASE_DE: Record<string, string> = {
  vorlaeufig: "Vorläufiges Verfahren",
  eroeffnung: "Eröffnung",
  berichtstermin: "Berichtstermin",
  pruefungstermin: "Prüfungstermin",
  verwertung: "Verwertung",
  verteilung: "Verteilung",
  schlussverteilung: "Schlussverteilung",
  aufhebung: "Aufhebung",
  einstellung_mangels_masse: "Einstellung mangels Masse",
  restschuldbefreiung: "Restschuldbefreiung",
  verguetungsfestsetzung: "Vergütungsfestsetzung",
};

/** Short Arabic gloss per internal phase key. */
const PHASE_AR: Record<string, string> = {
  vorlaeufig: "إجراء إعسار أولي (تدابير تأمينية / حارس مؤقت)",
  eroeffnung: "افتتاح إجراء الإعسار وتعيين مدير الإعسار",
  berichtstermin: "موعد تقديم تقرير مدير الإعسار",
  pruefungstermin: "موعد فحص الديون المُعلَنة",
  verwertung: "مرحلة تسييل/بيع أصول الكتلة",
  verteilung: "توزيع حصيلة الكتلة على الدائنين",
  schlussverteilung: "التوزيع النهائي قرب إقفال الإجراء",
  aufhebung: "رفع/إنهاء إجراء الإعسار",
  einstellung_mangels_masse: "إيقاف الإجراء لعدم كفاية الكتلة",
  restschuldbefreiung: "إبراء الذمة من الديون المتبقية (غالبًا شخص طبيعي)",
  verguetungsfestsetzung: "تحديد أتعاب مدير الإعسار (إجراء إداري متأخر)",
};

const PRE_VERTEILUNG = new Set([
  "vorlaeufig",
  "eroeffnung",
  "berichtstermin",
  "pruefungstermin",
  "verwertung",
]);

/** German legal label for an announcement phase/type (falls back to the raw hint). */
export function describeAnnouncementTypeDe(
  phase: string | null,
  announcementType: string | null,
): string {
  if (phase && PHASE_DE[phase]) return PHASE_DE[phase];
  const t = announcementType?.trim();
  return t && t.length > 0 ? t : "Unbekannte Bekanntmachung";
}

/** Concise Arabic gloss for a phase. */
export function describePhaseAr(phase: string | null): string {
  if (phase && PHASE_AR[phase]) return PHASE_AR[phase];
  return "طور غير محدد بدقة";
}

/** Arabic one-liner about acquisition relevance for a single event. */
export function describeAcquisitionRelevanceAr(event: {
  insolvencyPhase: string | null;
  isPreVerteilung: boolean | null;
}): string {
  const pre =
    event.isPreVerteilung ??
    (event.insolvencyPhase ? PRE_VERTEILUNG.has(event.insolvencyPhase) : false);
  if (pre) return "أكويرلِفانت — ضمن نافذة ما قبل التوزيع.";
  if (event.insolvencyPhase && event.insolvencyPhase !== "unknown")
    return "مرحلة متأخرة/إجرائية — للمراقبة فقط.";
  return "غير مصنّف — يتطلب مراجعة يدوية.";
}

/** Arabic short explanation for one timeline event (date + phase + relevance). */
export function buildArabicTimelineEventSummary(event: CaseTimelineEvent): string {
  const ar = describePhaseAr(event.insolvencyPhase);
  const rel = describeAcquisitionRelevanceAr(event);
  return `${ar} — ${rel}`;
}

export interface ArabicCaseSummaryInput {
  /** Timeline events for the case, any order. */
  events: CaseTimelineEvent[];
  /** Fallback fields from the card when the timeline is empty. */
  fallbackPhase?: string | null;
  fallbackPreVerteilung?: boolean | null;
  hasAdministratorEmail?: boolean;
  court?: string | null;
  aktenzeichen?: string | null;
}

function latestEvent(events: CaseTimelineEvent[]): CaseTimelineEvent | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => {
    const ta = a.publicationDate ? Date.parse(a.publicationDate) : 0;
    const tb = b.publicationDate ? Date.parse(b.publicationDate) : 0;
    return tb - ta;
  })[0];
}

/**
 * Builds the Arabic case summary from structured fields only. Never invents
 * financial figures; only mentions what the structured data supports.
 */
export function buildArabicCaseSummary(
  input: ArabicCaseSummaryInput,
): ArabicCaseSummary {
  const { events } = input;
  const latest = latestEvent(events);

  // Determine the operative phase + pre-Verteilung from the latest event,
  // falling back to the card's own classification when no timeline is available.
  const phase = latest?.insolvencyPhase ?? input.fallbackPhase ?? null;
  const pre =
    latest?.isPreVerteilung ??
    input.fallbackPreVerteilung ??
    (phase ? PRE_VERTEILUNG.has(phase) : null);

  // Is there an early/relevant event anywhere in the history (not just latest)?
  const hasEarlyEvent = events.some(
    (e) =>
      e.isPreVerteilung === true ||
      (e.insolvencyPhase ? PRE_VERTEILUNG.has(e.insolvencyPhase) : false),
  );

  const riskFlagsAr: string[] = [];
  if (!input.court && !input.aktenzeichen)
    riskFlagsAr.push("لا يوجد مرجع قضية (محكمة/رقم ملف).");
  if (input.hasAdministratorEmail === false)
    riskFlagsAr.push("لا يوجد بريد لمدير الإعسار — تواصل محدود.");

  if (!latest && (phase === null || phase === undefined)) {
    return {
      headlineAr: "لا تتوفر بيانات timeline منظَّمة كافية لهذه الحالة.",
      statusAr: "الطور غير معروف من البيانات المتاحة.",
      relevanceAr: "يتعذّر تحديد مدى الملاءمة للاستحواذ تلقائيًا.",
      nextActionAr: "يُنصح بمراجعة يدوية للحالة قبل أي إجراء.",
      riskFlagsAr,
    };
  }

  const phaseDe = describeAnnouncementTypeDe(phase, latest?.announcementType ?? null);
  const phaseAr = describePhaseAr(phase);

  let statusAr: string;
  let relevanceAr: string;
  let nextActionAr: string;

  if (pre === true) {
    statusAr = `الطور الحالي: ${phaseDe} — ${phaseAr}.`;
    relevanceAr = "أكويرلِفانت — الحالة ما تزال ضمن نافذة ما قبل التوزيع وقد تكون مهمة عمليًا.";
    nextActionAr = "يُنصح بالمراجعة والتواصل مع مدير الإعسار لتقييم الأصول.";
  } else if (phase === "unknown" || phase === null) {
    statusAr = "الطور غير مصنّف بدقة من البيانات المتاحة.";
    relevanceAr = "التصنيف غير واضح — لا يُفترض تلقائيًا.";
    nextActionAr = "مراجعة يدوية مطلوبة لتحديد الطور والملاءمة.";
  } else {
    statusAr = `الطور الحالي: ${phaseDe} — ${phaseAr}.`;
    relevanceAr = hasEarlyEvent
      ? "مرحلة متأخرة الآن، لكن يوجد حدث مبكر سابق في السجل قد يستحق المراجعة."
      : "مرحلة متأخرة/إجرائية — للمراقبة فقط، قيمة استحواذ محدودة عادةً.";
    nextActionAr = hasEarlyEvent
      ? "راجع السجل الزمني؛ التواصل اختياري حسب الأصول المتبقية."
      : "إبقاء الحالة تحت المراقبة دون إجراء فوري.";
  }

  const headlineAr = latest
    ? `آخر بكنتماخونغ: ${phaseDe}.`
    : `التصنيف الحالي: ${phaseDe}.`;

  return { headlineAr, statusAr, relevanceAr, nextActionAr, riskFlagsAr };
}
