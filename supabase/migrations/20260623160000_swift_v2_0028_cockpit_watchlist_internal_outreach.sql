-- =============================================================================
-- Migration: swift_v2_0028_cockpit_watchlist_internal_outreach
-- CORE PHASE 1 — Internal watchlist enrichment view + outreach draft backend
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Adds the internal acquisition working layer:
--   * fn_cockpit_phase_label / fn_cockpit_phase_priority   (conservative phase)
--   * v_cockpit_watchlist_internal   (dense internal acquisition view)
--   * cockpit_outreach_drafts / cockpit_outreach_events    (draft storage)
--   * v_cockpit_outreach_drafts      (safe read view)
--   * _cockpit_build_outreach_template + draft lifecycle RPCs
--
-- Safety:
--   * NO email sending, NO external API, NO AI, NO cron, NO Edge Functions.
--   * NO raw announcement text, NO debtor/deceased names, NO birth dates, NO
--     private natural-person addresses. Administrator (Insolvenzverwalter)
--     contact is a professional contact and is exposed internally.
--   * Bundesanzeiger is retired -> status label only; never fabricated figures.
--   * Views are SECURITY DEFINER (read locked base tables) + active-cockpit-user
--     gate; Nachlass rows require nachlass_authorized; anon = 0 rows.
--   * Base tables RLS-on, anon/authenticated revoked; writes via SECURITY
--     DEFINER RPCs (writer role) only. created_by/actor from auth.uid().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Conservative phase classification helpers
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
    else 'unknown'
  end;
$$;
revoke all on function swift_v2.fn_cockpit_phase_priority(text,text) from public;
grant execute on function swift_v2.fn_cockpit_phase_priority(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Internal watchlist enrichment view (per current user's watchlist rows).
--    SECURITY DEFINER + active-user gate; Nachlass requires nachlass_authorized.
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_watchlist_internal
  with (security_invoker = false) as
-- ---- company watchlist ----
select
    'company'::text                                   as kind,
    w.watch_id,
    w.entity_id                                       as subject_id,
    w.entity_id                                       as entity_id,
    null::uuid                                        as detection_id,
    w.status,
    w.note,
    w.next_follow_up_at,
    w.created_at,
    w.updated_at,
    e.display_name                                    as display_title,
    e.display_name                                    as safe_display_label,
    e.city                                            as city,
    e.state                                           as bundesland,
    la.court                                          as court,
    la.case_number                                    as aktenzeichen,
    la.announcement_date                              as latest_publication_date,
    la.announcement_type_hint                         as latest_announcement_type,
    swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, ph.phase) as latest_phase,
    swift_v2.fn_cockpit_phase_priority(la.announcement_type_hint, ph.phase) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, ph.phase)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as pre_verteilung_relevance,
    adm.insolvency_administrator                      as administrator_name,
    adm.insolvency_admin_email                        as administrator_email,
    adm.insolvency_admin_phone                        as administrator_phone,
    adm.insolvency_admin_address                      as administrator_address,
    case when adm.insolvency_administrator is not null or adm.insolvency_admin_email is not null
         then 'neu_insolvenz_announcement' else null end as administrator_source,
    null::text                                        as administrator_confidence,
    case when coalesce(hr.has_hr,false) then 'verified' else 'missing' end as handelsregister_status,
    coalesce(hr.has_hr,false)                         as handelsregister_verified,
    'retired'::text                                   as bundesanzeiger_status,
    'unavailable'::text                               as financial_data_status,
    array_remove(array[
        case when adm.insolvency_admin_email is not null then 'has_administrator_email' end,
        case when coalesce(hr.has_hr,false) then 'handelsregister_verified' end,
        case when la.case_number is not null then 'has_aktenzeichen' end
    ], null)                                          as source_quality_flags,
    array_remove(array[
        case when adm.insolvency_admin_email is null then 'no_administrator_email' end,
        case when adm.insolvency_administrator is null then 'no_administrator_name' end,
        case when la.court is null then 'no_court' end,
        case when la.case_number is null then 'no_aktenzeichen' end,
        case when not coalesce(hr.has_hr,false) then 'handelsregister_missing' end
    ], null)                                          as missing_data_flags,
    (adm.insolvency_admin_email is not null and (la.court is not null or la.case_number is not null)) as outreach_ready,
    case
        when adm.insolvency_admin_email is null then 'missing_recipient_email'
        when la.court is null and la.case_number is null then 'missing_case_reference'
        else null
    end                                               as outreach_blocked_reason
