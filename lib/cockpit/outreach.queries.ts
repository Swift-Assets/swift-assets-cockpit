import { createClient } from "@/lib/supabase/server";

/** One row of swift_v2.v_cockpit_outreach_drafts — safe outreach draft fields. */
export interface OutreachDraft {
  draft_id: string;
  watch_kind: string | null;
  watch_id: string | null;
  entity_id: string | null;
  detection_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_source: string | null;
  subject: string | null;
  body: string | null;
  language: string | null;
  status: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  event_count: number | null;
  latest_event_at: string | null;
}

export interface OutreachDraftsResult {
  available: boolean;
  rows: OutreachDraft[];
}

const DRAFT_COLUMNS =
  "draft_id, watch_kind, watch_id, entity_id, detection_id, recipient_name, recipient_email, recipient_source, subject, body, language, status, created_by, created_by_name, updated_by, updated_by_name, created_at, updated_at, archived_at, event_count, latest_event_at";

/**
 * Reads outreach drafts from the safe view (CORE PHASE 1). Fail-safe: if the
 * view does not exist yet (migration 0028 not applied) or on any error, returns
 * available:false so the page shows a placeholder. Read-only.
 */
export async function getOutreachDrafts(): Promise<OutreachDraftsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_outreach_drafts")
      .select(DRAFT_COLUMNS)
      .order("updated_at", { ascending: false });

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as OutreachDraft[] };
  } catch {
    return { available: false, rows: [] };
  }
}
