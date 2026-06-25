-- =============================================================================
-- Migration: swift_v2_0034_cockpit_acquisition_inbox_view
-- PHASE 0035B — Unified internal Acquisition Inbox view (PROPOSAL)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION. Apply only after human review.
--
-- Creates swift_v2.v_cockpit_acquisition_inbox — the future single source for
-- the card-first Acquisition Inbox UI. It unifies, in one normalized safe shape:
--   * new/untriaged company insolvency cases   (source = 'new_company')
--   * new/untriaged Nachlass insolvency cases  (source = 'new_nachlass')
--   * watched cases, company + Nachlass         (source = 'watchlist')
-- and an inbox_status of 'neu' | 'watching' | 'pursuing' | 'passed'.
--
-- ACCESS / PRIVACY (protected internal Cockpit ONLY):
--   * security_invoker = false (runs as owner) + active-cockpit-user gate in
--     every branch; Nachlass branches additionally require nachlass_authorized.
--   * Granted to `authenticated` only. NEVER to anon/public. NOT used by the
--     public portal. Natural-person protections for anon/public are unchanged.
--   * Nachlass person_name is included for INTERNAL case identification and
--     administrator communication (debtor_name from the source announcement),
--     which is operationally necessary and permitted inside the Cockpit. No
--     birth_date column exists anywhere in the schema, so birth_date is
--     null::date (documented gap).
--   * FORBIDDEN fields are never selected: announcement_text, raw_json,
--     source_excerpt, detection_reasoning_ar, source_url, source_snapshot.
--
-- ACQUISITION WINDOW: a non-watched case is included if its latest publication
--   date is within the last 180 days. Watched cases are always included
--   regardless of date (so ignored/`passed` cases stay visible for triage).
-- =============================================================================

create or replace view swift_v2.v_cockpit_acquisition_inbox
  with (security_invoker = false) as

-- ---------------------------------------------------------------------------
-- A) WATCHED cases (company + Nachlass). Reuses v_cockpit_watchlist_internal,
--    which already enforces ownership (user_id = auth.uid()), the active-user
--    gate and Nachlass authorization, and exposes only safe fields. We add the
--    Nachlass person_name via the approved internal source (debtor_name).
-- ---------------------------------------------------------------------------
select
    ('watch:' || wl.kind || ':' || wl.watch_id::text)   as case_key,
    wl.kind,
    'watchlist'::text                                    as source,
    wl.watch_id                                          as source_id,
    wl.entity_id,
    wl.detection_id,
    wl.watch_id,
    true                                                 as is_watched,
    wl.status                                            as watch_status,
    wl.status                                            as inbox_status,
    wl.display_title,
    wl.safe_display_label,
    case when wl.kind = 'nachlass' then np.debtor_name else null end as person_name,
    null::date                                           as birth_date, -- no birth-date column exists in schema
    wl.city,
    wl.bundesland,
    wl.court,
    wl.aktenzeichen,
    wl.latest_publication_date,
    wl.latest_announcement_type,
    wl.latest_phase,
    wl.phase_priority,
    wl.pre_verteilung_relevance,
    wl.administrator_name,
    wl.administrator_email,
    wl.administrator_phone,
    wl.administrator_address,
    wl.handelsregister_status,
    wl.bundesanzeiger_status,
    wl.financial_data_status,
    wl.source_quality_flags,
    wl.missing_data_flags,
    wl.outreach_ready,
    wl.outreach_blocked_reason,
    wl.created_at,
    wl.updated_at
from swift_v2.v_cockpit_watchlist_internal wl
left join lateral (
    select a.debtor_name
    from swift_v2.nachlass_detection_results d
    join swift_v2.raw_insolvency_announcements a on a.id::text = d.source_announcement_id
    where wl.kind = 'nachlass' and d.detection_id = wl.detection_id
    limit 1
) np on true

union all

