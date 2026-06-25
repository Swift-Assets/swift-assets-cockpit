-- =============================================================================
-- Migration: swift_v2_0040_cockpit_insolvency_admin_trigger
-- PHASE 0049 — Keep the Insolvenzverwalter DB in sync on new/updated admin data
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply SEPARATELY and only AFTER the initial backfill (PHASE 0049B), so the
-- one-time historical load runs in bulk rather than row-by-row via the trigger.
--
-- Performance note: this is a per-row AFTER trigger that fires only when a
-- structured administrator field actually changes/appears. Each fire does one
-- upsert + one (idempotent) mention insert. If the upstream scraper performs
-- very large bulk upserts, evaluate batching before enabling; the function +
-- backfill in migration 0039 already cover the historical and manual paths.
-- =============================================================================

create or replace function swift_v2.tg_sync_insolvency_administrator()
returns trigger language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    -- Only act when there is structured administrator identity on the row.
    if nullif(btrim(new.insolvency_administrator), '') is not null
       or nullif(btrim(new.insolvency_admin_email), '') is not null then
        perform swift_v2.fn_sync_insolvency_administrator_from_announcement(new.id);
    end if;
    return null; -- AFTER trigger
end;
$$;

drop trigger if exists trg_sync_insolvency_administrator
    on swift_v2.source_neu_insolvenz_announcements;

create trigger trg_sync_insolvency_administrator
    after insert or update of
        insolvency_administrator,
        insolvency_admin_firm,
        insolvency_admin_address,
        insolvency_admin_phone,
        insolvency_admin_email
    on swift_v2.source_neu_insolvenz_announcements
    for each row
    execute function swift_v2.tg_sync_insolvency_administrator();
