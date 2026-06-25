-- =============================================================================
-- Migration: swift_v2_0039_cockpit_insolvency_administrators
-- PHASE 0049 — Internal Insolvenzverwalter database (tables + sync + backfill + view)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval (PHASE 0049B).
--
-- Purpose
--   Dedicated internal database of Insolvenzverwalter mentioned in insolvency
--   announcements, filled ONLY from the STRUCTURED administrator fields already
--   present on source_neu_insolvenz_announcements (never raw announcement_text).
--
-- Objects
--   * insolvency_administrators            (deduped people/firms, canonical_key)
--   * insolvency_administrator_mentions    (admin × announcement link rows)
--   * _norm_admin_text()                   (normalization helper)
--   * fn_sync_insolvency_administrator_from_announcement(uuid)  (idempotent upsert)
--   * fn_backfill_insolvency_administrators(int)                (idempotent batch)
--   * v_cockpit_insolvency_administrators_internal              (safe read view)
--
-- Safety
--   * Base tables: RLS ON, anon/authenticated revoked. Writes happen ONLY via the
--     SECURITY DEFINER sync/backfill functions. Reads via the gated view.
--   * No raw announcement_text / raw_json. No public exposure. Non-destructive
--     (create if not exists); the backfill never overwrites a non-null value with
--     null and never duplicates mentions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.insolvency_administrators (
    id              uuid primary key default gen_random_uuid(),
    display_name    text not null,
    normalized_name text not null,
    firm            text,
    email           text,
    phone           text,
    address         text,
    city            text,
    postal_code     text,
    canonical_key   text not null unique,
    first_seen_at   timestamptz,
    last_seen_at    timestamptz,
    source_count    integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table swift_v2.insolvency_administrators is
  'PHASE 0049: deduped Insolvenzverwalter derived from structured announcement fields. Internal only; written via SECURITY DEFINER sync/backfill functions.';

create index if not exists idx_insolvency_admins_norm_name
    on swift_v2.insolvency_administrators (normalized_name);
create index if not exists idx_insolvency_admins_email
    on swift_v2.insolvency_administrators (email);

create table if not exists swift_v2.insolvency_administrator_mentions (
    id                    uuid primary key default gen_random_uuid(),
    administrator_id      uuid not null references swift_v2.insolvency_administrators(id) on delete cascade,
    announcement_id       uuid not null references swift_v2.source_neu_insolvenz_announcements(id) on delete cascade,
    entity_id             uuid,
    court                 text,
    case_number           text,
    announcement_date     date,
    announcement_type_hint text,
    created_at            timestamptz not null default now(),
    unique (administrator_id, announcement_id)
);

create index if not exists idx_insolvency_admin_mentions_admin
    on swift_v2.insolvency_administrator_mentions (administrator_id);
create index if not exists idx_insolvency_admin_mentions_entity
    on swift_v2.insolvency_administrator_mentions (entity_id);

alter table swift_v2.insolvency_administrators        enable row level security;
alter table swift_v2.insolvency_administrator_mentions enable row level security;
revoke all on swift_v2.insolvency_administrators        from public, anon, authenticated;
revoke all on swift_v2.insolvency_administrator_mentions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Normalization helper
-- ---------------------------------------------------------------------------
create or replace function swift_v2._norm_admin_text(p text)
returns text language sql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
  select nullif(btrim(regexp_replace(lower(coalesce(p,'')), '\s+', ' ', 'g')), '');
$$;

-- ---------------------------------------------------------------------------
-- 3) Sync one announcement -> administrators + mention (idempotent)
--    Returns {admin_inserted, mention_inserted} for backfill accounting.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.fn_sync_insolvency_administrator_from_announcement(
    p_announcement_id uuid
) returns jsonb language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    a            swift_v2.source_neu_insolvenz_announcements%rowtype;
    v_name       text;
    v_firm       text;
    v_email      text;
    v_phone      text;
    v_address    text;
    v_norm_name  text;
    v_phone_dig  text;
    v_key        text;
    v_admin_id   uuid;
    v_admin_ins  boolean := false;
    v_men_ins    boolean := false;
