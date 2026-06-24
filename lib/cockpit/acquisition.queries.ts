import { createClient } from "@/lib/supabase/server";
import {
  isAcquisitionWindow,
  phaseLabel,
  phasePriority,
  type PhaseLabel,
  type PhasePriority,
} from "@/lib/cockpit/phase";

/**
 * Acquisition leads for the dashboard, assembled from safe, authenticated-
 * granted cockpit views ONLY:
 *   - swift_v2.v_cockpit_company_announcements (safe columns only — NEVER
 *     announcement_text or source_url)
 *   - swift_v2.v_cockpit_companies (display name / city)
 *
 * Phase is classified client-side via lib/cockpit/phase (mirrors
 * fn_cockpit_phase_label). No raw text, no raw_json, no PII, no source_snapshot.
 * Fail-safe: any error/missing source returns available:false so the dashboard
 * degrades to a placeholder instead of breaking.
 */
export interface AcquisitionLead {
  entity_id: string;
  announcement_id: string | null;
  company_name: string;
  city: string | null;
  court: string | null;
  case_number: string | null;
  announcement_date: string | null;
  phase: PhaseLabel;
  phase_priority: PhasePriority;
  insolvency_administrator: string | null;
  registry_type: string | null;
  registry_number: string | null;
}

export interface AcquisitionLeadsResult {
  available: boolean;
  rows: AcquisitionLead[];
}

const SAFE_ANNOUNCEMENT_COLUMNS =
  "entity_id, announcement_id, court, case_number, announcement_date, announcement_type_hint, insolvency_administrator, registry_type, registry_number";

/**
 * Returns recent company insolvency leads in the active acquisition window
 * (vorlaeufig / eroeffnung / berichtstermin / pruefungstermin / verwertung),
 * de-duplicated to the latest announcement per company, newest first.
 */
export async function getAcquisitionLeads(
  limit = 25,
): Promise<AcquisitionLeadsResult> {
  try {
    const supabase = await createClient();

    const { data: anns, error: annErr } = await supabase
      .from("v_cockpit_company_announcements")
      .select(SAFE_ANNOUNCEMENT_COLUMNS)
      .order("announcement_date", { ascending: false, nullsFirst: false })
      .limit(800);

    if (annErr || !anns) return { available: false, rows: [] };

    // Keep, per entity, the latest announcement that is in the acquisition
    // window (rows are date-desc). Filtering to the window FIRST means a company
    // whose newest announcement is an untyped/monitor one is still surfaced via
    // its most recent in-window announcement.
    const latestByEntity = new Map<string, (typeof anns)[number]>();
    for (const a of anns) {
      const row = a as { entity_id: string | null; announcement_type_hint: string | null };
      if (!row.entity_id) continue;
      if (!isAcquisitionWindow(phaseLabel(row.announcement_type_hint))) continue;
      if (!latestByEntity.has(row.entity_id)) latestByEntity.set(row.entity_id, a);
    }

    const entityIds = [...latestByEntity.keys()];
    if (entityIds.length === 0) return { available: true, rows: [] };

    // Company display name / city for those entities (safe view).
    const nameById = new Map<string, { name: string; city: string | null }>();
    const { data: companies } = await supabase
      .from("v_cockpit_companies")
      .select("entity_id, display_name, city")
      .in("entity_id", entityIds.slice(0, 500));
    for (const c of companies ?? []) {
      const row = c as { entity_id: string; display_name: string | null; city: string | null };
      nameById.set(row.entity_id, {
        name: row.display_name ?? "Unbenannte Firma",
        city: row.city,
      });
    }

    const leads: AcquisitionLead[] = [];
    for (const [eid, a] of latestByEntity) {
      const row = a as {
        announcement_id: string | null;
        court: string | null;
        case_number: string | null;
        announcement_date: string | null;
        announcement_type_hint: string | null;
        insolvency_administrator: string | null;
        registry_type: string | null;
        registry_number: string | null;
      };
      const phase = phaseLabel(row.announcement_type_hint);
      if (!isAcquisitionWindow(phase)) continue; // dashboard focus only
      const meta = nameById.get(eid);
      leads.push({
        entity_id: eid,
        announcement_id: row.announcement_id,
        company_name: meta?.name ?? "Unbenannte Firma",
        city: meta?.city ?? null,
        court: row.court,
        case_number: row.case_number,
        announcement_date: row.announcement_date,
        phase,
        phase_priority: phasePriority(phase),
        insolvency_administrator: row.insolvency_administrator,
        registry_type: row.registry_type,
        registry_number: row.registry_number,
      });
    }

    leads.sort((a, b) =>
      (b.announcement_date ?? "").localeCompare(a.announcement_date ?? ""),
    );

    return { available: true, rows: leads.slice(0, limit) };
  } catch {
    return { available: false, rows: [] };
  }
}