from swift_v2.cockpit_company_watchlist w
join swift_v2.portal_entities e on e.id = w.entity_id
left join lateral (
    select p.phase from swift_v2.v_entity_insolvency_phase p
    where p.entity_id = w.entity_id limit 1
) ph on true
left join lateral (
    select a.court, a.case_number, a.announcement_type_hint, a.announcement_date
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = w.entity_id
    order by a.announcement_date desc nulls last, a.scraped_at desc nulls last
    limit 1
) la on true
left join lateral (
    select a.insolvency_administrator, a.insolvency_admin_email,
           a.insolvency_admin_phone, a.insolvency_admin_address
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = w.entity_id
      and (a.insolvency_admin_email is not null or a.insolvency_administrator is not null)
    order by a.announcement_date desc nulls last
    limit 1
) adm on true
left join lateral (
    select true as has_hr from swift_v2.source_handelsregister_records h
    where h.entity_id = w.entity_id limit 1
) hr on true
where w.user_id = (select auth.uid())
  and exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active)

union all

-- ---- nachlass watchlist (only for nachlass_authorized active users) ----
select
    'nachlass'::text                                  as kind,
    w.watch_id,
    w.detection_id                                    as subject_id,
    d.entity_id                                       as entity_id,
    w.detection_id                                    as detection_id,
    w.status,
    w.note,
    w.next_follow_up_at,
    w.created_at,
    w.updated_at,
    null::text                                        as display_title,
    coalesce('Nachlass · Az. ' || la.case_number, 'Nachlassverfahren') as safe_display_label,
    null::text                                        as city,
    null::text                                        as bundesland,
    la.court                                          as court,
    la.case_number                                    as aktenzeichen,
    la.announcement_date                              as latest_publication_date,
    la.announcement_type_hint                         as latest_announcement_type,
    swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, ph.phase) as latest_phase,
    swift_v2.fn_cockpit_phase_priority(la.announcement_type_hint, ph.phase) as phase_priority,
    (swift_v2.fn_cockpit_phase_label(la.announcement_type_hint, ph.phase)
       in ('vorlaeufig','eroeffnung','berichtstermin','pruefungstermin','verwertung')) as pre_verteilung_relevance,
    adm.insolvency_administrator                      as administrator_name,
    adm.insolvency_admin_email                        as administrator_email,
    adm.insolvency_admin_phone                        as administrator_phone,
    adm.insolvency_admin_address                      as administrator_address,
    case when adm.insolvency_administrator is not null or adm.insolvency_admin_email is not null
         then 'neu_insolvenz_announcement' else null end as administrator_source,
    null::text                                        as administrator_confidence,
    'not_applicable'::text                            as handelsregister_status,
    false                                             as handelsregister_verified,
    'retired'::text                                   as bundesanzeiger_status,
    'unavailable'::text                               as financial_data_status,
    array_remove(array[
        case when adm.insolvency_admin_email is not null then 'has_administrator_email' end,
        case when la.case_number is not null then 'has_aktenzeichen' end
    ], null)                                          as source_quality_flags,
    array_remove(array[
        case when adm.insolvency_admin_email is null then 'no_administrator_email' end,
        case when adm.insolvency_administrator is null then 'no_administrator_name' end,
        case when la.court is null then 'no_court' end,
        case when la.case_number is null then 'no_aktenzeichen' end,
        'handelsregister_not_applicable'
    ], null)                                          as missing_data_flags,
    (adm.insolvency_admin_email is not null and (la.court is not null or la.case_number is not null)) as outreach_ready,
    case
        when adm.insolvency_admin_email is null then 'missing_recipient_email'
        when la.court is null and la.case_number is null then 'missing_case_reference'
        else null
    end                                               as outreach_blocked_reason
