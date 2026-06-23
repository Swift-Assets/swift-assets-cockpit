import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_CANDIDATE_COLUMNS,
  MIN_SEARCH_LENGTH,
  sanitizeSearchTerm,
  WATCHLIST_SELECT_COLUMNS,
  type CompanyCandidate,
  type WatchlistRow,
} from "@/lib/cockpit/watchlist";

/**
 * Loads the current user's watchlist from the RLS-gated view. Read-only.
 * Returns a generic error string (no SQL internals) on failure.
 *
 * Server-only: this module imports the server Supabase client and must never be
 * pulled into a client component.
 */
export async function getMyWatchlist(): Promise<{
  rows: WatchlistRow[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_my_watchlist")
      .select(WATCHLIST_SELECT_COLUMNS)
      .order("updated_at", { ascending: false });

    if (error) {
      return { rows: [], error: "Watchlist konnte nicht geladen werden." };
    }
    return { rows: (data ?? []) as WatchlistRow[], error: null };
  } catch {
    return { rows: [], error: "Watchlist konnte nicht geladen werden." };
  }
}

/**
 * Searches eligible company candidates by name or registry number from the
 * cockpit-safe, RLS-gated view swift_v2.v_cockpit_companies. Read-only,
 * non-sensitive columns only. Returns at most 20 rows.
 */
export async function searchCompanyCandidates(rawQuery: string): Promise<{
  rows: CompanyCandidate[];
  error: string | null;
}> {
  const term = sanitizeSearchTerm(rawQuery);
  if (term.length < MIN_SEARCH_LENGTH) {
    return { rows: [], error: null };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_companies")
      .select(COMPANY_CANDIDATE_COLUMNS)
      .or(`display_name.ilike.*${term}*,registry_number.ilike.*${term}*`)
      .order("display_name", { ascending: true })
      .limit(20);

    if (error) {
      return { rows: [], error: "Suche fehlgeschlagen. Bitte erneut versuchen." };
    }
    return { rows: (data ?? []) as CompanyCandidate[], error: null };
  } catch {
    return { rows: [], error: "Suche fehlgeschlagen. Bitte erneut versuchen." };
  }
}
