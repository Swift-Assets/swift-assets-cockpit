-- =============================================================================
-- Migration: swift_v2_0042_cockpit_insolvency_admin_quality
-- PHASE 0050A — Insolvenzverwalter data-quality layer (columns + classifier +
--               guarded sync + visible-only view)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit approval (PHASE 0050B). The existing-row soft cleanup
-- is a SEPARATE migration (0043) and is also not applied here.
--
-- Purpose
--   Add a non-destructive quality-control layer so false-positive administrator
--   identities (legal/procedural words like „Gelegenheit", „Anspruch",
--   „Rechtsanwalt Dr" …) can be flagged + hidden without deleting anything, and
--   future garbage is prevented from entering via the sync trigger.
--
-- Safety: ADD COLUMN (defaults keep existing rows visible/unreviewed) + CREATE OR
--   REPLACE function/view only. No deletes, no source changes, no public exposure.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Quality columns (existing rows default to unreviewed + visible)
-- ---------------------------------------------------------------------------
alter table swift_v2.insolvency_administrators
    add column if not exists quality_status     text not null default 'unreviewed',
    add column if not exists quality_reason     text,
    add column if not exists quality_checked_at timestamptz,
    add column if not exists quality_checked_by text,
    add column if not exists is_visible         boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'insolvency_administrators_quality_status_check'
  ) then
    alter table swift_v2.insolvency_administrators
      add constraint insolvency_administrators_quality_status_check
      check (quality_status in ('unreviewed','valid','suspect','invalid','quarantined'));
  end if;
end $$;

create index if not exists idx_insolvency_admins_visible
    on swift_v2.insolvency_administrators (is_visible, quality_status);

-- ---------------------------------------------------------------------------
-- 2) Deterministic identity classifier (no AI, no raw text)
--    Returns {quality_status, is_visible, reason}.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.fn_classify_insolvency_administrator_identity(
    p_display_name text,
    p_email text default null,
    p_phone text default null,
    p_address text default null,
    p_source_count integer default null
) returns jsonb language plpgsql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_dn        text := btrim(coalesce(p_display_name, ''));
    v_dn_l      text := lower(btrim(coalesce(p_display_name, '')));
    v_has_email boolean := nullif(btrim(coalesce(p_email, '')), '') is not null;
    v_tokens    integer;
    v_status    text;
    v_reason    text;
    v_stop      text[] := array[
        'gelegenheit','anspruch','einwendungen','einwendung','stellung','entscheidung',
        'beschluss','antrag','verfahren','schuldner','schuldnerin','insolvenzverfahren',
        'forderungen','forderung','prüfung','pruefung','prüfungen','anmeldung','gläubiger',
        'glaeubiger','tabelle','frist','termin','amtsgericht','geschäftsstelle','geschaeftsstelle',
        'rechtspfleger','rechtspflegerin','dipl-rechtspflegerin','dipl.-rechtspflegerin',
        'rechtsanwalt','rechtsanwältin','rechtsanwaeltin','rechtsanwalt dr','rechtsanwalt dr.',
        'dr','dr.','herr','frau'
    ];
begin
    -- Count capitalized, name-like tokens (excluding titles/honorifics).
    select count(*) into v_tokens
    from regexp_split_to_table(v_dn, '\s+') t(tok)
    where tok ~ '^[[:upper:]][[:alpha:].-]+$'
      and char_length(tok) >= 2
      and lower(btrim(tok, '.')) not in
        ('rechtsanwalt','rechtsanwältin','rechtsanwaeltin','dr','herr','frau','prof','dipl',
         'rechtspfleger','rechtspflegerin','dipl-rechtspflegerin','rechtsanwälte','kanzlei');

    if v_dn = '' or char_length(v_dn) < 4 then
        v_status := case when v_has_email then 'suspect' else 'invalid' end;
        v_reason := case when v_has_email then 'short_name_has_email' else 'too_short' end;
    elsif v_dn_l = any(v_stop) then
        v_status := case when v_has_email then 'suspect' else 'invalid' end;
        v_reason := case when v_has_email then 'stopword_name_has_email' else 'stopword_legal_term' end;
    elsif v_tokens >= 2 then
        v_status := 'valid';
        v_reason := 'multi_name_token';
    elsif v_tokens = 1 then
        v_status := 'suspect';
        v_reason := 'single_name_token';
    else
        v_status := case when v_has_email then 'suspect' else 'invalid' end;
        v_reason := case when v_has_email then 'email_only_no_name' else 'no_name_token' end;
    end if;

    return jsonb_build_object(
        'quality_status', v_status,
        'is_visible', (v_status <> 'invalid'),
        'reason', v_reason
    );
