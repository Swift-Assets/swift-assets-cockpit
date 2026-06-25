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
  vorlaeufig: "مرحلة تمهيدية / تدبير قضائي مبكر ضمن Insolvenzverfahren (Anordnung / Sicherungsmaßnahme) قبل Verteilung",
  eroeffnung: "افتتاح إجراء الإعسار رسميًا",
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
  if (pre) return "akquiserelevant — ضمن نافذة مبكرة قبل Verteilung.";
  if (event.insolvencyPhase && event.insolvencyPhase !== "unknown")
    return "monitor — مرحلة متأخرة/إجرائية، للمتابعة فقط.";
  return "غير مصنّف — يتطلب مراجعة يدوية.";
}

/** True if a timeline event carries ANY structured administrator field. */
function eventHasAdministrator(event: CaseTimelineEvent): boolean {
  return Boolean(
    (event.administratorName && event.administratorName.trim()) ||
      (event.administratorEmail && event.administratorEmail.trim()) ||
      (event.administratorPhone && event.administratorPhone.trim()) ||
      (event.administratorAddress && event.administratorAddress.trim()),
  );
}

/**
 * Arabic short explanation for one timeline event. CONSERVATIVE: it never claims
 * an Insolvenzverwalter was appointed from phase/type alone — appointment wording
 * is used only when the event itself carries structured administrator fields.
 */
export function buildArabicTimelineEventSummary(event: CaseTimelineEvent): string {
  const phase = event.insolvencyPhase;
  const hasAdmin = eventHasAdministrator(event);

  switch (phase) {
    case "vorlaeufig":
      return hasAdmin
        ? "إجراء مبكر قبل Verteilung مع بيانات منظمة عن Insolvenzverwalter."
        : "إجراء مبكر قبل Verteilung؛ لا توجد بيانات تعيين منظمة لـ Insolvenzverwalter في هذا الإعلان.";
    case "pruefungstermin":
      return "موعد فحص الديون؛ لا يعني وحده تعيين Insolvenzverwalter جديد.";
    case "berichtstermin":
      return "موعد تقديم تقرير قبل Verteilung.";
    case "eroeffnung":
      return hasAdmin
        ? "Eröffnung des Insolvenzverfahrens مع بيانات Insolvenzverwalter منظمة."
        : "Eröffnung des Insolvenzverfahrens؛ لا تظهر بيانات منظمة لـ Insolvenzverwalter.";
    case "verwertung":
      return "مرحلة تسييل/بيع أصول الكتلة.";
    case null:
    case "unknown":
      return "إجراء غير مصنّف بدقة — يلزم فحص يدوي.";
    default:
      return "مرحلة متأخرة/إجرائية للمتابعة فقط غالبًا.";
  }
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
    riskFlagsAr.push("لا يوجد E-Mail منظم للـ Insolvenzverwalter.");

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
    relevanceAr = "التقييم: akquiserelevant — الحالة ما تزال ضمن نافذة مبكرة قبل Verteilung وقد تكون مهمة عمليًا.";
    nextActionAr = "يُنصح بالمراجعة والتواصل مع الـ Insolvenzverwalter لتقييم الأصول.";
  } else if (phase === "unknown" || phase === null) {
    statusAr = "الطور غير مصنّف بدقة من البيانات المتاحة.";
    relevanceAr = "التصنيف غير واضح — لا يُفترض تلقائيًا.";
    nextActionAr = "مراجعة يدوية مطلوبة لتحديد الطور والملاءمة.";
  } else {
    statusAr = `الطور الحالي: ${phaseDe} — ${phaseAr}.`;
    relevanceAr = hasEarlyEvent
      ? "monitor الآن، لكن يوجد حدث مبكر سابق في الـ Timeline قد يستحق المراجعة."
      : "monitor — مرحلة متأخرة/إجرائية، قيمة استحواذ محدودة عادةً.";
    nextActionAr = hasEarlyEvent
      ? "راجع السجل الزمني؛ التواصل اختياري حسب الأصول المتبقية."
      : "إبقاء الحالة تحت المراقبة دون إجراء فوري.";
  }

  const headlineAr = latest
    ? `آخر Bekanntmachung: ${phaseDe}.`
    : `التصنيف الحالي: ${phaseDe}.`;

  return { headlineAr, statusAr, relevanceAr, nextActionAr, riskFlagsAr };
}

/* ------------------------------------------------------------------ */
/* PHASE 0048 — separate "company activity" from "insolvency case"      */
/* ------------------------------------------------------------------ */

/** Phrases signalling that a real business activity / sector is described. */
const ACTIVITY_POSITIVE =
  /(تعمل\s+في|تنشط\s+في|متخصص|في\s+مجال|في\s+قطاع|تقدّم|تقدم|تُقدّم|خدمات|منتجات|تجارة|صناعة|مطاعم|ضيافة|مخبوزات|مخبز|رعاية|بناء|نقل|عقار|tätig\s+(in|im)|Branche|Dienstleistung|Handel|Produkt|Gastronomie|Bäckerei)/i;

/** Phrases signalling the text is NOT an activity description (insolvency/meta). */
const ACTIVITY_UNKNOWN =
  /(لم\s+يتم\s+تحديد\s+نشاط|لا\s+يمكن\s+تحديد\s+نشاط|نشاط[^.]{0,25}غير\s+(محدد|واضح|معروف)|غير\s+(محدد|واضح|معروف)[^.]{0,25}نشاط|لا\s+توجد\s+(معلومات|بيانات)[^.]{0,40}نشاط|nicht\s+klar\s+identifiziert|keine\s+(klaren|belastbaren)\s+(angaben|informationen)|activity\s+not\s+clearly|no\s+clear\s+information\s+about\s+(its\s+)?(business\s+)?activity)/i;

