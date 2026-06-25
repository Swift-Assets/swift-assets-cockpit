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
