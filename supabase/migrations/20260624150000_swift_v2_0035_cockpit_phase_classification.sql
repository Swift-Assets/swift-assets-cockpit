-- =============================================================================
-- Migration: swift_v2_0035_cockpit_phase_classification
-- PHASE 0037 — Phase classification root fix
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Purpose
--   Reduce the number of cases shown as Phase = "Unbekannt" (unknown) by closing
--   two real gaps in the DB-level phase classifier (fn_cockpit_phase_label):
--     * "Restschuldbefreiung"      (residual-debt discharge)   -> restschuldbefreiung
--     * "Vergütungsfestsetzung"    (administrator-fee fixing)   -> verguetungsfestsetzung
--
--   These two announcement_type_hint values currently fall through to 'unknown'.
--   Read-only diagnostics against production (SELECT only) measured the impact on
--   the latest-announcement-per-case set that drives the inbox:
--     * Restschuldbefreiung   -> ~6,127 cases reclassified out of 'unknown'
--     * Vergütungsfestsetzung -> ~  884 cases reclassified out of 'unknown'
--   Residual 'unknown' after this change (~10,249 cases) is caused by a NULL
--   announcement_type_hint upstream ingestion gap, which this migration does NOT
--   attempt to fix (see docs/phase-classification-backfill.md for the proposed,
--   not-yet-executed backfill plan).
--
-- Why these two phases are LOW-PRIORITY ("monitor"), not acquisition-window:
--   Both occur LATE in / after the proceeding, well past the pre-Verteilung
--   acquisition window where verwertbare Vermögenswerte are realistically still
--   available:
--     * Restschuldbefreiung is the residual-debt-discharge stage of a (usually
--       natural-person / consumer) insolvency — the estate has already been
--       administered and distributed; there are no assets left to acquire.
--     * Vergütungsfestsetzung merely fixes the administrator's remuneration — an
--       administrative court act that signals the proceeding is winding down.
--   They are therefore classified 'monitor' (track for completeness, but outside
--   the active acquisition focus), consistent with schlussverteilung / aufhebung /
--   einstellung_mangels_masse. They are deliberately NOT added to the
--   pre_verteilung_relevance set ('vorlaeufig','eroeffnung','berichtstermin',
--   'pruefungstermin','verwertung').
--
-- Safety
--   * Non-destructive: CREATE OR REPLACE FUNCTION only. No DROP, no data writes,
--     no ALTER on tables, no view changes, no RLS / grant weakening.
--   * Function signatures are unchanged, so dependent views
--     (v_cockpit_watchlist_internal, v_cockpit_acquisition_inbox) keep working
--     without modification and automatically benefit from the new mappings.
--   * Mirrors lib/cockpit/phase.ts (kept in sync in the same commit).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Phase label — add Restschuldbefreiung + Vergütungsfestsetzung mappings.
--    New WHEN clauses are appended after the existing announcement_type clauses
--    and before the coarse phase-hint fallback / final 'unknown'. They cannot
--    shadow (or be shadowed by) any existing clause: neither term is a substring
--    of, nor contains, the earlier patterns (verteilung/verwertung/etc.).
-- ---------------------------------------------------------------------------
create or replace function swift_v2.fn_cockpit_phase_label(
    p_announcement_type text, p_phase_hint text default null
) returns text language sql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
  select case
    when coalesce(p_announcement_type,'') ~* '(vorläufig|vorlaeufig|anordnung|sicherungsma)' then 'vorlaeufig'
    when coalesce(p_announcement_type,'') ~* '(eröffnung|eroeffnung|eröffnet|eroeffnet)' then 'eroeffnung'
    when coalesce(p_announcement_type,'') ~* 'berichtstermin' then 'berichtstermin'
    when coalesce(p_announcement_type,'') ~* '(prüfungstermin|pruefungstermin)' then 'pruefungstermin'
    when coalesce(p_announcement_type,'') ~* '(verwertung|masseverwertung)' then 'verwertung'
    when coalesce(p_announcement_type,'') ~* '(schlussverteilung|schlusstermin)' then 'schlussverteilung'
    when coalesce(p_announcement_type,'') ~* 'verteilung' then 'verteilung'
    when coalesce(p_announcement_type,'') ~* 'aufhebung' then 'aufhebung'
    when coalesce(p_announcement_type,'') ~* '(einstellung|mangels masse|masseunzulänglich|masseunzulaenglich)' then 'einstellung_mangels_masse'
    -- NEW (0037): late-stage / administrative announcement types that previously
    -- fell through to 'unknown'. Both are post-/late-proceeding -> low priority.
    when coalesce(p_announcement_type,'') ~* 'restschuldbefreiung' then 'restschuldbefreiung'
    when coalesce(p_announcement_type,'') ~* '(vergütungsfestsetzung|verguetungsfestsetzung|vergütung|verguetung)' then 'verguetungsfestsetzung'
    -- fall back to coarse phase hint (v_entity_insolvency_phase.phase)
    when p_phase_hint = 'preliminary_administration' then 'vorlaeufig'
    when p_phase_hint = 'opening' then 'eroeffnung'
    when p_phase_hint = 'administrator_appointed' then 'eroeffnung'
    when p_phase_hint = 'late_stage' then 'verteilung'
    when p_phase_hint = 'masseunzulaenglichkeit' then 'einstellung_mangels_masse'
    else 'unknown'
  end;
$$;
revoke all on function swift_v2.fn_cockpit_phase_label(text,text) from public;
grant execute on function swift_v2.fn_cockpit_phase_label(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Phase priority — both new labels are 'monitor' (late / administrative,
--    outside the active acquisition window). Mirrors schlussverteilung etc.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.fn_cockpit_phase_priority(
    p_announcement_type text, p_document_text text default null
) returns text language sql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
  select case swift_v2.fn_cockpit_phase_label(p_announcement_type, p_document_text)
    when 'vorlaeufig' then 'high'
    when 'eroeffnung' then 'high'
    when 'berichtstermin' then 'high'
    when 'pruefungstermin' then 'high'
    when 'verwertung' then 'high'
    when 'verteilung' then 'low'
    when 'schlussverteilung' then 'monitor'
    when 'aufhebung' then 'monitor'
    when 'einstellung_mangels_masse' then 'monitor'
    -- NEW (0037): late-stage / administrative -> track only.
    when 'restschuldbefreiung' then 'monitor'
    when 'verguetungsfestsetzung' then 'monitor'
    else 'unknown'
  end;
$$;
revoke all on function swift_v2.fn_cockpit_phase_priority(text,text) from public;
grant execute on function swift_v2.fn_cockpit_phase_priority(text,text) to authenticated;
