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