from swift_v2.cockpit_nachlass_watchlist w
join swift_v2.nachlass_detection_results d on d.detection_id = w.detection_id
left join lateral (
    select p.phase from swift_v2.v_entity_insolvency_phase p
    where p.entity_id = d.entity_id limit 1
) ph on true
left join lateral (
    select a.court, a.case_number, a.announcement_type_hint, a.announcement_date
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = d.entity_id
    order by a.announcement_date desc nulls last, a.scraped_at desc nulls last
    limit 1
) la on true
left join lateral (
    select a.insolvency_administrator, a.insolvency_admin_email,
           a.insolvency_admin_phone, a.insolvency_admin_address
    from swift_v2.source_neu_insolvenz_announcements a
    where a.entity_id = d.entity_id
      and (a.insolvency_admin_email is not null or a.insolvency_administrator is not null)
    order by a.announcement_date desc nulls last
    limit 1
) adm on true
where w.user_id = (select auth.uid())
  and exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active and me.nachlass_authorized);

comment on view swift_v2.v_cockpit_watchlist_internal is
  'CORE PHASE 1: dense internal acquisition view over the current user''s watchlist. Company rows for active cockpit users; Nachlass rows only for nachlass_authorized. No raw announcement text, debtor/deceased names, birth dates, or private addresses (administrator contact only). Bundesanzeiger=retired.';

revoke all on swift_v2.v_cockpit_watchlist_internal from public, anon;
grant select on swift_v2.v_cockpit_watchlist_internal to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Outreach draft storage
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.cockpit_outreach_drafts (
    draft_id        uuid primary key default gen_random_uuid(),
    watch_kind      text not null check (watch_kind in ('company','nachlass')),
    watch_id        uuid,
    entity_id       uuid,
    detection_id    uuid,
    recipient_name  text,
    recipient_email text,
    recipient_source text,
    subject         text not null,
    body            text not null,
    language        text not null default 'de',
    status          text not null default 'draft'
                      check (status in ('draft','ready','archived','sent_external_later')),
    created_by      uuid not null default auth.uid() references auth.users(id),
    updated_by      uuid references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    archived_at     timestamptz,
    metadata        jsonb not null default '{}'::jsonb
);

comment on table swift_v2.cockpit_outreach_drafts is
  'CORE PHASE 1: editable German outreach drafts to insolvency administrators. NO sending, NO SMTP, NO AI prompt/result, NO raw announcement text. Writes via SECURITY DEFINER RPCs only.';

create index if not exists idx_cockpit_outreach_drafts_status on swift_v2.cockpit_outreach_drafts (status);
create index if not exists idx_cockpit_outreach_drafts_watch on swift_v2.cockpit_outreach_drafts (watch_kind, watch_id);

