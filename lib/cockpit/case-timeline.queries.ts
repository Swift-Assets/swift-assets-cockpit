import { createClient } from "@/lib/supabase/server";

/**
 * One Bekanntmachung event from swift_v2.v_cockpit_case_timeline_internal
 * (migration 0038, repo-only / not yet applied). Safe structured fields only —
 * NEVER raw announcement_text / raw_json / debtor name or city.
 *
 * Server-only: imports the server Supabase client; never import into a client
 * component (use `import type` for the types only).
 */
export interface CaseTimelineEvent {
  id: string;
  entityId: string | null;
  publicationDate: string | null;
  court: string | null;
  aktenzeichen: string | null;
  announcementType: string | null;
  insolvencyPhase: string | null;
  phasePriority: string | null;
  isPreVerteilung: boolean | null;
  openingDate: string | null;
  claimsDeadline: string | null;
  administratorName: string | null;
  administratorEmail: string | null;
  administratorPhone: string | null;
  administratorAddress: string | null;
  hasAnnouncementText: boolean | null;
}

interface TimelineViewRow {
  event_id: string;
  entity_id: string | null;
  publication_date: string | null;
  court: string | null;
  aktenzeichen: string | null;
  announcement_type: string | null;
  insolvency_phase: string | null;
  phase_priority: string | null;
  is_pre_verteilung: boolean | null;
  opening_date: string | null;
  claims_deadline: string | null;
  administrator_name: string | null;
  administrator_email: string | null;
  administrator_phone: string | null;
  administrator_address: string | null;
  has_announcement_text: boolean | null;
}

const COLUMNS =
  "event_id, entity_id, publication_date, court, aktenzeichen, announcement_type, insolvency_phase, phase_priority, is_pre_verteilung, opening_date, claims_deadline, administrator_name, administrator_email, administrator_phone, administrator_address, has_announcement_text";

const MAX_EVENTS_PER_CASE = 20;

function toEvent(r: TimelineViewRow): CaseTimelineEvent {
  return {
    id: r.event_id,
    entityId: r.entity_id,
    publicationDate: r.publication_date,
    court: r.court,
    aktenzeichen: r.aktenzeichen,
    announcementType: r.announcement_type,
    insolvencyPhase: r.insolvency_phase,
    phasePriority: r.phase_priority,
    isPreVerteilung: r.is_pre_verteilung,
    openingDate: r.opening_date,
    claimsDeadline: r.claims_deadline,
    administratorName: r.administrator_name,
    administratorEmail: r.administrator_email,
    administratorPhone: r.administrator_phone,
    administratorAddress: r.administrator_address,
    hasAnnouncementText: r.has_announcement_text,
  };
}

/**
 * Batch-loads timeline events for the given entity IDs in one (chunked) query —
 * no N+1. Returns a plain Record (entity_id → events, ascending by date) so it
 * can be passed to client components. Read-only and fail-safe: if the view is
 * absent (migration 0038 not yet applied) or on any error, returns {} so the UI
 * shows a clean fallback. Runs under the caller's RLS session.
 */
export async function getCaseTimelineByEntityId(
  entityIds: (string | null)[],
): Promise<Record<string, CaseTimelineEvent[]>> {
  const ids = Array.from(
    new Set(entityIds.filter((id): id is string => Boolean(id))),
  );
  if (ids.length === 0) return {};

  const CHUNK = 200;
  try {
    const supabase = await createClient();
    const grouped: Record<string, CaseTimelineEvent[]> = {};

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("v_cockpit_case_timeline_internal")
        .select(COLUMNS)
        .in("entity_id", slice);
      if (error) return {};
      for (const row of (data ?? []) as TimelineViewRow[]) {
        if (!row.entity_id) continue;
        (grouped[row.entity_id] ??= []).push(toEvent(row));
      }
    }

    // Sort each case ascending by publication date; cap per case.
    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key]
        .sort((a, b) => {
          const ta = a.publicationDate ? Date.parse(a.publicationDate) : 0;
          const tb = b.publicationDate ? Date.parse(b.publicationDate) : 0;
          return ta - tb;
        })
        .slice(0, MAX_EVENTS_PER_CASE);
    }

    return grouped;
  } catch {
    return {};
  }
}
