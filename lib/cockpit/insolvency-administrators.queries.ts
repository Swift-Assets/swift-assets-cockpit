import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/cockpit/watchlist";

/**
 * One row of swift_v2.v_cockpit_insolvency_administrators_internal (migration
 * 0039, repo-only / not yet applied). Structured Insolvenzverwalter contact
 * fields only — never raw announcement text.
 *
 * Server-only module (imports the server Supabase client).
 */
export interface InsolvencyAdminRow {
  administrator_id: string;
  display_name: string | null;
  firm: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  source_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  latest_cases_count: number | null;
  has_email: boolean | null;
  has_phone: boolean | null;
  has_address: boolean | null;
  has_firm: boolean | null;
}

export interface InsolvencyAdminResult {
  available: boolean;
  rows: InsolvencyAdminRow[];
  total: number | null;
}

const COLUMNS =
  "administrator_id, display_name, firm, email, phone, address, city, postal_code, source_count, first_seen_at, last_seen_at, latest_cases_count, has_email, has_phone, has_address, has_firm";

const LIMIT = 100;

/**
 * Reads the internal Insolvenzverwalter directory. Optional keyword filters by
 * name / firm / email / phone / address / city. Read-only, capped at 100,
 * fail-safe (available:false if the view is absent — migration 0039 — or on any
 * error). `total` is the exact count for the active filter. Runs under RLS.
 */
export async function getInsolvencyAdministrators(
  rawQuery?: string,
  limit: number = LIMIT,
): Promise<InsolvencyAdminResult> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("v_cockpit_insolvency_administrators_internal")
      .select(COLUMNS, { count: "exact" });

    const q = rawQuery ? sanitizeSearchTerm(rawQuery) : "";
    if (q.length >= 2) {
      query = query.or(
        [
          `display_name.ilike.*${q}*`,
          `firm.ilike.*${q}*`,
          `email.ilike.*${q}*`,
          `phone.ilike.*${q}*`,
          `address.ilike.*${q}*`,
          `city.ilike.*${q}*`,
        ].join(","),
      );
    }

    const { data, error, count } = await query
      .order("source_count", { ascending: false, nullsFirst: false })
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) return { available: false, rows: [], total: null };
    return {
      available: true,
      rows: (data ?? []) as InsolvencyAdminRow[],
      total: typeof count === "number" ? count : null,
    };
  } catch {
    return { available: false, rows: [], total: null };
  }
}