begin
    select * into a from swift_v2.source_neu_insolvenz_announcements where id = p_announcement_id;
    if a.id is null then
        return jsonb_build_object('admin_inserted', false, 'mention_inserted', false, 'skipped', 'not_found');
    end if;

    v_name    := nullif(btrim(a.insolvency_administrator), '');
    v_firm    := nullif(btrim(a.insolvency_admin_firm), '');
    v_email   := nullif(btrim(a.insolvency_admin_email), '');
    v_phone   := nullif(btrim(a.insolvency_admin_phone), '');
    v_address := nullif(btrim(a.insolvency_admin_address), '');

    -- No structured administrator identity -> nothing to do.
    if v_name is null and v_email is null then
        return jsonb_build_object('admin_inserted', false, 'mention_inserted', false, 'skipped', 'no_admin_data');
    end if;

    v_norm_name := swift_v2._norm_admin_text(v_name);
    v_phone_dig := nullif(regexp_replace(coalesce(v_phone,''), '\D', '', 'g'), '');

    -- Canonical key: prefer email; then name+phone; then name+address; else name.
    if v_email is not null then
        v_key := 'email:' || lower(v_email);
    elsif v_norm_name is not null and v_phone_dig is not null then
        v_key := 'name_phone:' || v_norm_name || '|' || v_phone_dig;
    elsif v_norm_name is not null and v_address is not null then
        v_key := 'name_address:' || v_norm_name || '|' || swift_v2._norm_admin_text(v_address);
    elsif v_norm_name is not null then
        v_key := 'name_only:' || v_norm_name;
    else
        -- email-less + name-less already handled; this is a safety net.
        return jsonb_build_object('admin_inserted', false, 'mention_inserted', false, 'skipped', 'no_key');
    end if;

    -- Upsert administrator. Prefer non-null values; never overwrite non-null with null.
    insert into swift_v2.insolvency_administrators
        (display_name, normalized_name, firm, email, phone, address, canonical_key,
         first_seen_at, last_seen_at, source_count)
    values
        (coalesce(v_name, v_email), coalesce(v_norm_name, lower(v_email)),
         v_firm, v_email, v_phone, v_address, v_key,
         a.announcement_date, a.announcement_date, 0)
    on conflict (canonical_key) do update set
        display_name    = coalesce(swift_v2.insolvency_administrators.display_name, excluded.display_name),
        firm            = coalesce(swift_v2.insolvency_administrators.firm, excluded.firm),
        email           = coalesce(swift_v2.insolvency_administrators.email, excluded.email),
        phone           = coalesce(swift_v2.insolvency_administrators.phone, excluded.phone),
        address         = coalesce(swift_v2.insolvency_administrators.address, excluded.address),
        first_seen_at   = least(
                            coalesce(swift_v2.insolvency_administrators.first_seen_at, excluded.first_seen_at),
                            coalesce(excluded.first_seen_at, swift_v2.insolvency_administrators.first_seen_at)),
        last_seen_at    = greatest(
                            coalesce(swift_v2.insolvency_administrators.last_seen_at, excluded.last_seen_at),
                            coalesce(excluded.last_seen_at, swift_v2.insolvency_administrators.last_seen_at)),
        updated_at      = now()
    returning id, (xmax = 0) into v_admin_id, v_admin_ins;

    -- Insert mention (idempotent). source_count only grows on a genuinely new mention.
    insert into swift_v2.insolvency_administrator_mentions
        (administrator_id, announcement_id, entity_id, court, case_number,
         announcement_date, announcement_type_hint)
    values
        (v_admin_id, a.id, a.entity_id, nullif(btrim(a.court),''), nullif(btrim(a.case_number),''),
         a.announcement_date, nullif(btrim(a.announcement_type_hint),''))
    on conflict (administrator_id, announcement_id) do nothing;

    if found then
        v_men_ins := true;
        update swift_v2.insolvency_administrators
           set source_count = source_count + 1, updated_at = now()
         where id = v_admin_id;
    end if;

    return jsonb_build_object('admin_inserted', v_admin_ins, 'mention_inserted', v_men_ins);
end;
$$;
revoke all on function swift_v2.fn_sync_insolvency_administrator_from_announcement(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 4) Idempotent backfill (safe to re-run; processes announcements lacking a mention)
-- ---------------------------------------------------------------------------
create or replace function swift_v2.fn_backfill_insolvency_administrators(
    p_limit integer default 1000
) returns jsonb language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    r              record;
    v_res          jsonb;
    v_processed    integer := 0;
    v_admins_ins   integer := 0;
    v_mentions_ins integer := 0;
begin
    for r in
        select a.id
        from swift_v2.source_neu_insolvenz_announcements a
        where (nullif(btrim(a.insolvency_administrator),'') is not null
               or nullif(btrim(a.insolvency_admin_email),'') is not null)
          and not exists (
              select 1 from swift_v2.insolvency_administrator_mentions m
              where m.announcement_id = a.id
          )
        order by a.announcement_date desc nulls last
        limit greatest(0, coalesce(p_limit, 1000))
    loop
        v_res := swift_v2.fn_sync_insolvency_administrator_from_announcement(r.id);
        v_processed := v_processed + 1;
        if (v_res->>'admin_inserted')::boolean then v_admins_ins := v_admins_ins + 1; end if;
        if (v_res->>'mention_inserted')::boolean then v_mentions_ins := v_mentions_ins + 1; end if;
    end loop;

    return jsonb_build_object(
        'processed_rows', v_processed,
        'inserted_admins', v_admins_ins,
        'inserted_mentions', v_mentions_ins,
        'total_admins', (select count(*) from swift_v2.insolvency_administrators),
        'total_mentions', (select count(*) from swift_v2.insolvency_administrator_mentions)
    );
end;
$$;
revoke all on function swift_v2.fn_backfill_insolvency_administrators(integer) from public, anon;

-- ---------------------------------------------------------------------------
-- 5) Safe internal read view (active cockpit users only; anon = 0 rows)
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_insolvency_administrators_internal
  with (security_invoker = false) as
select
    ad.id                                          as administrator_id,
    ad.display_name,
    ad.firm,
    ad.email,
    ad.phone,
    ad.address,
    ad.city,
    ad.postal_code,
    ad.source_count,
    ad.first_seen_at,
    ad.last_seen_at,
    (select count(*) from swift_v2.insolvency_administrator_mentions m
       where m.administrator_id = ad.id)           as latest_cases_count,
    (ad.email is not null)                          as has_email,
    (ad.phone is not null)                          as has_phone,
    (ad.address is not null)                        as has_address,
    (ad.firm is not null)                           as has_firm
from swift_v2.insolvency_administrators ad
where exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
);

comment on view swift_v2.v_cockpit_insolvency_administrators_internal is
  'PHASE 0049: internal Insolvenzverwalter directory for active cockpit users (anon = 0 rows). Structured contact fields only; never raw announcement text. Never used by the public portal.';

revoke all on swift_v2.v_cockpit_insolvency_administrators_internal from public, anon;
grant select on swift_v2.v_cockpit_insolvency_administrators_internal to authenticated;
