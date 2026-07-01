import { createClient } from "@/lib/supabase/server";
import type { Gate } from "@/lib/cockpit/acquisition-relevance";

/**
 * One row of swift_v2.v_cockpit_acquisition_inbox (PROPOSED — migration 0034,
 * repo-only / not yet applied). Safe internal fields only; no raw text/raw_json/
 * source_snapshot. Companies only.
 */
export interface AcquisitionInboxRow {
  case_key: string;
  kind: "company";
  source: "new_company" | "watchlist";
  source_id: string | null;
  entity_id: string | null;
  detection_id: string | null;
  watch_id: string | null;
  is_watched: boolean | null;
  watch_status: string | null;
  inbox_status: "neu" | "watching" | "pursuing" | "passed";
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
  handelsregister_status: string | null;
  bundesanzeiger_status: string | null;
  financial_data_status: string | null;
  source_quality_flags: string[] | null;
  missing_data_flags: string[] | null;
  outreach_ready: boolean | null;
  outreach_blocked_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Company-activity (Gegenstand) — safe view fields appended after updated_at
  // (migration 0046). NULL until the enrichment worker fills them. Never read
  // the raw company_activity_sources table / source_ref / matched_hrb.
  company_activity_ar: string | null;
  company_activity_de: string | null;
  company_activity_source: string | null;
  company_activity_confidence: string | null;
}

export interface AcquisitionInboxResult {
  available: boolean;
  rows: AcquisitionInboxRow[];
  loadedCount: number;
  totalCount: number | null;
  limit: number;
}

/**
 * Applies the Acquisition Gate server-side filter for a bucket onto a PostgREST
 * query builder over v_cockpit_acquisition_inbox. Uses only safe structured
 * fields (kind, inbox_status, source, pre_verteilung_relevance). Centralized so
 * the row loader and the count helper stay in lockstep.
 *
 *  - acquisition : NEW company cases with pre-Verteilung relevance (high value).
 *  - monitor     : NEW company cases WITHOUT pre-Verteilung relevance
 *                  (late-stage / low-value / Unbekannt).
 *  - watchlist   : actively followed cases (watching / pursuing).
 *  - ignored     : passed/ignored cases.
 *  - all         : no extra filter.
 */
interface GateFilterable {
  eq(column: string, value: unknown): this;
  in(column: string, values: readonly unknown[]): this;
}

function applyGateFilter<T extends GateFilterable>(query: T, gate: Gate): T {
  switch (gate) {
    case "acquisition":
      return query
        .eq("kind", "company")
        .eq("inbox_status", "neu")
        .eq("pre_verteilung_relevance", true);
    case "monitor":
      return query
        .eq("kind", "company")
        .eq("inbox_status", "neu")
        .eq("pre_verteilung_relevance", false);
    case "watchlist":
      return query
        .eq("source", "watchlist")
        .in("inbox_status", ["watching", "pursuing"]);
    case "ignored":
      return query.eq("inbox_status", "passed");
    case "all":
    default:
      return query;
  }
}

const COLUMNS =
  "case_key, kind, source, source_id, entity_id, detection_id, watch_id, is_watched, watch_status, inbox_status, display_title, safe_display_label, city, bundesland, court, aktenzeichen, latest_publication_date, latest_announcement_type, latest_phase, phase_priority, pre_verteilung_relevance, administrator_name, administrator_email, administrator_phone, administrator_address, handelsregister_status, bundesanzeiger_status, financial_data_status, source_quality_flags, missing_data_flags, outreach_ready, outreach_blocked_reason, created_at, updated_at, company_activity_ar, company_activity_de, company_activity_source, company_activity_confidence";

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
 * Reads the unified Acquisition Inbox view for one Gate bucket, filtered
 * SERVER-SIDE so the page never pulls the full (~21k row) result into memory.
 * The default gate ("acquisition") returns only NEW, pre-Verteilung-relevant
 * company cases — low-value/late-stage noise stays in the "monitor"/"all" gates.
 * Ordered by latest publication date desc and capped to `limit` (default 240,
 * max 1000) with an exact count so the UI can show "geladen X von Y". Fail-safe:
 * returns { available:false, rows:[] } on any error. Read-only, RLS session.
 */
export async function getAcquisitionInbox(
  options?: { limit?: number; gate?: Gate; onlyArabic?: boolean },
): Promise<AcquisitionInboxResult> {
  const limit = sanitizeInboxLimit(options?.limit);
  const gate: Gate = options?.gate ?? "acquisition";
  const onlyArabic = options?.onlyArabic ?? false;
  try {
    const supabase = await createClient();
    const base = supabase
      .from("v_cockpit_acquisition_inbox")
      .select(COLUMNS, { count: "exact" });
    // Server-side filter over the WHOLE dataset (respects the exact count and
    // pagination) — never a client-side .filter() on an already-fetched page.
    const gated = applyGateFilter(base, gate);
    const filtered = onlyArabic
      ? gated.not("company_activity_ar", "is", null)
      : gated;
    const { data, error, count } = await filtered
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

/**
 * Head-only exact counts per gate (no rows fetched), for the tab badges. Runs
 * the count queries in parallel. Fail-safe: any gate that errors yields null.
 * Read-only, RLS session.
 */
export async function getAcquisitionGateCounts(
  gates: Gate[],
): Promise<Record<string, number | null>> {
  try {
    const supabase = await createClient();
    const entries = await Promise.all(
      gates.map(async (gate) => {
        try {
          const base = supabase
            .from("v_cockpit_acquisition_inbox")
            .select("case_key", { count: "exact", head: true });
          const { count, error } = await applyGateFilter(base, gate);
          return [gate, error ? null : (count ?? null)] as const;
        } catch {
          return [gate, null] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/**
 * Exact head-only count (no rows fetched) of cases in a gate that HAVE an Arabic
 * company-activity summary (company_activity_ar IS NOT NULL). Server-side over
 * the whole dataset — powers the "(N)" next to the Arabic-only filter checkbox
 * and lets the number show even while the filter is off. Fail-safe: null on any
 * error. Read-only, RLS session.
 */
export async function getAcquisitionArabicCount(
  gate: Gate,
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const base = supabase
      .from("v_cockpit_acquisition_inbox")
      .select("case_key", { count: "exact", head: true });
    const { count, error } = await applyGateFilter(base, gate).not(
      "company_activity_ar",
      "is",
      null,
    );
    return error ? null : (count ?? null);
  } catch {
    return null;
  }
}
