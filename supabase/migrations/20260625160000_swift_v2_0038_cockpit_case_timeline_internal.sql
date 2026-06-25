-- =============================================================================
-- Migration: swift_v2_0038_cockpit_case_timeline_internal
-- PHASE 0045A — Internal Bekanntmachung timeline source for the Cockpit
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval (see PHASE 0045B).
--
-- Purpose
--   Provide a safe, INTERNAL-ONLY source returning the chronological
--   Bekanntmachung events per company entity, so the expanded acquisition card
--   can show a timeline + a deterministic Arabic case summary (built client-side
--   from these structured fields — no AI, no raw text).
--
--   The base table source_neu_insolvenz_announcements is RLS-locked (authenticated
--   has no direct SELECT), so this SECURITY DEFINER view is the safe access path.
--   Avg ~1.09 events/entity, max 5 — small per-case timelines.
--
-- Access / security (mirrors the other internal cockpit views)
--   * security_invoker = false (SECURITY DEFINER) + active-cockpit-user gate;
--     anon / public get 0 rows.
--   * revoke from public, anon; grant select to authenticated only.
--   * Company entities only (entity_id not null) — no Nachlass/natural-person rows.
--
-- Privacy
--   * NEVER selected: announcement_text (raw Bekanntmachung), raw_json,
--     debtor_name, debtor_city, source_url. Only a has_announcement_text boolean.
--   * Administrator contact is a professional contact (already used internally).
--   * Phase / priority / pre-Verteilung are derived via the existing classifier
--     functions (fn_cockpit_phase_label / fn_cockpit_phase_priority).
--
-- Safety: non-destructive. CREATE OR REPLACE VIEW only. No table writes, no DROP,
--   no ALTER TABLE, no RLS changes, no new grants beyond authenticated SELECT.
-- =============================================================================

create or replace view swift_v2.v_cockpit_case_timeline_internal
  with (security_invoker = false) as
select
    a.id                                           as event_id,
    a.entity_id,
    a.announcement_date                            as publication_date,
    a.court                                        as court,
    a.case_number                                  as aktenzeichen,
    a.announcement_type_hint                       as announcement_type,
    swift_v2.fn_cockpit_phase_label(a.announcement_type_hint)    as insolvency_phase,
    swift_v2.fn_cockpit_phase_priority(a.announcement_type_hint) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(a.announcement_type_hint)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as is_pre_verteilung,
    a.opening_date                                 as opening_date,
    a.claims_deadline                              as claims_deadline,
    a.insolvency_administrator                     as administrator_name,
    a.insolvency_admin_email                       as administrator_email,
    a.insolvency_admin_phone                       as administrator_phone,
    a.insolvency_admin_address                     as administrator_address,
    -- raw text is NEVER exposed; only whether it exists.
    (a.announcement_text is not null and length(btrim(a.announcement_text)) > 0) as has_announcement_text
from swift_v2.source_neu_insolvenz_announcements a
where a.entity_id is not null
  and exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
  );

comment on view swift_v2.v_cockpit_case_timeline_internal is
  'PHASE 0045A: internal Bekanntmachung timeline per company entity. Active cockpit users only (anon = 0 rows). Company entities only. Safe structured fields + derived phase/priority/pre_verteilung; NEVER raw announcement_text, raw_json, debtor_name/city. Never used by the public portal.';

revoke all on swift_v2.v_cockpit_case_timeline_internal from public, anon;
grant select on swift_v2.v_cockpit_case_timeline_internal to authenticated;