-- ---------------------------------------------------------------------------
-- B) NEW company cases: company entities with a recent insolvency announcement
--    that the current user has NOT yet watched. Mirrors the company laterals of
--    v_cockpit_watchlist_internal (admin / handelsregister / flags).
-- ---------------------------------------------------------------------------
select
    ('newco:' || e.entity_id::text)                      as case_key,
    'company'::text                                       as kind,
    'new_company'::text                                  as source,
    e.entity_id                                          as source_id,
    e.entity_id,
    null::uuid                                           as detection_id,
    null::uuid                                           as watch_id,
    false                                                as is_watched,
    null::text                                           as watch_status,
    'neu'::text                                          as inbox_status,
    e.display_name                                       as display_title,
    e.display_name                                       as safe_display_label,
    null::text                                           as person_name,
    null::date                                           as birth_date,
    e.city,
    e.state                                              as bundesland,
    la.court,
    la.case_number                                       as aktenzeichen,
    la.announcement_date                                 as latest_publication_date,
    la.announcement_type_hint                            as latest_announcement_type,
    swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, e.latest_phase_inferred) as latest_phase,
    swift_v2.fn_cockpit_phase_priority(la.announcement_type_hint, e.latest_phase_inferred) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, e.latest_phase_inferred)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as pre_verteilung_relevance,
    adm.insolvency_administrator                         as administrator_name,
    adm.insolvency_admin_email                           as administrator_email,
    adm.insolvency_admin_phone                           as administrator_phone,
    adm.insolvency_admin_address                         as administrator_address,
    case when coalesce(hr.has_hr,false) then 'verified' else 'missing' end as handelsregister_status,
    'retired'::text                                      as bundesanzeiger_status,
    'unavailable'::text                                  as financial_data_status,
    array_remove(array[
        case when adm.insolvency_admin_email is not null then 'has_administrator_email' end,
        case when coalesce(hr.has_hr,false) then 'handelsregister_verified' end,
        case when la.case_number is not null then 'has_aktenzeichen' end
    ], null)                                             as source_quality_flags,
    array_remove(array[
        case when adm.insolvency_admin_email is null then 'no_administrator_email' end,
        case when adm.insolvency_administrator is null then 'no_administrator_name' end,
        case when la.court is null then 'no_court' end,
        case when la.case_number is null then 'no_aktenzeichen' end,
        case when not coalesce(hr.has_hr,false) then 'handelsregister_missing' end
    ], null)                                             as missing_data_flags,
    (adm.insolvency_admin_email is not null and (la.court is not null or la.case_number is not null)) as outreach_ready,
    case
        when adm.insolvency_admin_email is null then 'missing_recipient_email'
        when la.court is null and la.case_number is null then 'missing_case_reference'
        else null
    end                                                 as outreach_blocked_reason,
    coalesce(la.announcement_date::timestamptz, e.first_seen_at) as created_at,
    e.last_seen_at                                       as updated_at
from swift_v2.v_cockpit_companies e
left join lateral (
    select a.court, a.case_number, a.announcement_type_hint, a.announcement_date
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = e.entity_id
    order by a.announcement_date desc nulls last, a.scraped_at desc nulls last
    limit 1
) la on true
left join lateral (
    select a.insolvency_administrator, a.insolvency_admin_email,
           a.insolvency_admin_phone, a.insolvency_admin_address
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = e.entity_id
      and (a.insolvency_admin_email is not null or a.insolvency_administrator is not null)
    order by a.announcement_date desc nulls last
    limit 1
) adm on true
left join lateral (
    select true as has_hr from swift_v2.source_handelsregister_records h
    where h.entity_id = e.entity_id limit 1
) hr on true
where exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active)
  and la.announcement_date >= (current_date - 180)
  and not exists (
      select 1 from swift_v2.cockpit_company_watchlist w
      where w.entity_id = e.entity_id and w.user_id = (select auth.uid())
  )

union all

