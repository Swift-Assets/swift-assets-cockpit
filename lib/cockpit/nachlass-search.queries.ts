import { createClient } from "@/lib/supabase/server";
import { MIN_SEARCH_LENGTH, sanitizeSearchTerm } from "@/lib/cockpit/watchlist";

/**
 * One row of swift_v2.v_cockpit_nachlass_search_internal (migration 0036,
 * repo-only / not yet applied). Internal Cockpit only: returned only to active
 * cockpit users with nachlass_authorized. Safe fields only — NEVER raw
 * announcement_text / raw_json / source_excerpt / detection_reasoning_ar /
 * debtor_city. `summary_ar` is the cached, backend-generated Arabic AI summary.
 *
 * Server-only: this module imports the server Supabase client and must never be
 * pulled into a client component (use `import type` for the types only).
 */
export interface NachlassCandidate {
  detection_id: string;
  source_announcement_id: string | null;
  person_name: string | null;
  display_title: string | null;
  court: string | null;
  aktenzeichen: string | null;
  announcement_date: string | null;
  announcement_type: string | null;
  signal_score: number | null;
  opportunity_window_start: string | null;
  opportunity_window_end: string | null;
  summary_ar: string | null;
  estate_asset_categories: string[] | null;
  has_announcement_text: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface NachlassSearchResult {
  available: boolean;
  rows: NachlassCandidate[];
  error: string | null;
}

const COLUMNS =
  "detection_id, source_announcement_id, person_name, display_title, court, aktenzeichen, announcement_date, announcement_type, signal_score, opportunity_window_start, opportunity_window_end, summary_ar, estate_asset_categories, has_announcement_text, created_at, updated_at";

/**
 * Searches internal Nachlass candidates from the gated view. Read-only and
 * fail-safe: if the view is missing (migration 0036 not yet applied) or the
 * caller is not nachlass_authorized, returns available:false / empty rows
 * rather than throwing. The view itself enforces the nachlass_authorized gate.
 *
 * The candidate set is small, so an empty/short query lists all candidates
 * (capped); a longer query filters by person name, court, or Aktenzeichen.
 */
export async function searchNachlassCandidates(
  rawQuery: string,
): Promise<NachlassSearchResult> {
  const term = sanitizeSearchTerm(rawQuery);
  try {
    const supabase = await createClient();
    let q = supabase
      .from("v_cockpit_nachlass_search_internal")
      .select(COLUMNS);

    if (term.length >= MIN_SEARCH_LENGTH) {
      q = q.or(
        `person_name.ilike.*${term}*,court.ilike.*${term}*,aktenzeichen.ilike.*${term}*`,
      );
    }

    const { data, error } = await q
      .order("announcement_date", { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) return { available: false, rows: [], error: null };
    return {
      available: true,
      rows: (data ?? []) as NachlassCandidate[],
      error: null,
    };
  } catch {
    return { available: false, rows: [], error: null };
  }
}
