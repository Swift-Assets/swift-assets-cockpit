import { createClient } from "@/lib/supabase/server";

/**
 * Latest Arabic company-activity description per entity, from the internal view
 * swift_v2.v_cockpit_company_activity (migration 0037). This answers "what does
 * the company do?" and is shown on the card EXTERIOR — distinct from the
 * insolvency/acquisition AI review (summary_ar from v_cockpit_ai_case_reviews),
 * which stays inside expanded details.
 *
 * Server-only: imports the server Supabase client; never import into a client
 * component (use `import type` for the types only).
 */
export interface CompanyActivityRow {
  entity_id: string;
  company_activity_summary_ar: string | null;
  company_activity_source: string | null;
}

export interface CompanyActivityResult {
  available: boolean;
  rows: CompanyActivityRow[];
}

/**
 * Reads all company-activity summaries visible to the caller. Read-only and
 * fail-safe: returns available:false if the view is absent (migration 0037 not
 * applied) or on any error. Runs under the caller's RLS session.
 */
export async function getCompanyActivitySummaries(): Promise<CompanyActivityResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_company_activity")
      .select("entity_id, company_activity_summary_ar, company_activity_source");
    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as CompanyActivityRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}

/**
 * Reads activity summaries ONLY for the given entity IDs (the entities actually
 * present in the current inbox), instead of every summary visible to the user.
 * De-duplicates and chunks the `.in()` filter to keep each request small.
 * Read-only and fail-safe (returns available:false on any error).
 */
export async function getCompanyActivitySummariesForEntities(
  entityIds: (string | null)[],
): Promise<CompanyActivityResult> {
  const ids = Array.from(
    new Set(entityIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return { available: true, rows: [] };

  const CHUNK = 200;
  try {
    const supabase = await createClient();
    const out: CompanyActivityRow[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("v_cockpit_company_activity")
        .select("entity_id, company_activity_summary_ar, company_activity_source")
        .in("entity_id", slice);
      if (error) return { available: false, rows: [] };
      if (data) out.push(...(data as CompanyActivityRow[]));
    }
    return { available: true, rows: out };
  } catch {
    return { available: false, rows: [] };
  }
}

/** Map entity_id → Arabic activity summary, for O(1) lookup when mapping cards. */
export function companyActivityByEntityId(
  rows: CompanyActivityRow[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const text = r.company_activity_summary_ar?.trim();
    if (r.entity_id && text) out[r.entity_id] = text;
  }
  return out;
}