end;
$$;
revoke all on function swift_v2.fn_classify_insolvency_administrator_identity(text,text,text,text,integer) from public, anon;

-- ---------------------------------------------------------------------------
-- 3) Guarded sync — skip clearly invalid NEW identities; tag new rows' quality.
--    Existing rows are never deleted or downgraded here (on conflict leaves
--    quality_status untouched so manual review survives).
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
    v_display    text;
    v_cls        jsonb;
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

    if v_name is null and v_email is null then
        return jsonb_build_object('admin_inserted', false, 'mention_inserted', false, 'skipped', 'no_admin_data');
    end if;

    v_norm_name := swift_v2._norm_admin_text(v_name);
    v_phone_dig := nullif(regexp_replace(coalesce(v_phone,''), '\D', '', 'g'), '');

    if v_email is not null then
        v_key := 'email:' || lower(v_email);
    elsif v_norm_name is not null and v_phone_dig is not null then
        v_key := 'name_phone:' || v_norm_name || '|' || v_phone_dig;
    elsif v_norm_name is not null and v_address is not null then
        v_key := 'name_address:' || v_norm_name || '|' || swift_v2._norm_admin_text(v_address);
    elsif v_norm_name is not null then
        v_key := 'name_only:' || v_norm_name;
    else
        return jsonb_build_object('admin_inserted', false, 'mention_inserted', false, 'skipped', 'no_key');
    end if;

    v_display := coalesce(v_name, v_email);
    v_cls := swift_v2.fn_classify_insolvency_administrator_identity(v_display, v_email, v_phone, v_address, null);

    -- Prevent future garbage: if the identity is clearly invalid AND this admin
    -- does not already exist, skip insert entirely. (Existing rows are preserved.)
    if (v_cls->>'quality_status') = 'invalid'
       and not exists (select 1 from swift_v2.insolvency_administrators where canonical_key = v_key) then
        return jsonb_build_object(
            'admin_inserted', false, 'mention_inserted', false,
            'skipped', 'invalid_admin_identity', 'quality_reason', v_cls->>'reason');
    end if;

    insert into swift_v2.insolvency_administrators
        (display_name, normalized_name, firm, email, phone, address, canonical_key,
         first_seen_at, last_seen_at, source_count,
         quality_status, quality_reason, is_visible, quality_checked_at, quality_checked_by)
    values
        (v_display, coalesce(v_norm_name, lower(v_email)),
         v_firm, v_email, v_phone, v_address, v_key,
         a.announcement_date, a.announcement_date, 0,
         v_cls->>'quality_status', v_cls->>'reason', (v_cls->>'is_visible')::boolean,
         now(), 'trigger_sync')
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

    return jsonb_build_object('admin_inserted', v_admin_ins, 'mention_inserted', v_men_ins,
                             'quality_status', v_cls->>'quality_status');
end;
$$;
revoke all on function swift_v2.fn_sync_insolvency_administrator_from_announcement(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 4) View shows only visible, non-invalid/quarantined rows; exposes quality.
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
    ad.quality_status,
    ad.quality_reason,
    ad.is_visible,
    (select count(*) from swift_v2.insolvency_administrator_mentions m
       where m.administrator_id = ad.id)           as latest_cases_count,
    (ad.email is not null)                          as has_email,
    (ad.phone is not null)                          as has_phone,
    (ad.address is not null)                        as has_address,
    (ad.firm is not null)                           as has_firm
from swift_v2.insolvency_administrators ad
where ad.is_visible = true
  and ad.quality_status not in ('invalid','quarantined')
  and exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
);

comment on view swift_v2.v_cockpit_insolvency_administrators_internal is
  'PHASE 0049/0050: internal Insolvenzverwalter directory for active cockpit users (anon = 0 rows). Hides invalid/quarantined + is_visible=false rows. Structured contact + quality fields only; never raw announcement text.';

revoke all on swift_v2.v_cockpit_insolvency_administrators_internal from public, anon;
grant select on swift_v2.v_cockpit_insolvency_administrators_internal to authenticated;
