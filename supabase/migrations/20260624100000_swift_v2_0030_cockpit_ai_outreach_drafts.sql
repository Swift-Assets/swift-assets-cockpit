-- =============================================================================
-- Migration: swift_v2_0030_cockpit_ai_outreach_drafts
-- CORE PHASE 6A — AI outreach email draft generation (backend RPCs)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Reuses the existing outreach storage from migration 0028:
--   swift_v2.cockpit_outreach_drafts (incl. its metadata jsonb column),
--   swift_v2.cockpit_outreach_events, swift_v2.v_cockpit_outreach_drafts.
-- NO new table, NO new column, NO destructive change. AI metadata is stored in
-- the existing `metadata` jsonb column (generation_mode/model/etc.).
--
-- Adds:
--   * cockpit_get_outreach_ai_snapshot(text,uuid)
--       -> safe jsonb snapshot for prompt building (access-gated, safe fields).
--   * cockpit_store_ai_outreach_draft(...)
--       -> stores an AI-generated German email as a normal editable draft.
--          Recipient is derived from the authoritative internal view (NOT from
--          the AI output) to prevent hallucinated recipients. Refuses to
--          overwrite an existing active draft unless p_replace_existing = true.
--   * v_cockpit_outreach_drafts recreated with two additive, safe columns
--       (generation_mode, ai_model_name) sourced from metadata.
--
-- Safety:
--   * NO email sending, NO SMTP, NO mailto. NO auto-send. status stays 'draft'.
--   * Snapshot uses ONLY approved safe fields: no raw announcement text, no
--     source excerpt, no detection reasoning, no private natural-person
--     addresses. Administrator (Insolvenzverwalter) contact is a professional
--     contact, exposed internally only.
--   * For Nachlass: the deceased person's NAME is included for case
--     identification (the administrator cannot reliably identify the case
--     otherwise). Sourced as a STRUCTURED column
--     (raw_insolvency_announcements.debtor_name) — never the raw announcement
--     text, excerpt, reasoning, or address. Date of birth is NOT included
--     because no birth-date column exists in the data layer. Still only the
--     safe label is used as display label; no city/address. Requires
--     nachlass_authorized (enforced by the RPC) — non-authorized users never
--     reach this path and the outreach draft view stays gated.
--   * Writes via SECURITY DEFINER RPCs gated by _cockpit_writer_role()
--     (analyst/lead/admin). created_by/actor derived from auth.uid().
--   * Bundesanzeiger=retired -> status label only; never fabricated figures.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Safe AI snapshot for outreach prompt building (access-gated).
--    Mirrors the AI-review snapshot contract but limited to outreach-relevant
--    safe fields. Returns jsonb; raises safe error tokens on access failure.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_get_outreach_ai_snapshot(
    p_watch_kind text, p_watch_id uuid
) returns jsonb language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_uid  uuid := (select auth.uid());
    r      swift_v2.v_cockpit_watchlist_internal%rowtype;
    v_deceased_name text := null;
begin
    if p_watch_kind not in ('company','nachlass') then raise exception 'invalid_kind'; end if;
    if p_watch_kind = 'nachlass'
       and not exists (select 1 from swift_v2.cockpit_user_profiles p
                       where p.user_id = v_uid and p.is_active and p.nachlass_authorized) then
        raise exception 'nachlass_not_authorized';
    end if;

    -- The view enforces ownership (user_id = auth.uid()) + active-user gate +
    -- Nachlass authorization, so a missing row means not-owned/not-authorized.
    select * into r from swift_v2.v_cockpit_watchlist_internal
     where kind = p_watch_kind and watch_id = p_watch_id;
    if r.watch_id is null then raise exception 'watchlist_item_not_found'; end if;

    -- Nachlass identity (INTERNAL only). nachlass_authorized + ownership are
    -- already enforced above, so reaching here means the caller is allowed to
    -- see the deceased person's name for case identification. We read ONLY the
    -- STRUCTURED debtor_name column from the source announcement (the same value
    -- exposed as deceased_name in v_cockpit_nachlass_review_full) — NOT the raw
    -- announcement text, source excerpt, detection reasoning, city, or address.
    -- No date-of-birth column exists in the data layer, so birth date is null.
    if r.kind = 'nachlass' then
        select a.debtor_name into v_deceased_name
        from swift_v2.nachlass_detection_results d
        join swift_v2.raw_insolvency_announcements a on a.id::text = d.source_announcement_id
        where d.detection_id = r.detection_id
        limit 1;
    end if;

    -- SAFE snapshot. No raw text / no address. For Nachlass: name only.
    return jsonb_build_object(
        'kind', r.kind,
        'safe_display_label', r.safe_display_label,
        -- display_title (the real company name) only for company cases.
        'display_title', case when r.kind = 'company' then r.display_title else null end,
        -- deceased_name only for Nachlass (gated above); birth date unavailable.
        'deceased_name', case when r.kind = 'nachlass' then v_deceased_name else null end,
        'deceased_birth_date', null,
        'court', r.court,
        'aktenzeichen', r.aktenzeichen,
        'latest_phase', r.latest_phase,
        'latest_announcement_type', r.latest_announcement_type,
        'latest_publication_date', r.latest_publication_date,
        'administrator_name', r.administrator_name,
        'administrator_email', r.administrator_email,
        'administrator_phone', r.administrator_phone,
        'outreach_ready', r.outreach_ready,
        'outreach_blocked_reason', r.outreach_blocked_reason,
        'missing_data_flags', to_jsonb(r.missing_data_flags),
        'source_quality_flags', to_jsonb(r.source_quality_flags),
        'financial_data_status', r.financial_data_status,
        'bundesanzeiger_status', r.bundesanzeiger_status,
        'handelsregister_status', r.handelsregister_status
    );
