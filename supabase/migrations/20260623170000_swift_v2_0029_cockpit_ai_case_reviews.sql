-- =============================================================================
-- Migration: swift_v2_0029_cockpit_ai_case_reviews
-- CORE PHASE 5A — internal AI case-review storage + safe read view
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Foundation for AI-powered internal case summaries + acquisition scoring.
-- Generation itself happens server-side (Edge Function); this migration only
-- stores results and exposes a safe read view.
--
-- Safety:
--   * source_snapshot is built from SAFE v_cockpit_watchlist_internal fields
--     only — never raw announcement text, deceased names, birth dates, private
--     addresses, detection reasoning, or source excerpts.
--   * source_snapshot is NOT exposed by the read view (separate gated RPC).
--   * Base tables RLS-on, anon/authenticated revoked; writes via SECURITY
--     DEFINER RPCs (writer role) only; created_by/actor from auth.uid().
--   * View is SECURITY DEFINER + active-cockpit-user gate; Nachlass reviews
--     require nachlass_authorized; anon = 0 rows.
--   * No secrets, no AI keys, no email, no public-portal objects.
-- =============================================================================

create table if not exists swift_v2.cockpit_ai_case_reviews (
    review_id      uuid primary key default gen_random_uuid(),
    watch_kind     text not null check (watch_kind in ('company','nachlass')),
    watch_id       uuid not null,
    entity_id      uuid,
    detection_id   uuid,

    input_hash     text not null,
    source_snapshot jsonb not null default '{}'::jsonb,

    summary_ar     text,
    summary_de     text,
    acquisition_score integer check (acquisition_score between 0 and 100),
    priority       text check (priority in ('low','medium','high','urgent')),
    reasoning_ar   text,
    risk_flags     jsonb not null default '[]'::jsonb,
    recommended_next_action text,
    confidence     text check (confidence in ('low','medium','high')),

    model_provider text,
    model_name     text,
    status         text not null default 'pending'
                     check (status in ('pending','generated','failed','archived')),

    error_code     text,
    error_message  text,

    created_by     uuid not null default auth.uid() references auth.users(id),
    updated_by     uuid references auth.users(id),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

comment on table swift_v2.cockpit_ai_case_reviews is
  'CORE PHASE 5A: internal AI case reviews for acquisition leads. source_snapshot holds SAFE internal-view fields only (no raw text / PII) and is never exposed by the read view. Writes via SECURITY DEFINER RPCs only.';

create index if not exists idx_cockpit_ai_reviews_watch on swift_v2.cockpit_ai_case_reviews (watch_kind, watch_id);
create index if not exists idx_cockpit_ai_reviews_status on swift_v2.cockpit_ai_case_reviews (status);
create index if not exists idx_cockpit_ai_reviews_priority on swift_v2.cockpit_ai_case_reviews (priority);
create index if not exists idx_cockpit_ai_reviews_score on swift_v2.cockpit_ai_case_reviews (acquisition_score);

create table if not exists swift_v2.cockpit_ai_case_review_events (
    event_id   uuid primary key default gen_random_uuid(),
    review_id  uuid not null references swift_v2.cockpit_ai_case_reviews(review_id) on delete cascade,
    actor_id   uuid default auth.uid() references auth.users(id),
    event_type text not null check (event_type in ('requested','generated','failed','archived')),
    note       text,
    details    jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_cockpit_ai_review_events_review on swift_v2.cockpit_ai_case_review_events (review_id);

alter table swift_v2.cockpit_ai_case_reviews enable row level security;
alter table swift_v2.cockpit_ai_case_review_events enable row level security;
revoke all on swift_v2.cockpit_ai_case_reviews from public, anon, authenticated;
revoke all on swift_v2.cockpit_ai_case_review_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function swift_v2._cockpit_ai_review_event(
    p_review_id uuid, p_event_type text, p_note text, p_details jsonb
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    insert into swift_v2.cockpit_ai_case_review_events (review_id, actor_id, event_type, note, details)
    values (p_review_id, (select auth.uid()), p_event_type, p_note, coalesce(p_details,'{}'::jsonb));
end;
$$;
revoke all on function swift_v2._cockpit_ai_review_event(uuid,text,text,jsonb) from public;

-- Loads a review and enforces access: active cockpit user; Nachlass reviews
-- require nachlass_authorized. Returns the row for reuse.
create or replace function swift_v2._cockpit_ai_review_require_access(
    p_review_id uuid
) returns swift_v2.cockpit_ai_case_reviews
language plpgsql security definer
set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_uid uuid := (select auth.uid());
    v_rev swift_v2.cockpit_ai_case_reviews%rowtype;
begin
    if v_uid is null then raise exception 'not_authenticated'; end if;
    select * into v_rev from swift_v2.cockpit_ai_case_reviews where review_id = p_review_id;
    if v_rev.review_id is null then raise exception 'review_not_found'; end if;
    if not exists (select 1 from swift_v2.cockpit_user_profiles p
                   where p.user_id = v_uid and p.is_active) then
        raise exception 'no_active_cockpit_profile';
    end if;
    if v_rev.watch_kind = 'nachlass'
       and not exists (select 1 from swift_v2.cockpit_user_profiles p
                       where p.user_id = v_uid and p.is_active and p.nachlass_authorized) then
        raise exception 'nachlass_not_authorized';
    end if;
    return v_rev;
end;
$$;
revoke all on function swift_v2._cockpit_ai_review_require_access(uuid) from public;

-- ---------------------------------------------------------------------------
-- RPC: create review request (builds safe snapshot, status pending)
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_create_ai_case_review_request(
    p_watch_kind text, p_watch_id uuid
) returns uuid language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_uid  uuid := (select auth.uid());
    r      swift_v2.v_cockpit_watchlist_internal%rowtype;
    v_snap jsonb;
    v_hash text;
    v_rev  uuid;
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

    -- SAFE snapshot only (no raw text / PII).
    v_snap := jsonb_build_object(
        'kind', r.kind,
        'watch_id', r.watch_id,
        'entity_id', r.entity_id,
        'detection_id', r.detection_id,
        'safe_display_label', r.safe_display_label,
        'display_title', case when r.kind = 'company' then r.display_title else null end,
        'city', case when r.kind = 'company' then r.city else null end,
        'bundesland', case when r.kind = 'company' then r.bundesland else null end,
        'court', r.court,
        'aktenzeichen', r.aktenzeichen,
        'latest_publication_date', r.latest_publication_date,
        'latest_announcement_type', r.latest_announcement_type,
        'latest_phase', r.latest_phase,
        'phase_priority', r.phase_priority,
        'pre_verteilung_relevance', r.pre_verteilung_relevance,
        'administrator_name', r.administrator_name,
        'administrator_email', r.administrator_email,
        'administrator_phone', r.administrator_phone,
        'administrator_source', r.administrator_source,
        'administrator_confidence', r.administrator_confidence,
        'handelsregister_status', r.handelsregister_status,
        'handelsregister_verified', r.handelsregister_verified,
        'bundesanzeiger_status', r.bundesanzeiger_status,
        'financial_data_status', r.financial_data_status,
        'source_quality_flags', to_jsonb(r.source_quality_flags),
        'missing_data_flags', to_jsonb(r.missing_data_flags),
        'outreach_ready', r.outreach_ready,
        'outreach_blocked_reason', r.outreach_blocked_reason
    );
    v_hash := md5(v_snap::text);

    insert into swift_v2.cockpit_ai_case_reviews
        (watch_kind, watch_id, entity_id, detection_id, input_hash, source_snapshot, status, created_by)
    values
        (r.kind, r.watch_id, r.entity_id, r.detection_id, v_hash, v_snap, 'pending', v_uid)
    returning review_id into v_rev;

    perform swift_v2._cockpit_ai_review_event(
        v_rev, 'requested', null,
        jsonb_build_object('watch_kind', r.kind, 'input_hash', v_hash, 'actor_role', v_role));
    return v_rev;
end;
$$;

-- RPC: return the safe snapshot for prompt building (access-gated).
create or replace function swift_v2.cockpit_get_ai_case_review_source_snapshot(
    p_review_id uuid
) returns jsonb language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_rev swift_v2.cockpit_ai_case_reviews%rowtype;
begin
    v_rev := swift_v2._cockpit_ai_review_require_access(p_review_id);
    return v_rev.source_snapshot;
end;
$$;

-- RPC: store AI result.
create or replace function swift_v2.cockpit_store_ai_case_review_result(
    p_review_id uuid,
    p_summary_ar text,
    p_summary_de text,
    p_acquisition_score integer,
    p_priority text,
    p_reasoning_ar text,
    p_risk_flags jsonb,
    p_recommended_next_action text,
    p_confidence text,
    p_model_provider text,
    p_model_name text
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    perform swift_v2._cockpit_ai_review_require_access(p_review_id);

    if p_acquisition_score is not null and (p_acquisition_score < 0 or p_acquisition_score > 100) then
        raise exception 'invalid_score';
    end if;
    if p_priority is not null and p_priority not in ('low','medium','high','urgent') then
        raise exception 'invalid_priority';
    end if;
    if p_confidence is not null and p_confidence not in ('low','medium','high') then
        raise exception 'invalid_confidence';
    end if;

    update swift_v2.cockpit_ai_case_reviews set
        summary_ar = p_summary_ar,
        summary_de = p_summary_de,
        acquisition_score = p_acquisition_score,
        priority = p_priority,
        reasoning_ar = p_reasoning_ar,
        risk_flags = coalesce(p_risk_flags, '[]'::jsonb),
        recommended_next_action = p_recommended_next_action,
        confidence = p_confidence,
        model_provider = p_model_provider,
        model_name = p_model_name,
        status = 'generated',
        error_code = null,
        error_message = null,
        updated_by = (select auth.uid()),
        updated_at = now()
    where review_id = p_review_id;

    perform swift_v2._cockpit_ai_review_event(
        p_review_id, 'generated', null,
        jsonb_build_object('actor_role', v_role, 'provider', p_model_provider, 'model', p_model_name));
end;
$$;

-- RPC: mark review failed (redacted error only).
create or replace function swift_v2.cockpit_fail_ai_case_review(
    p_review_id uuid, p_error_code text, p_error_message text
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    perform swift_v2._cockpit_ai_review_require_access(p_review_id);
    update swift_v2.cockpit_ai_case_reviews set
        status = 'failed',
        error_code = left(coalesce(p_error_code,'unknown'), 100),
        error_message = left(coalesce(p_error_message,''), 500),
        updated_by = (select auth.uid()),
        updated_at = now()
    where review_id = p_review_id;

    perform swift_v2._cockpit_ai_review_event(
        p_review_id, 'failed', null,
        jsonb_build_object('actor_role', v_role, 'error_code', left(coalesce(p_error_code,'unknown'),100)));
end;
$$;

-- RPC: archive a review.
create or replace function swift_v2.cockpit_archive_ai_case_review(
    p_review_id uuid
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    perform swift_v2._cockpit_ai_review_require_access(p_review_id);
    update swift_v2.cockpit_ai_case_reviews
       set status = 'archived', updated_by = (select auth.uid()), updated_at = now()
     where review_id = p_review_id;
    perform swift_v2._cockpit_ai_review_event(p_review_id, 'archived', null,
        jsonb_build_object('actor_role', v_role));
end;
$$;

revoke all on function swift_v2.cockpit_create_ai_case_review_request(text,uuid) from public, anon;
grant execute on function swift_v2.cockpit_create_ai_case_review_request(text,uuid) to authenticated;
revoke all on function swift_v2.cockpit_get_ai_case_review_source_snapshot(uuid) from public, anon;
grant execute on function swift_v2.cockpit_get_ai_case_review_source_snapshot(uuid) to authenticated;
revoke all on function swift_v2.cockpit_store_ai_case_review_result(uuid,text,text,integer,text,text,jsonb,text,text,text,text) from public, anon;
grant execute on function swift_v2.cockpit_store_ai_case_review_result(uuid,text,text,integer,text,text,jsonb,text,text,text,text) to authenticated;
revoke all on function swift_v2.cockpit_fail_ai_case_review(uuid,text,text) from public, anon;
grant execute on function swift_v2.cockpit_fail_ai_case_review(uuid,text,text) to authenticated;
revoke all on function swift_v2.cockpit_archive_ai_case_review(uuid) from public, anon;
grant execute on function swift_v2.cockpit_archive_ai_case_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Safe read view (active cockpit users; Nachlass gated; no source_snapshot)
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_ai_case_reviews
  with (security_invoker = false) as
select
    a.review_id,
    a.watch_kind,
    a.watch_id,
    a.entity_id,
    a.detection_id,
    a.summary_ar,
    a.summary_de,
    a.acquisition_score,
    a.priority,
    a.reasoning_ar,
    a.risk_flags,
    a.recommended_next_action,
    a.confidence,
    a.model_provider,
    a.model_name,
    a.status,
    a.error_code,
    a.created_by,
    cp.display_name as created_by_name,
    a.updated_by,
    up.display_name as updated_by_name,
    a.created_at,
    a.updated_at,
    (select count(*) from swift_v2.cockpit_ai_case_review_events ev where ev.review_id = a.review_id) as event_count,
    (select max(ev.created_at) from swift_v2.cockpit_ai_case_review_events ev where ev.review_id = a.review_id) as latest_event_at
from swift_v2.cockpit_ai_case_reviews a
left join swift_v2.cockpit_user_profiles cp on cp.user_id = a.created_by
left join swift_v2.cockpit_user_profiles up on up.user_id = a.updated_by
where exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
      and (a.watch_kind = 'company' or me.nachlass_authorized)
);

comment on view swift_v2.v_cockpit_ai_case_reviews is
  'CORE PHASE 5A: safe AI case reviews for active cockpit users (Nachlass gated by nachlass_authorized; anon = 0 rows). source_snapshot intentionally excluded.';

revoke all on swift_v2.v_cockpit_ai_case_reviews from public, anon;
grant select on swift_v2.v_cockpit_ai_case_reviews to authenticated;
