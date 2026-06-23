import { createClient } from "@/lib/supabase/server";

/** One row of swift_v2.v_cockpit_watchlist_internal — safe internal fields only. */
export interface InternalWatchlistRow {
  kind: string;
  watch_id: string;
  subject_id: string | null;
  entity_id: string | null;
  detection_id: string | null;
  status: string | null;
  note: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  display_title: string | null;
  safe_display_label: string | null;
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
  administrator_source: string | null;
  administrator_confidence: string | null;
  handelsregister_status: string | null;
  handelsregister_verified: boolean | null;
  bundesanzeiger_status: string | null;
  financial_data_status: string | null;
  source_quality_flags: string[] | null;
  missing_data_flags: string[] | null;
  outreach_ready: boolean | null;
  outreach_blocked_reason: string | null;
}

export interface InternalWatchlistResult {
  available: boolean;
  rows: InternalWatchlistRow[];
}

const COLUMNS =
  "kind, watch_id, subject_id, entity_id, detection_id, status, note, next_follow_up_at, created_at, updated_at, display_title, safe_display_label, city, bundesland, court, aktenzeichen, latest_publication_date, latest_announcement_type, latest_phase, phase_priority, pre_verteilung_relevance, administrator_name, administrator_email, administrator_phone, administrator_address, administrator_source, administrator_confidence, handelsregister_status, handelsregister_verified, bundesanzeiger_status, financial_data_status, source_quality_flags, missing_data_flags, outreach_ready, outreach_blocked_reason";

/**
 * Reads the internal watchlist enrichment view (CORE PHASE 1/2). Fail-safe: if
 * the view is missing/inaccessible or on any error, returns available:false so
 * the page falls back to the basic watchlist. Read-only.
 */
export async function getInternalWatchlist(): Promise<InternalWatchlistResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_watchlist_internal")
      .select(COLUMNS)
      .order("updated_at", { ascending: false });

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as InternalWatchlistRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}