end;
$$;
revoke all on function swift_v2.cockpit_get_outreach_ai_snapshot(text,uuid) from public, anon;
grant execute on function swift_v2.cockpit_get_outreach_ai_snapshot(text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1b) Lightweight preflight: does an active (non-archived) draft already exist?
--     Used by the Edge Function to avoid spending AI tokens when generation
--     would be rejected anyway. NOT a substitute for the authoritative
--     duplicate guard inside cockpit_store_ai_outreach_draft (race protection).
--     Same access contract as snapshot/store (writer role + Nachlass auth +
--     ownership via v_cockpit_watchlist_internal).
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_has_active_outreach_draft(
    p_watch_kind text, p_watch_id uuid
) returns boolean language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_uid  uuid := (select auth.uid());
    r      swift_v2.v_cockpit_watchlist_internal%rowtype;
begin
    if p_watch_kind not in ('company','nachlass') then raise exception 'invalid_kind'; end if;
    if p_watch_kind = 'nachlass'
       and not exists (select 1 from swift_v2.cockpit_user_profiles p
                       where p.user_id = v_uid and p.is_active and p.nachlass_authorized) then
        raise exception 'nachlass_not_authorized';
    end if;

    -- Ownership + active-user gate + Nachlass auth enforced by the view.
    select * into r from swift_v2.v_cockpit_watchlist_internal
     where kind = p_watch_kind and watch_id = p_watch_id;
    if r.watch_id is null then raise exception 'watchlist_item_not_found'; end if;

    return exists (
        select 1 from swift_v2.cockpit_outreach_drafts d
        where d.watch_kind = p_watch_kind and d.watch_id = p_watch_id
          and d.status <> 'archived'
    );