-- ---------------------------------------------------------------------------
-- C) NEW Nachlass cases: detected Nachlass candidates with a recent source
--    announcement that the current user has NOT yet watched. INTERNAL ONLY —
--    requires nachlass_authorized. person_name = debtor_name from the source
--    announcement (no raw text / excerpt / reasoning / raw_json selected).
-- ---------------------------------------------------------------------------
select
    ('newnl:' || d.detection_id::text)                  as case_key,
    'nachlass'::text                                     as kind,
    'new_nachlass'::text                                 as source,
    d.detection_id                                       as source_id,
    d.entity_id,
    d.detection_id,
    null::uuid                                           as watch_id,
    false                                                as is_watched,
    null::text                                           as watch_status,
    'neu'::text                                          as inbox_status,
    null::text                                           as display_title,
    coalesce('Nachlass · Az. ' || a.case_number, 'Nachlassverfahren') as safe_display_label,
    a.debtor_name                                        as person_name,
    null::date                                           as birth_date,
    null::text                                           as city,
    null::text                                           as bundesland,
    a.court,
    a.case_number                                        as aktenzeichen,
    a.announcement_date                                  as latest_publication_date,
    a.announcement_type_hint                             as latest_announcement_type,
    swift_v2.fn_cockpit_phase_label(a.announcement_type_hint, null) as latest_phase,
    swift_v2.fn_cockpit_phase_priority(a.announcement_type_hint, null) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(a.announcement_type_hint, null)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as pre_verteilung_relevance,
    a.insolvency_admin_name                              as administrator_name,
    a.insolvency_admin_email                             as administrator_email,
    a.insolvency_admin_phone                             as administrator_phone,
    null::text                                           as administrator_address,
    'not_applicable'::text                               as handelsregister_status,
    'retired'::text                                      as bundesanzeiger_status,
    'unavailable'::text                                  as financial_data_status,
    array_remove(array[
        case when a.insolvency_admin_email is not null then 'has_administrator_email' end,
        case when a.case_number is not null then 'has_aktenzeichen' end,
        case when a.debtor_name is not null then 'has_person_name' end
    ], null)                                             as source_quality_flags,
    array_remove(array[
        case when a.insolvency_admin_email is null then 'no_administrator_email' end,
        case when a.court is null then 'no_court' end,
        case when a.case_number is null then 'no_aktenzeichen' end,
        'handelsregister_not_applicable'
    ], null)                                             as missing_data_flags,
    (a.insolvency_admin_email is not null and (a.court is not null or a.case_number is not null)) as outreach_ready,
    case
        when a.insolvency_admin_email is null then 'missing_recipient_email'
        when a.court is null and a.case_number is null then 'missing_case_reference'
        else null
    end                                                 as outreach_blocked_reason,
    d.created_at,
    d.updated_at
from swift_v2.nachlass_detection_results d
join swift_v2.raw_insolvency_announcements a on a.id::text = d.source_announcement_id
where coalesce(d.is_nachlass_candidate, false)
  and a.announcement_date >= (current_date - 180)
  and exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active and me.nachlass_authorized)
  and not exists (
      select 1 from swift_v2.cockpit_nachlass_watchlist w
      where w.detection_id = d.detection_id and w.user_id = (select auth.uid())
  );

comment on view swift_v2.v_cockpit_acquisition_inbox is
  'PHASE 0035B: unified internal Acquisition Inbox (company + Nachlass; new/watched). Protected internal Cockpit ONLY — security_invoker=false + active-cockpit-user gate; Nachlass branches require nachlass_authorized. Granted to authenticated only, never anon/public; not used by the public portal. Nachlass person_name (debtor_name) is included for internal case identification/administrator communication; birth_date is null (no source). No raw announcement text, raw_json, source_excerpt, detection_reasoning, source_url, or source_snapshot. Acquisition window: non-watched cases within 180 days; watched cases always included.';

revoke all on swift_v2.v_cockpit_acquisition_inbox from public, anon;
grant select on swift_v2.v_cockpit_acquisition_inbox to authenticated;

-- =============================================================================
-- POST-APPLY READ-ONLY VALIDATION (run from an authenticated session):
--   select source, inbox_status, count(*) from swift_v2.v_cockpit_acquisition_inbox group by 1,2;
--   -- anon must get 0 rows / permission denied; company-only user sees no Nachlass rows.
--   select has_table_privilege('anon','swift_v2.v_cockpit_acquisition_inbox','SELECT'); -- expect false
-- =============================================================================
