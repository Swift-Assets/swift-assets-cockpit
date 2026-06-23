-- =============================================================================
-- Migration: swift_v2_0025_cockpit_data_coverage_summary
-- Phase 6D — Internal data coverage & source-quality summary (read-only)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Creates a single-row, internal-only aggregate view giving the Cockpit
-- dashboard a dense summary of scraped/enriched data coverage and quality.
--
-- Safety:
--   * SAFE AGGREGATES ONLY: counts, rates, timestamps, safe status labels.
--   * NEVER exposes names, addresses, birth dates, raw announcement text, admin
--     contact details, raw payloads, financial figures, secrets, or SQL errors.
--   * Reads locked base tables, so the view is SECURITY DEFINER
--     (security_invoker = false) — consistent with existing cockpit operational
--     views (v_cockpit_enrichment_jobs, v_cockpit_system_health) — and is gated
--     to ACTIVE cockpit users via a `from gate` (auth.uid() + is_active) clause:
--     non-cockpit / anon callers get ZERO rows.
--   * anon/public revoked; authenticated granted SELECT (gated by the row).
--   * No functions, no DML, no cron, no Edge Functions.
-- =============================================================================

create or replace view swift_v2.v_cockpit_data_coverage_summary
  with (security_invoker = false) as
with gate as (
    select 1 as ok
    from swift_v2.cockpit_user_profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
    limit 1
)
select
    now() as generated_at,

    -- A. Entity coverage --------------------------------------------------
    (select count(*) from swift_v2.portal_entities) as entities_total,
    (select count(*) from swift_v2.portal_entities where entity_type = 'company') as entities_company,
    (select count(*) from swift_v2.portal_entities where entity_type = 'natural_person') as entities_natural_person,
    (select count(*) from swift_v2.portal_entities where entity_type = 'unknown') as entities_unknown_type,
    (select count(*) from swift_v2.portal_entities where data_sensitivity = 'normal') as entities_sensitivity_normal,
    (select count(*) from swift_v2.portal_entities where data_sensitivity is distinct from 'normal') as entities_restricted,
    -- Real public-eligibility gate: company + normal sensitivity + publishable.
    (select count(*) from swift_v2.portal_entities
        where entity_type = 'company' and data_sensitivity = 'normal' and is_portal_publishable) as company_public_eligible,
    (select count(distinct entity_id) from swift_v2.entity_source_links) as entities_with_source_links,
    (select count(*) from swift_v2.portal_entities pe
        where not exists (select 1 from swift_v2.entity_source_links l where l.entity_id = pe.id)) as entities_missing_links,
    (select count(*) from swift_v2.company_cases) as company_cases_total,
    (select count(*) from swift_v2.portal_candidate_cases) as portal_candidate_cases_total,
    (select count(*) from swift_v2.uncertain_cases) as uncertain_cases_total,

    -- B. Insolvenzbekanntmachungen coverage -------------------------------
    (select count(*) from swift_v2.source_neu_insolvenz_announcements) as announcements_total,
    (select max(announcement_date) from swift_v2.source_neu_insolvenz_announcements) as announcements_latest_date,
    (select max(scraped_at) from swift_v2.source_neu_insolvenz_announcements) as announcements_latest_scraped_at,
    (select count(*) from swift_v2.source_neu_insolvenz_announcements where entity_id is not null) as announcements_linked,
    (select count(*) from swift_v2.source_neu_insolvenz_announcements where entity_id is null) as announcements_unlinked,
    (select count(*) from swift_v2.source_neu_insolvenz_announcements where subject_type = 'company') as announcements_company,
    (select count(*) from swift_v2.source_neu_insolvenz_announcements where subject_type = 'natural_person') as announcements_natural_person,

    -- C. Handelsregister enrichment coverage ------------------------------
    (select count(*) from swift_v2.source_handelsregister_records) as hr_records_total,
    (select count(distinct entity_id) from swift_v2.source_handelsregister_records where entity_id is not null) as hr_entities_verified,
    (select count(*) from swift_v2.portal_entities pe
        where pe.entity_type = 'company'
          and not exists (select 1 from swift_v2.source_handelsregister_records h where h.entity_id = pe.id)) as hr_companies_missing,
    (select max(fetched_at) from swift_v2.source_handelsregister_records) as hr_latest_fetched_at,
    round(
        100.0 * (select count(distinct entity_id) from swift_v2.source_handelsregister_records where entity_id is not null)
        / nullif((select count(*) from swift_v2.portal_entities where entity_type = 'company'), 0)
    , 1) as hr_verification_rate,

    -- D. Bundesanzeiger enrichment coverage -------------------------------
    -- The Bundesanzeiger pipeline was permanently retired; no live source.
    'retired'::text as bundesanzeiger_status,

    -- E. AI / enrichment job coverage -------------------------------------
    (select count(*) from swift_v2.enrichment_jobs) as jobs_total,
    (select count(*) from swift_v2.enrichment_jobs where status = 'pending') as jobs_pending,
    (select count(*) from swift_v2.enrichment_jobs where status = 'running') as jobs_running,
    (select count(*) from swift_v2.enrichment_jobs where status = 'done') as jobs_done,
    (select count(*) from swift_v2.enrichment_jobs where status = 'dead_letter') as jobs_dead_letter,
    (select max(created_at) from swift_v2.enrichment_jobs) as jobs_latest_created_at,
    (select max(updated_at) from swift_v2.enrichment_jobs) as jobs_latest_updated_at,

    -- F. Public portal readiness ------------------------------------------
    (select count(*) from swift_v2.portal_candidate_cases where portal_status = 'portal_candidate') as portal_candidates_ready,
    (select count(*) from swift_v2.portal_candidate_cases where portal_status = 'needs_manual_review') as portal_candidates_review,
    -- Privacy invariant: this MUST be 0. A natural person marked 'normal'
    -- sensitivity would be eligible for the company-only public gate — an anomaly.
    (select count(*) from swift_v2.portal_entities
        where entity_type = 'natural_person' and data_sensitivity = 'normal') as natural_person_normal_sensitivity
from gate;

comment on view swift_v2.v_cockpit_data_coverage_summary is
  'Phase 6D: single-row INTERNAL data coverage & source-quality summary for the cockpit dashboard. Safe aggregates only (counts/rates/timestamps/status labels) — never names, addresses, birth dates, raw announcement text, admin contacts, financial figures, raw payloads, or secrets. SECURITY DEFINER + active-cockpit-user gate; anon gets zero rows.';

revoke all on swift_v2.v_cockpit_data_coverage_summary from public;
revoke all on swift_v2.v_cockpit_data_coverage_summary from anon;
grant select on swift_v2.v_cockpit_data_coverage_summary to authenticated;
