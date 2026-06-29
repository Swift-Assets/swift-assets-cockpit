-- =============================================================================
-- Migration: swift_v2_0046_company_activity_sources
-- PHASE 0046 — Company activity (business purpose / Gegenstand) DATABASE FOUNDATION
--
-- STEP 1 of N. This migration ONLY builds the storage + read surface for a
-- per-entity company business activity ("what does this firm do", DE + AR).
-- It POPULATES NOTHING and calls NOTHING external. A later, separate worker
-- (service_role, different repo) will fill swift_v2.company_activity_sources via
-- Firecrawl search + strict HRB/court matching; a later UI step will read the
-- 4 new safe fields appended to v_cockpit_acquisition_inbox onto the card.
--
-- What it does (additive & reversible only):
--   (a) creates table  swift_v2.company_activity_sources  (per-entity, per-source)
--   (b) creates view   swift_v2.v_company_activity_best    (best activity / entity)
--   (c) CREATE OR REPLACE swift_v2.v_cockpit_acquisition_inbox to APPEND 4 activity
--       columns (LEFT JOINed, NULL while the table is empty) — no existing column
--       changes, same security model.
--
-- Safety / scope guarantees:
--   * No source table is dropped or altered: source_neu_insolvenz_announcements,
--     source_handelsregister_records, portal_entities are untouched (the new FK
--     only REFERENCES portal_entities(id); it does not modify it).
--   * No data is deleted anywhere. A clean, commented ROLLBACK block is provided
--     at the bottom (this repo is forward-only — an executable down-file would be
--     replayed as a forward step, so the reversal is documented, not executed).
--   * Mirrors the existing internal-cockpit pattern: SECURITY DEFINER views
--     (security_invoker = false) + active-cockpit-user gate via auth.uid().
--   * New objects are NEVER granted to anon / public / the portal roles. The new
--     base table is RLS-on with all role grants revoked (writes happen later via
--     service_role / a SECURITY DEFINER RPC, exactly like the other cockpit
--     enrichment tables).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (a) Base table: one row per (entity, source) carrying a business activity.
--     Populated later by the enrichment worker. Empty on apply.
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.company_activity_sources (
    id            uuid primary key default gen_random_uuid(),
    entity_id     uuid not null
                    references swift_v2.portal_entities(id) on delete cascade,
    source        text not null
                    check (source in ('handelsregister','unternehmensregister',
                                      'aggregator','insolvenz_announcement','web')),
    activity_de   text,
    activity_ar   text,
    confidence    text
                    check (confidence in ('high','medium','low')),
    source_ref    text,
    matched_hrb   text,
    extracted_at  timestamptz not null default now(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint uq_company_activity_sources_entity_source unique (entity_id, source)
);

comment on table swift_v2.company_activity_sources is
  'PHASE 0046: per-entity company business activity (Gegenstand) in German + Arabic, one row per source. STEP 1 storage only — populated later by an external enrichment worker (service_role) via Firecrawl search + strict HRB/court matching. RLS-on, no role grants (no anon/public/portal). Holds no insolvency text, no raw_json, no private-person data.';

comment on column swift_v2.company_activity_sources.source is
  'Provenance of the activity, in trust-priority order: handelsregister > unternehmensregister > aggregator > insolvenz_announcement > web.';
comment on column swift_v2.company_activity_sources.source_ref is
  'Human-traceable reference for the match, e.g. "AG Muenchen HRB 137100" or the source URL.';
comment on column swift_v2.company_activity_sources.matched_hrb is
  'Registry number used to gate/confirm the identity match against the entity.';

-- entity_id lookup index (the UNIQUE(entity_id, source) already covers entity_id
-- as a leading-column prefix, but an explicit index documents the access path and
-- matches the convention of the other cockpit tables).
create index if not exists idx_company_activity_sources_entity
    on swift_v2.company_activity_sources (entity_id);

-- updated_at maintenance via the consolidated shared trigger fn (see 0045).
drop trigger if exists tg_company_activity_sources_updated_at
    on swift_v2.company_activity_sources;
create trigger tg_company_activity_sources_updated_at
    before update on swift_v2.company_activity_sources
    for each row execute function swift_v2.set_updated_at();

-- Lock down: RLS on, every role grant revoked. No anon/public/portal/authenticated
-- access to the raw table; reads go through the gated view below.
alter table swift_v2.company_activity_sources enable row level security;
revoke all on swift_v2.company_activity_sources from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) Best-activity view: exactly one row per entity, picking the most
--     trustworthy source, then the highest confidence, then the freshest.
--     Internal-only: SECURITY DEFINER + active-cockpit-user gate (anon = 0 rows).
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_company_activity_best
  with (security_invoker = false) as
select distinct on (s.entity_id)
    s.entity_id,
    s.activity_de   as company_activity_de,
    s.activity_ar   as company_activity_ar,
    s.source        as company_activity_source,
    s.confidence    as company_activity_confidence
from swift_v2.company_activity_sources s
where exists (
        select 1 from swift_v2.cockpit_user_profiles me
        where me.user_id = (select auth.uid()) and me.is_active
      )
