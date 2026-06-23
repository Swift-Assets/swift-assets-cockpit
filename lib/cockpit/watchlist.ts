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