/**
 * Display-time guard: is this Arabic text a MEANINGFUL company-activity summary
 * (answers "what does the firm do?") rather than an insolvency/registration/
 * no-data blurb? Pure heuristic over structured text — does NOT touch the DB.
 *
 * Meaningful = names a sector/activity AND is not dominated by an
 * "activity unknown" / pure-insolvency-status statement.
 */
export function isMeaningfulCompanyActivitySummary(
  text: string | null | undefined,
  _companyName?: string | null,
): boolean {
  const t = text?.trim();
  if (!t || t.length < 12) return false;
  if (ACTIVITY_UNKNOWN.test(t)) return false;
  return ACTIVITY_POSITIVE.test(t);
}

function fmtDateDe(value: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export interface InsolvencyCaseSummaryInput {
  companyName?: string | null;
  latestPhase: string | null;
  latestAnnouncementType: string | null;
  latestPublicationDate: string | null;
  court: string | null;
  aktenzeichen?: string | null;
  preVerteilung: boolean | null;
  /** True if ANY structured Insolvenzverwalter field is present. */
  hasAdministrator: boolean;
  eventCount?: number;
}

/**
 * Deterministic 2–4 sentence Arabic summary of the INSOLVENCY case (what the
 * latest Bekanntmachung means operationally) — NOT the company's activity.
 * German legal terms stay in German. No AI, no invented numbers.
 */
export function buildArabicInsolvencyCaseSummary(
  input: InsolvencyCaseSummaryInput,
): string {
  const phase = input.latestPhase;
  // Prefer the actual Bekanntmachung type hint (e.g. "Anordnung") for the label.
  const typeLabel =
    input.latestAnnouncementType?.trim() ||
    describeAnnouncementTypeDe(phase, input.latestAnnouncementType);
  const date = fmtDateDe(input.latestPublicationDate);
  const pre = input.preVerteilung ?? (phase ? PRE_VERTEILUNG.has(phase) : null);

  const where = [
    date ? `بتاريخ ${date}` : null,
    input.court ? `أمام ${input.court}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const whereSuffix = where ? " " + where : "";

  // Late-stage / monitor — keep it very short.
  if (pre === false && phase && phase !== "unknown") {
    return "هذه Bekanntmachung تبدو مرحلة متأخرة أو إجرائية. غالبًا تُعامل كـ Monitor وليست أولوية إلا إذا ظهرت معلومات أصول مهمة.";
  }

  // Unknown phase.
  if (phase === "unknown" || phase === null) {
    return `هذه Bekanntmachung${typeLabel ? " من نوع " + typeLabel : ""}${whereSuffix}. الطور غير مصنّف بدقة، ويلزم فحص يدوي قبل أي إجراء.`;
  }

  // Eröffnung — appointment is normal here, but stay admin-conditional.
  if (phase === "eroeffnung") {
    const base = "هذه Bekanntmachung تعلن Eröffnung des Insolvenzverfahrens.";
    return input.hasAdministrator
      ? `${base} توجد بيانات منظمة عن Insolvenzverwalter، لذلك يمكن مراجعة التواصل عند وجود سبب استحواذ واضح.`
      : `${base} لا تظهر بيانات منظمة عن Insolvenzverwalter في السجل الحالي، لذلك يلزم فحص مصدر البيانات قبل التواصل.`;
  }

  // Prüfungstermin — debt-review appointment, not an administrator appointment.
  if (phase === "pruefungstermin") {
    return `هذه Bekanntmachung من نوع Prüfungstermin${whereSuffix}. هذا موعد لفحص الديون ضمن Insolvenzverfahren، ولا يعني وحده وجود تعيين جديد لـ Insolvenzverwalter.`;
  }

  // Other early / pre-Verteilung (Anordnung/Vorläufig, Berichtstermin, Verwertung).
  const s1 = `هذه Bekanntmachung من نوع ${typeLabel}${whereSuffix}.`;
  return input.hasAdministrator
    ? `${s1} الحالة في مرحلة مبكرة قبل Verteilung، وتوجد بيانات منظمة عن Insolvenzverwalter.`
    : `${s1} الحالة في مرحلة مبكرة قبل Verteilung، ولا يذكر الإعلان الحالي بيانات تعيين منظمة لـ Insolvenzverwalter.`;
}

const ADMIN_MISSING_FLAGS = new Set([
  "no_administrator_name",
  "no_administrator_email",
  "no_administrator_phone",
]);

/**
 * Display-time softening of data-quality flags: a missing Insolvenzverwalter is
 * only a real gap when the phase normally carries an appointment (Eröffnung).
 * For other types (Anordnung, Prüfungstermin, Berichtstermin …) the absence is
 * often correct, so the hard "no_administrator_*" flags are collapsed into a
 * single neutral "administrator_not_in_current_bekanntmachung". Pure UI mapping;
 * the underlying DB flags are unchanged.
 */
export function softenMissingDataFlags(
  flags: string[],
  phase: string | null,
): string[] {
  const adminExpected = phase === "eroeffnung";
  if (adminExpected) return flags;

  const out: string[] = [];
  let softened = false;
  for (const f of flags) {
    if (ADMIN_MISSING_FLAGS.has(f)) {
      softened = true;
      continue;
    }
    out.push(f);
  }
  if (softened) out.push("administrator_not_in_current_bekanntmachung");
  return out;
}
