import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/cockpit/watchlist";

/**
 * One row of swift_v2.v_cockpit_dashboard_search_internal (migration 0041,
 * repo-only / not yet applied). Company cases only; safe structured fields +
 * Arabic activity summary. NEVER raw announcement_text / raw_json / debtor city.
 *
 * Server-only module (imports the server Supabase client).
 */
export interface DashboardSearchRow {
  entity_id: string;
  display_title: string | null;
  city: string | null;
  bundesland: string | null;
  court: string | null;
  aktenzeichen: string | null;
  latest_publication_date: string | null;
  latest_announcement_type: string | null;
  latest_phase: string | null;
  phase_priority: string | null;
  pre_verteilung_relevance: boolean | null;
  company_activity_ar: string | null;
  administrator_name: string | null;
  administrator_email: string | null;
  administrator_firm: string | null;
  has_administrator: boolean | null;
}

export interface DashboardSearchFilters {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  phase?: string;
  activity?: string;
  court?: string;
  city?: string;
}

export interface DashboardSearchResult {
  available: boolean;
  /** True when at least one filter was supplied (otherwise no query is run). */
  active: boolean;
  rows: DashboardSearchRow[];
  count: number | null;
  limit: number;
}

const COLUMNS =
  "entity_id, display_title, city, bundesland, court, aktenzeichen, latest_publication_date, latest_announcement_type, latest_phase, phase_priority, pre_verteilung_relevance, company_activity_ar, administrator_name, administrator_email, administrator_firm, has_administrator";

const LIMIT = 200;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Escapes the PostgREST or()/ilike grammar for a single term. */
function ilikeTerm(raw: string): string {
  return sanitizeSearchTerm(raw);
}

function hasAnyFilter(f: DashboardSearchFilters): boolean {
  return Boolean(
    (f.q && f.q.trim()) ||
      (f.dateFrom && ISO_DATE.test(f.dateFrom)) ||
      (f.dateTo && ISO_DATE.test(f.dateTo)) ||
      (f.phase && f.phase !== "all") ||
      (f.activity && f.activity.trim()) ||
      (f.court && f.court.trim()) ||
      (f.city && f.city.trim()),
  );
}

/**
 * Dashboard advanced search over company cases. Filters combine with AND.
 * Keyword (q) searches across safe structured fields + the Arabic activity
 * summary. Read-only, capped at 200, fail-safe (available:false if the view is
 * absent — migration 0041 — or on any error). Runs under the caller's RLS.
 */
export async function searchDashboard(
  filters: DashboardSearchFilters,
): Promise<DashboardSearchResult> {
  const active = hasAnyFilter(filters);
  if (!active) {
    return { available: true, active: false, rows: [], count: 0, limit: LIMIT };
  }
  try {
    const supabase = await createClient();
    let query = supabase
      .from("v_cockpit_dashboard_search_internal")
      .select(COLUMNS, { count: "exact" });

    const q = filters.q ? ilikeTerm(filters.q) : "";
    if (q.length >= 2) {
      query = query.or(
        [
          `display_title.ilike.*${q}*`,
          `aktenzeichen.ilike.*${q}*`,
          `court.ilike.*${q}*`,
          `city.ilike.*${q}*`,
          `bundesland.ilike.*${q}*`,
          `administrator_name.ilike.*${q}*`,
          `administrator_email.ilike.*${q}*`,
          `administrator_firm.ilike.*${q}*`,
          `company_activity_ar.ilike.*${q}*`,
        ].join(","),
      );
    }
    if (filters.phase && filters.phase !== "all") {
      query = query.eq("latest_phase", filters.phase);
    }
    if (filters.dateFrom && ISO_DATE.test(filters.dateFrom)) {
      query = query.gte("latest_publication_date", filters.dateFrom);
    }
    if (filters.dateTo && ISO_DATE.test(filters.dateTo)) {
      query = query.lte("latest_publication_date", filters.dateTo);
    }
    if (filters.activity && ilikeTerm(filters.activity).length >= 2) {
      const a = ilikeTerm(filters.activity);
      query = query.or(`company_activity_ar.ilike.*${a}*,display_title.ilike.*${a}*`);
    }
    if (filters.court && ilikeTerm(filters.court).length >= 2) {
      query = query.ilike("court", `*${ilikeTerm(filters.court)}*`);
    }
    if (filters.city && ilikeTerm(filters.city).length >= 2) {
      query = query.ilike("city", `*${ilikeTerm(filters.city)}*`);
    }

    const { data, error, count } = await query
      .order("latest_publication_date", { ascending: false, nullsFirst: false })
      .limit(LIMIT);

    if (error) return { available: false, active, rows: [], count: null, limit: LIMIT };
    return {
      available: true,
      active,
      rows: (data ?? []) as DashboardSearchRow[],
      count: typeof count === "number" ? count : null,
      limit: LIMIT,
    };
  } catch {
    return { available: false, active, rows: [], count: null, limit: LIMIT };
  }
}
