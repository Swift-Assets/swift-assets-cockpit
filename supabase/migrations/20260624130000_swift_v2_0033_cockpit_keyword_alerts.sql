-- =============================================================================
-- Migration: swift_v2_0033_cockpit_keyword_alerts
-- PRODUCT CORRECTION PHASE 7A — Keyword alerts foundation (queue-only)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION. Apply only after approval.
--
-- Lets a cockpit user define keyword rules and accumulate MATCHES against new
-- company insolvency announcements. NO email is sent here — matches are queued
-- (status new/queued/sent/dismissed) so sending can be wired later via a
-- Supabase Edge Function (Resend) or a Make.com scenario. NO SMTP/provider
-- secret is introduced.
--
-- Privacy/safety:
--   * Matching uses ONLY safe fields (company display name, court, case number,
--     administrator name, announcement type hint) — NEVER raw announcement_text,
--     raw_json, source_excerpt, or natural-person data.
--   * Per-user data: rules/matches keyed by auth.uid(). Base tables RLS-on,
--     anon/authenticated revoked; access via SECURITY DEFINER views/RPCs gated
--     by an active cockpit profile. created/owner derived from auth.uid().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.cockpit_keyword_alert_rules (
    rule_id       uuid primary key default gen_random_uuid(),
    user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name          text not null,
    keywords      text[] not null default '{}'::text[],
    match_mode    text not null default 'any' check (match_mode in ('any','all','phrase')),
    is_active     boolean not null default true,
    email_enabled boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists idx_cockpit_keyword_rules_user on swift_v2.cockpit_keyword_alert_rules (user_id);

create table if not exists swift_v2.cockpit_keyword_alert_matches (
    match_id           uuid primary key default gen_random_uuid(),
    rule_id            uuid not null references swift_v2.cockpit_keyword_alert_rules(rule_id) on delete cascade,
    user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
    entity_id          uuid,
    announcement_id    uuid,
    matched_keywords   text[] not null default '{}'::text[],
    announcement_date  date,
    company_name       text,
    court              text,
    case_number        text,
    phase              text,
    administrator_name text,
    matched_at         timestamptz not null default now(),
    email_queued_at    timestamptz,
    email_sent_at      timestamptz,
    status             text not null default 'new' check (status in ('new','queued','sent','dismissed'))
);
create index if not exists idx_cockpit_keyword_matches_user on swift_v2.cockpit_keyword_alert_matches (user_id, status);
create unique index if not exists uq_cockpit_keyword_match on swift_v2.cockpit_keyword_alert_matches (rule_id, announcement_id);

alter table swift_v2.cockpit_keyword_alert_rules   enable row level security;
alter table swift_v2.cockpit_keyword_alert_matches enable row level security;
revoke all on swift_v2.cockpit_keyword_alert_rules   from public, anon, authenticated;
revoke all on swift_v2.cockpit_keyword_alert_matches from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Safe per-user read views (active cockpit users; own rows only)
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_keyword_alert_rules
  with (security_invoker = false) as
select r.rule_id, r.name, r.keywords, r.match_mode, r.is_active, r.email_enabled,
       r.created_at, r.updated_at,
       (select count(*) from swift_v2.cockpit_keyword_alert_matches m where m.rule_id = r.rule_id) as match_count
from swift_v2.cockpit_keyword_alert_rules r
where r.user_id = (select auth.uid())
  and exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active);

create or replace view swift_v2.v_cockpit_keyword_alert_matches
  with (security_invoker = false) as
select m.match_id, m.rule_id, m.entity_id, m.announcement_id, m.matched_keywords,
       m.announcement_date, m.company_name, m.court, m.case_number, m.phase,
       m.administrator_name, m.matched_at, m.email_queued_at, m.email_sent_at, m.status
from swift_v2.cockpit_keyword_alert_matches m
where m.user_id = (select auth.uid())
  and exists (select 1 from swift_v2.cockpit_user_profiles me
              where me.user_id = (select auth.uid()) and me.is_active);