create table if not exists swift_v2.cockpit_outreach_events (
    event_id   uuid primary key default gen_random_uuid(),
    draft_id   uuid not null references swift_v2.cockpit_outreach_drafts(draft_id) on delete cascade,
    actor_id   uuid default auth.uid() references auth.users(id),
    event_type text not null check (event_type in ('created','updated','ready','archived')),
    note       text,
    details    jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_cockpit_outreach_events_draft on swift_v2.cockpit_outreach_events (draft_id);

alter table swift_v2.cockpit_outreach_drafts enable row level security;
alter table swift_v2.cockpit_outreach_events enable row level security;
revoke all on swift_v2.cockpit_outreach_drafts from public, anon, authenticated;
revoke all on swift_v2.cockpit_outreach_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Internal helpers
-- ---------------------------------------------------------------------------
create or replace function swift_v2._cockpit_outreach_event(
    p_draft_id uuid, p_event_type text, p_note text, p_details jsonb
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    insert into swift_v2.cockpit_outreach_events (draft_id, actor_id, event_type, note, details)
    values (p_draft_id, (select auth.uid()), p_event_type, p_note, coalesce(p_details,'{}'::jsonb));
end;
$$;
revoke all on function swift_v2._cockpit_outreach_event(uuid,text,text,jsonb) from public;

-- Loads a draft and enforces access: caller must be an active cockpit user, and
-- Nachlass drafts require nachlass_authorized. Returns the draft row so callers
-- reuse it instead of re-selecting without an authorization check.
create or replace function swift_v2._cockpit_outreach_require_draft_access(
    p_draft_id uuid
) returns swift_v2.cockpit_outreach_drafts
language plpgsql security definer
set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_uid   uuid := (select auth.uid());
    v_draft swift_v2.cockpit_outreach_drafts%rowtype;
begin
    if v_uid is null then raise exception 'not_authenticated'; end if;

    select * into v_draft from swift_v2.cockpit_outreach_drafts where draft_id = p_draft_id;
    if v_draft.draft_id is null then raise exception 'draft_not_found'; end if;

    if not exists (
        select 1 from swift_v2.cockpit_user_profiles p
        where p.user_id = v_uid and p.is_active
    ) then
        raise exception 'no_active_cockpit_profile';
    end if;

    if v_draft.watch_kind = 'nachlass'
       and not exists (
           select 1 from swift_v2.cockpit_user_profiles p
           where p.user_id = v_uid and p.is_active and p.nachlass_authorized
       ) then
        raise exception 'nachlass_not_authorized';
    end if;

    return v_draft;
end;
$$;
revoke all on function swift_v2._cockpit_outreach_require_draft_access(uuid) from public;

-- Builds a safe German outreach subject + body. Returns jsonb {subject, body}.
create or replace function swift_v2._cockpit_build_outreach_template(
    p_kind text, p_label text, p_court text, p_aktenzeichen text, p_admin_name text
) returns jsonb language sql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
  select jsonb_build_object(
    'subject',
      'Anfrage zu verwertbaren Vermögenswerten – '
        || coalesce(nullif(p_label,''), case when p_kind='nachlass' then 'Nachlassinsolvenzverfahren' else 'Insolvenzverfahren' end)
        || coalesce(', Az. ' || nullif(p_aktenzeichen,''), ''),
    'body',
      coalesce('Sehr geehrte(r) ' || nullif(p_admin_name,'') || ',', 'Sehr geehrte Damen und Herren,')
      || E'\n\n'
      || 'wir nehmen Bezug auf das '
      || case when p_kind='nachlass' then 'Nachlassinsolvenzverfahren' else 'Insolvenzverfahren' end
      || coalesce(' betreffend ' || nullif(p_label,''), '')
      || coalesce(' (Az. ' || nullif(p_aktenzeichen,'') || ')', '')
      || coalesce(' beim Amtsgericht ' || nullif(p_court,''), '')
      || '.'
      || E'\n\n'
      || 'Die Swift Assets UG (haftungsbeschränkt) prüft den Erwerb verwertbarer Vermögenswerte '
      || 'aus Insolvenz- und ' || case when p_kind='nachlass' then 'Nachlassmassen' else 'Verfahren' end || '. '
      || 'Wir möchten unverbindlich anfragen, ob bereits eine Inventar- bzw. Vermögensübersicht vorliegt '
      || 'oder zu einem späteren Zeitpunkt verfügbar sein wird.'
      || E'\n\n'
      || 'Von Interesse sind insbesondere Warenbestände, Betriebsausstattung, Maschinen, Fahrzeuge, '
      || 'Domains, Rechte sowie sonstige verwertbare Assets'
      || case when p_kind='nachlass' then ' aus der Nachlassmasse' else '' end || '.'
      || E'\n\n'
      || 'Diese Anfrage stellt ausschließlich eine unverbindliche Interessenbekundung dar. '
      || 'Wir würden uns über Informationen zum weiteren Verfahren, zu Ansprechpartnern sowie über ein '
      || 'etwaiges Exposé oder eine Inventarliste freuen.'
      || E'\n\n'
      || 'Mit freundlichen Grüßen' || E'\n'
      || '[Name]' || E'\n'
      || 'Swift Assets UG (haftungsbeschränkt)' || E'\n'
      || '[E-Mail] · [Telefon]'
  );
$$;
revoke all on function swift_v2._cockpit_build_outreach_template(text,text,text,text,text) from public;

-- ---------------------------------------------------------------------------
-- 5) Draft lifecycle RPCs (writer role: analyst/lead/admin)
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_create_outreach_draft_from_watchlist(
    p_watch_kind text, p_watch_id uuid
) returns uuid language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role  text := swift_v2._cockpit_writer_role();
    v_uid   uuid := (select auth.uid());
    r       swift_v2.v_cockpit_watchlist_internal%rowtype;
    v_tpl   jsonb;
    v_draft uuid;
begin
    if p_watch_kind not in ('company','nachlass') then raise exception 'invalid_kind'; end if;

    if p_watch_kind = 'nachlass'
       and not exists (select 1 from swift_v2.cockpit_user_profiles p
                       where p.user_id = v_uid and p.is_active and p.nachlass_authorized) then
        raise exception 'nachlass_not_authorized';
    end if;

    select * into r from swift_v2.v_cockpit_watchlist_internal
     where kind = p_watch_kind and watch_id = p_watch_id;
    if r.watch_id is null then raise exception 'watchlist_item_not_found'; end if;

    v_tpl := swift_v2._cockpit_build_outreach_template(
        r.kind, r.safe_display_label, r.court, r.aktenzeichen, r.administrator_name);

    insert into swift_v2.cockpit_outreach_drafts
        (watch_kind, watch_id, entity_id, detection_id, recipient_name, recipient_email,
         recipient_source, subject, body, status, created_by)
    values
        (r.kind, r.watch_id, r.entity_id, r.detection_id, r.administrator_name, r.administrator_email,
         r.administrator_source, v_tpl->>'subject', v_tpl->>'body', 'draft', v_uid)
    returning draft_id into v_draft;

    perform swift_v2._cockpit_outreach_event(
        v_draft, 'created', null,
        jsonb_build_object('watch_kind', r.kind, 'has_recipient_email', (r.administrator_email is not null),
                           'outreach_ready', r.outreach_ready, 'actor_role', v_role));
    return v_draft;
end;
$$;

create or replace function swift_v2.cockpit_update_outreach_draft(
    p_draft_id uuid,
    p_subject text default null,
    p_body text default null,
    p_recipient_name text default null,
    p_recipient_email text default null,
    p_status text default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_old  swift_v2.cockpit_outreach_drafts%rowtype;
begin
    -- writer role (above) + draft access incl. Nachlass authorization
    v_old := swift_v2._cockpit_outreach_require_draft_access(p_draft_id);

    if p_status is not null and p_status not in ('draft','ready','archived','sent_external_later') then
        raise exception 'invalid_status';
    end if;
    if p_subject is not null and length(btrim(p_subject)) = 0 then raise exception 'subject_required'; end if;
    if p_body is not null and length(btrim(p_body)) = 0 then raise exception 'body_required'; end if;

    update swift_v2.cockpit_outreach_drafts set
        subject         = coalesce(p_subject, subject),
        body            = coalesce(p_body, body),
        recipient_name  = case when p_recipient_name is not null then p_recipient_name else recipient_name end,
        recipient_email = case when p_recipient_email is not null then p_recipient_email else recipient_email end,
        status          = coalesce(p_status, status),
        archived_at     = case when p_status = 'archived' then now() else archived_at end,
        updated_by      = (select auth.uid()),
        updated_at      = now()
    where draft_id = p_draft_id;

    perform swift_v2._cockpit_outreach_event(
        p_draft_id, case when p_status = 'ready' then 'ready' else 'updated' end, null,
        jsonb_build_object('actor_role', v_role, 'new_status', coalesce(p_status, v_old.status)));
end;
$$;

create or replace function swift_v2.cockpit_mark_outreach_draft_ready(
    p_draft_id uuid
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    perform swift_v2.cockpit_update_outreach_draft(p_draft_id, null, null, null, null, 'ready');
end;
$$;

create or replace function swift_v2.cockpit_archive_outreach_draft(
    p_draft_id uuid, p_note text default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    -- writer role (above) + draft access incl. Nachlass authorization
    perform swift_v2._cockpit_outreach_require_draft_access(p_draft_id);

    update swift_v2.cockpit_outreach_drafts
       set status = 'archived', archived_at = now(), updated_by = (select auth.uid()), updated_at = now()
     where draft_id = p_draft_id;

    perform swift_v2._cockpit_outreach_event(
        p_draft_id, 'archived', p_note, jsonb_build_object('actor_role', v_role));
end;
$$;

revoke all on function swift_v2.cockpit_create_outreach_draft_from_watchlist(text,uuid) from public, anon;
grant execute on function swift_v2.cockpit_create_outreach_draft_from_watchlist(text,uuid) to authenticated;
revoke all on function swift_v2.cockpit_update_outreach_draft(uuid,text,text,text,text,text) from public, anon;
grant execute on function swift_v2.cockpit_update_outreach_draft(uuid,text,text,text,text,text) to authenticated;
revoke all on function swift_v2.cockpit_mark_outreach_draft_ready(uuid) from public, anon;
grant execute on function swift_v2.cockpit_mark_outreach_draft_ready(uuid) to authenticated;
revoke all on function swift_v2.cockpit_archive_outreach_draft(uuid,text) from public, anon;
grant execute on function swift_v2.cockpit_archive_outreach_draft(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Safe outreach read view (team-visible to active cockpit users;
--    Nachlass drafts only for nachlass_authorized; anon = 0 rows)
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_outreach_drafts
  with (security_invoker = false) as
select
    d.draft_id,
    d.watch_kind,
    d.watch_id,
    d.entity_id,
    d.detection_id,
    d.recipient_name,
    d.recipient_email,
    d.recipient_source,
    d.subject,
    d.body,
    d.language,
    d.status,
    d.created_by,
    cp.display_name as created_by_name,
    d.updated_by,
    up.display_name as updated_by_name,
    d.created_at,
    d.updated_at,
    d.archived_at,
    (select count(*) from swift_v2.cockpit_outreach_events ev where ev.draft_id = d.draft_id) as event_count,
    (select max(ev.created_at) from swift_v2.cockpit_outreach_events ev where ev.draft_id = d.draft_id) as latest_event_at
from swift_v2.cockpit_outreach_drafts d
left join swift_v2.cockpit_user_profiles cp on cp.user_id = d.created_by
left join swift_v2.cockpit_user_profiles up on up.user_id = d.updated_by
where exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
      and (d.watch_kind = 'company' or me.nachlass_authorized)
);

comment on view swift_v2.v_cockpit_outreach_drafts is
  'CORE PHASE 1: outreach drafts for active cockpit users (Nachlass drafts only for nachlass_authorized; anon = 0 rows). Safe fields only.';

revoke all on swift_v2.v_cockpit_outreach_drafts from public, anon;
grant select on swift_v2.v_cockpit_outreach_drafts to authenticated;