order by
    s.entity_id,
    case s.source
        when 'handelsregister'        then 1
        when 'unternehmensregister'   then 2
        when 'aggregator'             then 3
        when 'insolvenz_announcement' then 4
        when 'web'                    then 5
        else 6
    end,
    case s.confidence
        when 'high'   then 1
        when 'medium' then 2
        when 'low'    then 3
        else 4
    end,
    s.extracted_at desc nulls last;

comment on view swift_v2.v_company_activity_best is
  'PHASE 0046: best company activity (Gegenstand) per entity — DISTINCT ON entity_id by source priority (handelsregister>unternehmensregister>aggregator>insolvenz_announcement>web), then confidence (high>medium>low), then extracted_at desc. Active cockpit users only (anon = 0 rows). Exposes only entity_id + DE/AR activity + source + confidence. Never used by the public portal.';

revoke all on swift_v2.v_company_activity_best from public, anon;
grant select on swift_v2.v_company_activity_best to authenticated;

-- ---------------------------------------------------------------------------
-- (c) Append the 4 activity fields to the Acquisition Inbox.
--     Reproduces the CURRENT LIVE 2-branch, companies-only definition verbatim
--     (watchlist branch + new_company branch — the Nachlass branch was removed
--     in the 2026-06 companies-only cleanup), and only:
--       * LEFT JOINs v_company_activity_best on entity_id in BOTH branches, and
--       * APPENDS company_activity_ar, _de, _source, _confidence AFTER the
--         current last column (updated_at), identical name/type/order in both.
--     Existing columns, ordering, SECURITY DEFINER and the auth.uid() active-user
--     gate are preserved exactly. While company_activity_sources is empty these
--     4 columns are simply NULL for every row.
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_acquisition_inbox
  with (security_invoker = false) as

-- A) WATCHED cases (companies). Reuses v_cockpit_watchlist_internal, which already
--    enforces ownership, the active-user gate, and exposes only safe fields.
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
    null::text                                           as person_name,
    null::date                                           as birth_date,
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
    wl.updated_at,
    -- appended activity fields (NULL until the enrichment table is populated)
    ca.company_activity_ar,
    ca.company_activity_de,
    ca.company_activity_source,
    ca.company_activity_confidence
from swift_v2.v_cockpit_watchlist_internal wl
left join swift_v2.v_company_activity_best ca on ca.entity_id = wl.entity_id

union all

-- B) NEW company cases: company entities with a recent insolvency announcement
--    that the current user has NOT yet watched.
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
    e.last_seen_at                                       as updated_at,
    -- appended activity fields (NULL until the enrichment table is populated)
    ca.company_activity_ar,
    ca.company_activity_de,
    ca.company_activity_source,
    ca.company_activity_confidence
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
left join swift_v2.v_company_activity_best ca on ca.entity_id = e.entity_id
where exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active)
  and la.announcement_date >= (current_date - 180)
  and not exists (
      select 1 from swift_v2.cockpit_company_watchlist w
      where w.entity_id = e.entity_id and w.user_id = (select auth.uid())
  );

comment on view swift_v2.v_cockpit_acquisition_inbox is
  'PHASE 0046 (was 0035B): unified internal Acquisition Inbox (companies-only; new + watched). Protected internal Cockpit ONLY — security_invoker=false + active-cockpit-user gate. Granted to authenticated only, never anon/public; not used by the public portal. No raw announcement text, raw_json, source_excerpt, source_url, or source_snapshot. Acquisition window: non-watched cases within 180 days; watched cases always included. 0046 appends 4 safe activity fields (company_activity_ar/_de/_source/_confidence) from v_company_activity_best, LEFT JOINed on entity_id (NULL until enrichment runs).';

revoke all on swift_v2.v_cockpit_acquisition_inbox from public, anon;
grant select on swift_v2.v_cockpit_acquisition_inbox to authenticated;

-- =============================================================================
-- POST-APPLY READ-ONLY VALIDATION (run from an authenticated session):
--   select count(*) from swift_v2.v_company_activity_best;            -- 0 (empty)
--   select company_activity_ar, company_activity_de, company_activity_source,
--          company_activity_confidence
--     from swift_v2.v_cockpit_acquisition_inbox limit 5;              -- 4 cols, all NULL
--   select has_table_privilege('anon','swift_v2.company_activity_sources','SELECT'); -- false
--   select has_table_privilege('anon','swift_v2.v_company_activity_best','SELECT');  -- false
-- =============================================================================

-- =============================================================================
-- ROLLBACK (manual; reversible). This repo is forward-only, so the reversal is
-- documented rather than shipped as an executable down-file. To fully revert,
-- run the following as the schema owner:
--
--   -- 1) restore the inbox view WITHOUT the 4 appended activity columns / join
--   --    by re-running migration 0034's body (the pre-0046 live definition):
--   --    \i supabase/migrations/20260624140000_swift_v2_0034_cockpit_acquisition_inbox_view.sql
--   --    (or CREATE OR REPLACE it from the captured pre-0046 pg_get_viewdef).
--
--   -- 2) drop the new read surface + storage (additive objects only):
--   drop view  if exists swift_v2.v_company_activity_best;
--   drop table if exists swift_v2.company_activity_sources;   -- empty in step 1
--
-- No source table, no existing column, and no data is touched by this rollback.
-- =============================================================================