revoke all on swift_v2.v_cockpit_keyword_alert_rules   from public, anon;
revoke all on swift_v2.v_cockpit_keyword_alert_matches from public, anon;
grant select on swift_v2.v_cockpit_keyword_alert_rules   to authenticated;
grant select on swift_v2.v_cockpit_keyword_alert_matches to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Rule lifecycle RPCs (active cockpit profile; owner = auth.uid())
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_create_keyword_alert_rule(
    p_name text, p_keywords text[], p_match_mode text default 'any',
    p_email_enabled boolean default false
) returns uuid language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_active_role();
    v_uid  uuid := (select auth.uid());
    v_rule uuid;
    v_kw   text[];
begin
    if p_name is null or length(btrim(p_name)) = 0 then raise exception 'name_required'; end if;
    if p_match_mode not in ('any','all','phrase') then raise exception 'invalid_match_mode'; end if;
    -- normalize: trim, drop empties, cap to 50 keywords
    select array_agg(distinct btrim(k)) into v_kw
    from unnest(coalesce(p_keywords, '{}'::text[])) k
    where length(btrim(k)) > 0;
    v_kw := (select array_agg(k) from (select unnest(coalesce(v_kw,'{}'::text[])) k limit 50) s);
    if v_kw is null or array_length(v_kw,1) is null then raise exception 'keywords_required'; end if;

    insert into swift_v2.cockpit_keyword_alert_rules (user_id, name, keywords, match_mode, email_enabled)
    values (v_uid, btrim(p_name), v_kw, p_match_mode, coalesce(p_email_enabled,false))
    returning rule_id into v_rule;
    perform v_role;
    return v_rule;
end;
$$;