end;
$$;
revoke all on function swift_v2.cockpit_has_active_outreach_draft(text,uuid) from public, anon;
grant execute on function swift_v2.cockpit_has_active_outreach_draft(text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Store an AI-generated outreach draft into the existing draft system.
--    Recipient name/email derive from the authoritative internal view, NOT the
--    AI output. Refuses to overwrite an existing active (non-archived) draft
--    unless p_replace_existing = true (then prior active drafts are archived).
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_store_ai_outreach_draft(
    p_watch_kind        text,
    p_watch_id          uuid,
    p_subject           text,
    p_body              text,
    p_language          text default 'de',
    p_ai_model_provider text default null,
    p_ai_model_name     text default null,
    p_ai_prompt_version text default null,
    p_ai_confidence     text default null,
    p_ai_risk_flags     text[] default null,
    p_ai_missing_fields text[] default null,
    p_replace_existing  boolean default false
) returns uuid language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role  text := swift_v2._cockpit_writer_role();
    v_uid   uuid := (select auth.uid());
    r       swift_v2.v_cockpit_watchlist_internal%rowtype;
    v_lang  text := lower(coalesce(nullif(btrim(p_language), ''), 'de'));
    v_meta  jsonb;
    v_draft uuid;
    v_old   uuid;
begin
    if p_watch_kind not in ('company','nachlass') then raise exception 'invalid_kind'; end if;
    if v_lang <> 'de' then raise exception 'invalid_language'; end if;
    if p_subject is null or length(btrim(p_subject)) = 0 then raise exception 'subject_required'; end if;
    if p_body    is null or length(btrim(p_body))    = 0 then raise exception 'body_required';    end if;

    if p_watch_kind = 'nachlass'
       and not exists (select 1 from swift_v2.cockpit_user_profiles p
                       where p.user_id = v_uid and p.is_active and p.nachlass_authorized) then
        raise exception 'nachlass_not_authorized';
    end if;

    -- Authoritative source row (ownership + access enforced by the view).
    select * into r from swift_v2.v_cockpit_watchlist_internal
     where kind = p_watch_kind and watch_id = p_watch_id;
    if r.watch_id is null then raise exception 'watchlist_item_not_found'; end if;

    -- Duplicate guard: an active (non-archived) draft already exists.
    if exists (
        select 1 from swift_v2.cockpit_outreach_drafts d
        where d.watch_kind = p_watch_kind and d.watch_id = p_watch_id
          and d.status <> 'archived'
    ) then
        if not p_replace_existing then
            raise exception 'active_draft_exists';
        end if;
        -- Replace: archive the prior active drafts (audited per draft).
        for v_old in
            select d.draft_id from swift_v2.cockpit_outreach_drafts d
            where d.watch_kind = p_watch_kind and d.watch_id = p_watch_id
              and d.status <> 'archived'
        loop
            update swift_v2.cockpit_outreach_drafts
               set status = 'archived', archived_at = now(),
                   updated_by = v_uid, updated_at = now()
             where draft_id = v_old;
            perform swift_v2._cockpit_outreach_event(
                v_old, 'archived', 'replaced by AI-generated draft',
                jsonb_build_object('actor_role', v_role, 'reason', 'ai_replace'));
        end loop;
    end if;

    v_meta := jsonb_build_object(
        'generation_mode',     'ai',
        'ai_model_provider',   p_ai_model_provider,
        'ai_model_name',       p_ai_model_name,
        'ai_prompt_version',   p_ai_prompt_version,
        'ai_generated_at',     now(),
        'ai_generation_status','generated',
        'ai_confidence',       p_ai_confidence,
        'ai_risk_flags',       to_jsonb(coalesce(p_ai_risk_flags, array[]::text[])),
        'ai_missing_fields',   to_jsonb(coalesce(p_ai_missing_fields, array[]::text[])),
        'recipient_missing',   (r.administrator_email is null)
    );

    insert into swift_v2.cockpit_outreach_drafts
        (watch_kind, watch_id, entity_id, detection_id, recipient_name, recipient_email,
         recipient_source, subject, body, language, status, created_by, metadata)
    values
        (r.kind, r.watch_id, r.entity_id, r.detection_id,
         r.administrator_name, r.administrator_email, r.administrator_source,
         btrim(p_subject), btrim(p_body), v_lang, 'draft', v_uid, v_meta)
    returning draft_id into v_draft;

    perform swift_v2._cockpit_outreach_event(
        v_draft, 'created', null,
        jsonb_build_object(
            'generation_mode',    'ai',
            'actor_role',         v_role,
            'has_recipient_email',(r.administrator_email is not null),
            'recipient_missing',  (r.administrator_email is null),
            'ai_model_name',      p_ai_model_name,
            'ai_confidence',      p_ai_confidence,
            'outreach_ready',     r.outreach_ready));
    return v_draft;
end;
$$;
revoke all on function swift_v2.cockpit_store_ai_outreach_draft(
    text,uuid,text,text,text,text,text,text,text,text[],text[],boolean) from public, anon;
grant execute on function swift_v2.cockpit_store_ai_outreach_draft(
    text,uuid,text,text,text,text,text,text,text,text[],text[],boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Recreate the safe read view with two additive, safe columns so the UI can
--    distinguish AI-generated drafts. Additive only — existing consumers that
--    select explicit columns are unaffected. Still excludes the metadata blob.
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
    coalesce(d.metadata->>'generation_mode', 'manual') as generation_mode,
    d.metadata->>'ai_model_name'                        as ai_model_name,
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
  'CORE PHASE 1/6A: outreach drafts for active cockpit users (Nachlass drafts only for nachlass_authorized; anon = 0 rows). Safe fields only; generation_mode/ai_model_name surfaced from metadata. No raw metadata blob, no AI prompt/response.';

revoke all on swift_v2.v_cockpit_outreach_drafts from public, anon;
grant select on swift_v2.v_cockpit_outreach_drafts to authenticated;
