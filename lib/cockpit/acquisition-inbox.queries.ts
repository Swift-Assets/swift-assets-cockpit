import { createClient } from "@/lib/supabase/server";

/**
 * One row of swift_v2.v_cockpit_acquisition_inbox (PROPOSED — migration 0034,
 * repo-only / not yet applied). Safe internal fields only; no raw text/raw_json/
 * source_snapshot. Nachlass person_name is internal-only (Cockpit), never public.
 */
export interface AcquisitionInboxRow {
  case_key: string;
  kind: "company" | "nachlass";
  source: "new_company" | "new_nachlass" | "watchlist";
  source_id: string | null;
  entity_id: string | null;
  detection_id: string | null;
  watch_id: string | null;
  is_watched: boolean | null;
  watch_status: string | null;
  inbox_status: "neu" | "watching" | "pursuing" | "passed";
  display_title: string | null;
  safe_display_label: string | null;
  person_name: string | null;
  birth_date: string | null;
  city: string | null;
  bundesland: string | null;
  court: string | null;
  aktenzeichen: string | null;
  latest_publication_date: string | null;
  latest_announcement_type: string | null;
  latest_phase: string | null;
  phase_priority: string | null;
  pre_verteilung_relevance: boolean | null;
  administrator_name: string | null;
  administrator_email: string | null;
  administrator_phone: string | null;
  administrator_address: string | null;
  handelsregister_status: string | null;
  bundesanzeiger_status: string | null;
  financial_data_status: string | null;
  source_quality_flags: string[] | null;
  missing_data_flags: string[] | null;
  outreach_ready: boolean | null;
  outreach_blocked_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AcquisitionInboxResult {
  available: boolean;
  rows: AcquisitionInboxRow[];
  loadedCount: number;
  totalCount: number | null;
  limit: number;
}

const COLUMNS =
  "case_key, kind, source, source_id, entity_id, detection_id, watch_id, is_watched, watch_status, inbox_status, display_title, safe_display_label, person_name, birth_date, city, bundesland, court, aktenzeichen, latest_publication_date, latest_announcement_type, latest_phase, phase_priority, pre_verteilung_relevance, administrator_name, administrator_email, administrator_phone, administrator_address, handelsregister_status, bundesanzeiger_status, financial_data_status, source_quality_flags, missing_data_flags, outreach_ready, outreach_blocked_reason, created_at, updated_at";

const DEFAULT_LIMIT = 240;
const MIN_LIMIT = 24;
const MAX_LIMIT = 1000;

/** Clamp a requested limit into [MIN_LIMIT, MAX_LIMIT]; fall back to default. */
export function sanitizeInboxLimit(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(n)));
}

/**
 * Reads the unified Acquisition Inbox view with a SERVER-SIDE cap so the page
 * never pulls the full (~21k row) result into memory. Ordered by latest
 * publication date desc and capped to `limit` (default 240, max 1000). Requests
 * an exact total count so the UI can show "geladen X von Y". Fail-safe: returns
 * { available:false, rows:[] } if the view is absent or on any error. Read-only.
 * Runs under the caller's RLS session (auth.uid()).
 */
export async function getAcquisitionInbox(
  options?: { limit?: number },
): Promise<AcquisitionInboxResult> {
  const limit = sanitizeInboxLimit(options?.limit);
  try {
    const supabase = await createClient();
    const { data, error, count } = await supabase
      .from("v_cockpit_acquisition_inbox")
      .select(COLUMNS, { count: "exact" })
      .order("latest_publication_date", { ascending: false, nullsFirst: false })
      .range(0, limit - 1);
    if (error)
      return { available: false, rows: [], loadedCount: 0, totalCount: null, limit };
    const rows = (data ?? []) as AcquisitionInboxRow[];
    return {
      available: true,
      rows,
      loadedCount: rows.length,
      totalCount: typeof count === "number" ? count : null,
      limit,
    };
  } catch {
    return { available: false, rows: [], loadedCount: 0, totalCount: null, limit };
  }
}