create or replace function swift_v2.cockpit_update_keyword_alert_rule(
    p_rule_id uuid, p_name text default null, p_keywords text[] default null,
    p_match_mode text default null, p_is_active boolean default null,
    p_email_enabled boolean default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_active_role();
    v_uid  uuid := (select auth.uid());
    v_kw   text[];
begin
    if p_match_mode is not null and p_match_mode not in ('any','all','phrase') then
        raise exception 'invalid_match_mode';
    end if;
    if p_keywords is not null then
        select array_agg(distinct btrim(k)) into v_kw
        from unnest(p_keywords) k where length(btrim(k)) > 0;
    end if;
    update swift_v2.cockpit_keyword_alert_rules set
        name          = coalesce(nullif(btrim(coalesce(p_name,'')),''), name),
        keywords      = coalesce(v_kw, keywords),
        match_mode    = coalesce(p_match_mode, match_mode),
        is_active     = coalesce(p_is_active, is_active),
        email_enabled = coalesce(p_email_enabled, email_enabled),
        updated_at    = now()
    where rule_id = p_rule_id and user_id = v_uid;
    if not found then raise exception 'rule_not_found'; end if;
    perform v_role;
end;
$$;

create or replace function swift_v2.cockpit_delete_keyword_alert_rule(
    p_rule_id uuid
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_active_role();
    v_uid  uuid := (select auth.uid());
begin
    delete from swift_v2.cockpit_keyword_alert_rules
     where rule_id = p_rule_id and user_id = v_uid;
    if not found then raise exception 'rule_not_found'; end if;
    perform v_role;
end;
$$;

create or replace function swift_v2.cockpit_dismiss_keyword_alert_match(
    p_match_id uuid
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_active_role();
    v_uid  uuid := (select auth.uid());
begin
    update swift_v2.cockpit_keyword_alert_matches
       set status = 'dismissed'
     where match_id = p_match_id and user_id = v_uid;
    if not found then raise exception 'match_not_found'; end if;
    perform v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Scan: match the caller's active rules against recent company
--    announcements using SAFE fields only. Inserts new matches (status 'new').
--    Returns the number of new matches inserted. Idempotent via the unique
--    (rule_id, announcement_id) index. NO email is sent.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_scan_keyword_alerts(
    p_days integer default 30
) returns integer language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role  text := swift_v2._cockpit_active_role();
    v_uid   uuid := (select auth.uid());
    v_count integer := 0;
    r       record;
    a       record;
    v_hay   text;
    v_hit   text[];
    v_match boolean;
begin
    for r in
        select rule_id, keywords, match_mode
        from swift_v2.cockpit_keyword_alert_rules
        where user_id = v_uid and is_active and array_length(keywords,1) is not null
    loop
        for a in
            select ca.entity_id, ca.announcement_id, ca.court, ca.case_number,
                   ca.announcement_date, ca.announcement_type_hint,
                   ca.insolvency_administrator,
                   e.display_name as company_name
            from swift_v2.v_cockpit_company_announcements ca
            left join swift_v2.portal_entities e on e.id = ca.entity_id
            where ca.announcement_date >= (current_date - make_interval(days => greatest(p_days,1)))
            order by ca.announcement_date desc
            limit 2000
        loop
            -- SAFE haystack: never includes announcement_text / raw json.
            v_hay := lower(concat_ws(' ',
                coalesce(a.company_name,''), coalesce(a.court,''),
                coalesce(a.case_number,''), coalesce(a.insolvency_administrator,''),
                coalesce(a.announcement_type_hint,'')));

            select array_agg(k) into v_hit
            from unnest(r.keywords) k
            where v_hay like '%' || lower(btrim(k)) || '%';

            if r.match_mode = 'all' then
                v_match := (coalesce(array_length(v_hit,1),0) = array_length(r.keywords,1));
            elsif r.match_mode = 'phrase' then
                v_match := v_hay like '%' || lower(array_to_string(r.keywords,' ')) || '%';
                if v_match then v_hit := r.keywords; end if;
            else -- any
                v_match := coalesce(array_length(v_hit,1),0) > 0;
            end if;

            if v_match then
                insert into swift_v2.cockpit_keyword_alert_matches
                    (rule_id, user_id, entity_id, announcement_id, matched_keywords,
                     announcement_date, company_name, court, case_number, phase,
                     administrator_name, status)
                values
                    (r.rule_id, v_uid, a.entity_id, a.announcement_id,
                     coalesce(v_hit, r.keywords), a.announcement_date, a.company_name,
                     a.court, a.case_number,
                     swift_v2.fn_cockpit_phase_label(a.announcement_type_hint, null),
                     a.insolvency_administrator, 'new')
                on conflict (rule_id, announcement_id) do nothing;
                if found then v_count := v_count + 1; end if;
            end if;
        end loop;
    end loop;
    perform v_role;
    return v_count;
end;
$$;

revoke all on function swift_v2.cockpit_create_keyword_alert_rule(text,text[],text,boolean) from public, anon;
revoke all on function swift_v2.cockpit_update_keyword_alert_rule(uuid,text,text[],text,boolean,boolean) from public, anon;
revoke all on function swift_v2.cockpit_delete_keyword_alert_rule(uuid) from public, anon;
revoke all on function swift_v2.cockpit_dismiss_keyword_alert_match(uuid) from public, anon;
revoke all on function swift_v2.cockpit_scan_keyword_alerts(integer) from public, anon;
grant execute on function swift_v2.cockpit_create_keyword_alert_rule(text,text[],text,boolean) to authenticated;
grant execute on function swift_v2.cockpit_update_keyword_alert_rule(uuid,text,text[],text,boolean,boolean) to authenticated;
grant execute on function swift_v2.cockpit_delete_keyword_alert_rule(uuid) to authenticated;
grant execute on function swift_v2.cockpit_dismiss_keyword_alert_match(uuid) to authenticated;
grant execute on function swift_v2.cockpit_scan_keyword_alerts(integer) to authenticated;

-- =============================================================================
-- EMAIL SENDING — NEXT PHASE (not in this migration; no secrets here):
--   Option A: Supabase Edge Function on a schedule that selects status='new'
--             matches, sends via Resend (RESEND_API_KEY as an Edge secret),
--             then sets email_queued_at/email_sent_at + status.
--   Option B: Make.com scenario polling queued matches via a service endpoint.
--   Neither is enabled until a provider is chosen and approved.
-- =============================================================================
