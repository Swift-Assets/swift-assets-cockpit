-- =============================================================================
-- Migration: swift_v2_0041_cockpit_dashboard_search_view
-- PHASE 0049 — Internal Dashboard advanced-search source (company cases)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval (PHASE 0049B).
--
-- Purpose
--   One safe, internal row-per-company source for the Dashboard keyword + filter
--   search (keyword, date range, phase, Tätigkeit/Branche, Gericht, Ort). Built on
--   the company-only v_cockpit_companies (no natural-person rows) plus the latest
--   announcement, latest administrator, latest Arabic activity summary, and the
--   derived phase. NEVER exposes raw announcement_text / raw_json / debtor city.
--
-- Access / security
--   * security_invoker = false + active-cockpit-user gate; anon/public = 0 rows.
--   * revoke public/anon; grant select to authenticated only.
--   * Company entities only; never used by the public portal.
--
-- Safety: non-destructive (CREATE OR REPLACE VIEW only).
-- =============================================================================

create or replace view swift_v2.v_cockpit_dashboard_search_internal
  with (security_invoker = false) as
select
    vc.entity_id,
    vc.display_name                                as display_title,
    vc.city                                        as city,
    vc.state                                       as bundesland,
    vc.registry_court                              as registry_court,
    la.court                                       as court,
    la.case_number                                 as aktenzeichen,
    la.announcement_date                           as latest_publication_date,
    la.announcement_type_hint                      as latest_announcement_type,
    swift_v2.fn_cockpit_phase_label(la.announcement_type_hint)    as latest_phase,
    swift_v2.fn_cockpit_phase_priority(la.announcement_type_hint) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(la.announcement_type_hint)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as pre_verteilung_relevance,
    act.summary_ar                                 as company_activity_ar,
    adm.insolvency_administrator                   as administrator_name,
    adm.insolvency_admin_email                     as administrator_email,
    adm.insolvency_admin_firm                      as administrator_firm,
    (adm.insolvency_administrator is not null or adm.insolvency_admin_email is not null) as has_administrator,
    vc.first_seen_at,
    vc.last_seen_at
from swift_v2.v_cockpit_companies vc
left join lateral (
    select a.court, a.case_number, a.announcement_type_hint, a.announcement_date
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = vc.entity_id
    order by a.announcement_date desc nulls last, a.scraped_at desc nulls last
    limit 1
) la on true
left join lateral (
    select a.insolvency_administrator, a.insolvency_admin_email, a.insolvency_admin_firm
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = vc.entity_id
      and (a.insolvency_admin_email is not null or a.insolvency_administrator is not null)
    order by a.announcement_date desc nulls last
    limit 1
) adm on true
left join lateral (
    select e.summary_ar
    from swift_v2.entity_ai_company_enrichment e
    where e.entity_id = vc.entity_id
      and nullif(btrim(e.summary_ar), '') is not null
    order by e.generated_at desc nulls last, e.created_at desc nulls last
    limit 1
) act on true
where exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
);

comment on view swift_v2.v_cockpit_dashboard_search_internal is
  'PHASE 0049: internal Dashboard search over company cases for active cockpit users (anon = 0 rows). Safe structured fields + Arabic activity summary + derived phase; NEVER raw announcement_text/raw_json/debtor city. Company entities only; never used by the public portal.';

revoke all on swift_v2.v_cockpit_dashboard_search_internal from public, anon;
grant select on swift_v2.v_cockpit_dashboard_search_internal to authenticated;
