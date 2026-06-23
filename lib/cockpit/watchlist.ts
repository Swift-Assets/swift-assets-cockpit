export type WatchKind = "company" | "nachlass";
export type WatchStatus = "watching" | "pursuing" | "passed";

/**
 * A row of swift_v2.v_cockpit_my_watchlist, limited to the non-sensitive
 * columns this UI is allowed to render.
 *
 * Row → RPC key mapping (confirmed from the view + RPC definitions):
 *  - company  : subject_id  == entity_id    (used as p_subject_id / p_entity_id)
 *  - nachlass : detection_id                (used as p_subject_id / p_detection_id)
 *
 * Sensitive Nachlass fields (nachlass_score, estate_summary_ar,
 * estate_asset_categories) are intentionally NOT selected or exposed here.
 */
export interface WatchlistRow {
  kind: WatchKind;
  watch_id: string;
  subject_id: string | null;
  detection_id: string | null;
  title: string | null;
  city: string | null;
  bundesland: string | null;
  status: string | null;
  note: string | null;
  next_follow_up_at: string | null;
  updated_at: string | null;
}

export const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: "watching", label: "Beobachten" },
  { value: "pursuing", label: "In Prüfung" },
  { value: "passed", label: "Abgelehnt" },
];

export function isWatchStatus(value: string): value is WatchStatus {
  return value === "watching" || value === "pursuing" || value === "passed";
}

export function statusLabel(status: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "—";
}

/** The identifier the write RPCs expect for this row. */
export function rpcSubjectId(row: {
  kind: WatchKind;
  subject_id: string | null;
  detection_id: string | null;
}): string | null {
  return row.kind === "company" ? row.subject_id : row.detection_id;
}

/** Columns selected from the view — non-sensitive only. */
export const WATCHLIST_SELECT_COLUMNS =
  "kind, watch_id, subject_id, detection_id, title, city, bundesland, status, note, next_follow_up_at, updated_at";

/**
 * A safe company candidate for the add flow, sourced from swift_v2.v_cockpit_companies.
 * Only non-sensitive company columns. `entity_id` is the portal_entities.id passed
 * to cockpit_watch_company(p_entity_id).
 */
export interface CompanyCandidate {
  entity_id: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
  registry_court: string | null;
  registry_type: string | null;
  registry_number: string | null;
}

export const COMPANY_CANDIDATE_COLUMNS =
  "entity_id, display_name, city, state, registry_court, registry_type, registry_number";

/** Columns selected from the candidate view — non-sensitive only. */
export const MIN_SEARCH_LENGTH = 2;

/**
 * Sanitizes a free-text search term for safe use inside a PostgREST `or`/`ilike`
 * filter. Strips characters that have meaning in the filter grammar.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .trim()
    .slice(0, 60)
    .replace(/[,()*%:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Client-side filtering & sorting helpers (operate on already-loaded rows)    */
/* -------------------------------------------------------------------------- */

/** Mutually-exclusive follow-up buckets, relative to "now". */
export type FollowUpBucket =
  | "none"
  | "overdue"
  | "today"
  | "this_week"
  | "later";

/** Lower-cases and folds diacritics for accent-insensitive text matching. */
export function normalizedText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Classifies a follow-up timestamp into a bucket relative to `now`.
 * Buckets are mutually exclusive; "this_week" is the remainder of the current
 * Mon–Sun week strictly after today, "later" is beyond it.
 */
export function followUpBucket(
  value: string | null,
  now: Date = new Date(),
): FollowUpBucket {
  if (!value) return "none";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "none";

  const todayStart = startOfDayMs(now);
  const dayMs = 86_400_000;
  const tomorrowStart = todayStart + dayMs;
  const followDay = startOfDayMs(d);

  if (followDay < todayStart) return "overdue";
  if (followDay === todayStart) return "today";

  // Days remaining until (and including) the upcoming Sunday.
  const dow = now.getDay(); // 0 = Sun … 6 = Sat
  const daysUntilSunday = (7 - dow) % 7;
  const weekEndExclusive = tomorrowStart + daysUntilSunday * dayMs;

  return followDay < weekEndExclusive ? "this_week" : "later";
}

export type WatchlistSortKey =
  | "updated_desc"
  | "updated_asc"
  | "followup_asc"
  | "followup_desc"
  | "name_asc"
  | "name_desc";

export const SORT_OPTIONS: { value: WatchlistSortKey; label: string }[] = [
  { value: "updated_desc", label: "Letztes Update: neueste zuerst" },
  { value: "updated_asc", label: "Letztes Update: älteste zuerst" },
  { value: "followup_asc", label: "Follow-up: früheste zuerst" },
  { value: "followup_desc", label: "Follow-up: späteste zuerst" },
  { value: "name_asc", label: "Name: A–Z" },
  { value: "name_desc", label: "Name: Z–A" },
];

function timeOrNull(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Compares two timestamps; null/missing values always sort last. */
function compareTime(
  a: string | null,
  b: string | null,
  direction: "asc" | "desc",
): number {
  const ta = timeOrNull(a);
  const tb = timeOrNull(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return direction === "asc" ? ta - tb : tb - ta;
}

/** Stable comparator for the watchlist sort options. Missing values sort last. */
export function compareWatchlistRows(
  a: WatchlistRow,
  b: WatchlistRow,
  sort: WatchlistSortKey,
): number {
  switch (sort) {
    case "updated_desc":
      return compareTime(a.updated_at, b.updated_at, "desc");
    case "updated_asc":
      return compareTime(a.updated_at, b.updated_at, "asc");
    case "followup_asc":
      return compareTime(a.next_follow_up_at, b.next_follow_up_at, "asc");
    case "followup_desc":
      return compareTime(a.next_follow_up_at, b.next_follow_up_at, "desc");
    case "name_asc":
    case "name_desc": {
      const na = normalizedText(a.title);
      const nb = normalizedText(b.title);
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;
      const cmp = na.localeCompare(nb, "de");
      return sort === "name_asc" ? cmp : -cmp;
    }
    default:
      return 0;
  }
}
