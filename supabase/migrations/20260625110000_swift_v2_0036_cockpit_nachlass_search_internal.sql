-- =============================================================================
-- Migration: swift_v2_0036_cockpit_nachlass_search_internal
-- PHASE 0038 — Internal Nachlass search source for the Cockpit
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval (see PHASE 0038B).
--
-- Purpose
--   Provide a safe, INTERNAL-ONLY source for searching Nachlass (estate)
--   insolvency candidates from the Cockpit "Zur Watchlist hinzufügen" panel,
--   so the previously-disabled Nachlass search can be activated.
--
--   The view exposes only the fields the internal search UI needs, plus the
--   ALREADY-GENERATED Arabic AI summary (estate_summary_ar, produced by the
--   backend detection pipeline via set_nachlass_estate_summary). The Cockpit
--   only READS this cached summary — no LLM call and no AI secret live in the
--   frontend app (secrets are Edge-Function-only; see docs/security.md).
--
-- Access / security (mirrors v_cockpit_watchlist_internal Nachlass branch)
--   * security_invoker = false (SECURITY DEFINER): runs as owner, so the
--     WHERE-gate below is the enforcement.
--   * Rows are returned ONLY to an active cockpit user who is nachlass_authorized.
--     anon / public / non-authorized users get 0 rows.
--   * Restricted to is_nachlass_candidate = true (the vetted estate candidates).
--   * revoke from public, anon; grant select to authenticated only.
--   * NEVER used by the public portal — public stays companies-only.
--
-- Privacy
--   * NEVER selected: announcement_text (raw Bekanntmachung), raw_json,
--     source_excerpt, detection_reasoning_ar, debtor_city (private natural-person
--     residence). Only a has_announcement_text boolean is exposed.
--   * person_name (= deceased debtor_name) is exposed INTERNALLY ONLY — it is
--     operationally necessary to identify the estate case and is gated to
--     nachlass_authorized internal users, exactly like v_cockpit_acquisition_inbox.
--
-- Safety
--   * Non-destructive: CREATE OR REPLACE VIEW only. No table writes, no DROP,
--     no ALTER TABLE, no RLS changes, no new grants beyond authenticated SELECT.
-- =============================================================================

create or replace view swift_v2.v_cockpit_nachlass_search_internal
  with (security_invoker = false) as
select
    d.detection_id,
    d.source_announcement_id,
    -- internal-only label: deceased person's name (estate identification).
    r.debtor_name                                   as person_name,
    coalesce(nullif(btrim(r.debtor_name), ''), 'Nachlassverfahren') as display_title,
    r.court                                         as court,
    r.case_number                                   as aktenzeichen,
    r.announcement_date                             as announcement_date,
    r.announcement_type_hint                        as announcement_type,
    d.deceased_estate_signal_score                  as signal_score,
    d.opportunity_window_start,
    d.opportunity_window_end,
    -- existing AI-generated Arabic summary (cached; backend pipeline output).
    d.estate_summary_ar                             as summary_ar,
    d.estate_asset_categories                       as estate_asset_categories,
    -- raw text is NEVER exposed; only whether it exists (for diagnostics/UI hint).
    (r.announcement_text is not null and length(btrim(r.announcement_text)) > 0) as has_announcement_text,
    d.created_at,
    d.updated_at
from swift_v2.nachlass_detection_results d
join swift_v2.raw_insolvency_announcements r on r.id::text = d.source_announcement_id
where d.is_nachlass_candidate
  and exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid())
      and me.is_active
      and me.nachlass_authorized
  );

comment on view swift_v2.v_cockpit_nachlass_search_internal is
  'PHASE 0038: internal Nachlass search source. Active cockpit users with nachlass_authorized only (anon = 0 rows). is_nachlass_candidate only. Exposes the cached Arabic AI summary (estate_summary_ar); NEVER raw announcement_text, raw_json, source_excerpt, detection_reasoning_ar, or debtor_city. person_name is internal-only. Never used by the public portal.';

revoke all on swift_v2.v_cockpit_nachlass_search_internal from public, anon;
grant select on swift_v2.v_cockpit_nachlass_search_internal to authenticated;
