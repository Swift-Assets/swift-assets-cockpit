import { createClient } from "@/lib/supabase/server";

/** One row of swift_v2.v_cockpit_ai_case_reviews — safe AI review fields only. */
export interface AiCaseReviewRow {
  review_id: string;
  watch_kind: string | null;
  watch_id: string | null;
  entity_id: string | null;
  detection_id: string | null;
  summary_ar: string | null;
  summary_de: string | null;
  acquisition_score: number | null;
  priority: string | null;
  reasoning_ar: string | null;
  risk_flags: string[] | null;
  recommended_next_action: string | null;
  confidence: string | null;
  model_provider: string | null;
  model_name: string | null;
  status: string | null;
  error_code: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  event_count: number | null;
  latest_event_at: string | null;
}

export interface AiCaseReviewsResult {
  available: boolean;
  rows: AiCaseReviewRow[];
}

const COLUMNS =
  "review_id, watch_kind, watch_id, entity_id, detection_id, summary_ar, summary_de, acquisition_score, priority, reasoning_ar, risk_flags, recommended_next_action, confidence, model_provider, model_name, status, error_code, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at, event_count, latest_event_at";

/**
 * Reads AI case reviews from the safe view (CORE PHASE 5A). Fail-safe: if the
 * view is missing (migration 0029 not applied) or on any error, returns
 * available:false. Read-only.
 */
export async function getAiCaseReviews(): Promise<AiCaseReviewsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_ai_case_reviews")
      .select(COLUMNS)
      .order("updated_at", { ascending: false });

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as AiCaseReviewRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}

/** Key identifying a review's source watch item. */
export function aiReviewKey(
  watchKind: string | null,
  watchId: string | null,
): string {
  return `${watchKind ?? ""}:${watchId ?? ""}`;
}

/**
 * Latest generated review per watch item (kind:watch_id). Prefers status
 * 'generated'; among those, the most recently updated. Returned as a plain
 * record so it can be passed to client components.
 */
export function activeAiReviewByWatchKey(
  rows: AiCaseReviewRow[],
): Record<string, AiCaseReviewRow> {
  const out: Record<string, AiCaseReviewRow> = {};
  for (const r of rows) {
    if (r.status !== "generated") continue;
    const key = aiReviewKey(r.watch_kind, r.watch_id);
    const existing = out[key];
    if (!existing) {
      out[key] = r;
      continue;
    }
    const a = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const b = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
    if (a > b) out[key] = r;
  }
  return out;
}
