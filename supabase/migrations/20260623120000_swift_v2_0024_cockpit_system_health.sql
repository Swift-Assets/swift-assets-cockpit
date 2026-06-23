-- =============================================================================
-- Migration: swift_v2_0024_cockpit_system_health
-- Phase 6B.2A — Datenbank / Supabase health (read-only Operations card)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval (e.g. Supabase apply_migration or CLI).
--
-- Creates a fail-safe internal system-health snapshot, populated by an internal
-- SECURITY DEFINER function, and exposes a SAFE, RLS-gated view to cockpit users.
--
-- Safety:
--   * Reads ONLY existing safe internal operational sources
--     (v_cockpit_enrichment_jobs, v_daily_run_log, v_personal_data_retention_due,
--      retention_execution_log) plus an OPTIONAL cron probe.
--   * Stores ONLY safe operational metrics (counts / ages / statuses).
--   * NEVER stores PII, natural-person data, Nachlass details, raw announcement
--     text, report jsonb, error_message payloads, or company display names.
--   * Each check is wrapped so one failing source cannot break the whole run;
--     raw SQL error text is never persisted (generic German message instead).
--   * Base table is locked down; cockpit users read only via the safe view.
--   * pg_cron scheduling is intentionally NOT included here (documented next step).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Snapshot table
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.cockpit_system_health_checks (
    check_id        uuid primary key default gen_random_uuid(),
    check_key       text not null unique,
    check_group     text not null,
    status          text not null default 'gray'
                      check (status in ('green','yellow','red','gray')),
    severity        text not null default 'info'
                      check (severity in ('info','warning','critical')),
    title           text not null,
    message         text,
    -- details holds ONLY safe operational metrics (integers/strings) written by
    -- run_data_health_check(). Never any PII.
    details         jsonb not null default '{}'::jsonb,
    last_checked_at timestamptz,
    next_check_at   timestamptz,
    resolved_at     timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table swift_v2.cockpit_system_health_checks is
  'Phase 6B.2A: internal system/data-pipeline health snapshot. One row per check_key. Safe operational metrics only — never PII. Written by swift_v2.run_data_health_check(); read by cockpit users via v_cockpit_system_health.';

-- ---------------------------------------------------------------------------
-- 2) RLS + grants: base table fully locked from anon/authenticated.
--    service_role bypasses RLS (used by the scheduled writer later).
-- ---------------------------------------------------------------------------
alter table swift_v2.cockpit_system_health_checks enable row level security;

revoke all on swift_v2.cockpit_system_health_checks from public;
revoke all on swift_v2.cockpit_system_health_checks from anon;
revoke all on swift_v2.cockpit_system_health_checks from authenticated;
-- No RLS policies for anon/authenticated => no direct table access of any kind.
-- (No authenticated INSERT/UPDATE/DELETE; reads happen only through the view.)

-- ---------------------------------------------------------------------------
-- 3) Internal upsert helper (DRY; SECURITY DEFINER, pinned search_path)
-- ---------------------------------------------------------------------------
create or replace function swift_v2._cockpit_health_upsert(
    p_key text, p_group text, p_status text, p_severity text,
    p_title text, p_message text, p_details jsonb
) returns void
  language plpgsql
  security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    insert into swift_v2.cockpit_system_health_checks
        (check_key, check_group, status, severity, title, message, details,
         last_checked_at, next_check_at, resolved_at, updated_at)
    values
        (p_key, p_group, p_status, p_severity, p_title, p_message,
         coalesce(p_details, '{}'::jsonb),
         now(), now() + interval '15 minutes',
         case when p_status = 'green' then now() else null end, now())
    on conflict (check_key) do update set
        check_group     = excluded.check_group,
        status          = excluded.status,
        severity        = excluded.severity,
        title           = excluded.title,
        message         = excluded.message,
        details         = excluded.details,
        last_checked_at = excluded.last_checked_at,
        next_check_at   = excluded.next_check_at,
        resolved_at     = excluded.resolved_at,
        updated_at      = now();
end;
$$;

revoke all on function swift_v2._cockpit_health_upsert(text,text,text,text,text,text,jsonb) from public;

-- ---------------------------------------------------------------------------
-- 4) Health computation. SECURITY DEFINER, pinned search_path.
--    Every check is exception-guarded; a missing/inaccessible source yields a
--    safe 'gray' check with a generic message — never a raw SQL error.
-- ---------------------------------------------------------------------------
create or replace function swift_v2.run_data_health_check()
  returns void
  language plpgsql
  security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_dead    int;
    v_pending int;
    v_running int;
    v_last_run    date;
    v_last_status text;
    v_age_days    int;
    v_overdue int;
    v_status  text;
    v_sev     text;
    v_msg     text;
begin
    -- Check 1: enrichment backlog (v_cockpit_enrichment_jobs)
    begin
        select count(*) filter (where status = 'dead_letter'),
               count(*) filter (where status = 'pending'),
               count(*) filter (where status = 'running')
          into v_dead, v_pending, v_running
          from swift_v2.v_cockpit_enrichment_jobs;

        v_status := case when coalesce(v_dead,0) > 0 then 'yellow' else 'green' end;
        v_sev    := case when coalesce(v_dead,0) > 0 then 'warning' else 'info' end;
        v_msg    := format('Dead-Letter: %s · Offen: %s · Laufend: %s',
                           coalesce(v_dead,0), coalesce(v_pending,0), coalesce(v_running,0));

        perform swift_v2._cockpit_health_upsert(
            'enrichment_backlog', 'enrichment', v_status, v_sev,
            'Enrichment-Rückstau', v_msg,
            jsonb_build_object('dead_letter', coalesce(v_dead,0),
                               'pending', coalesce(v_pending,0),
                               'running', coalesce(v_running,0)));
    exception when others then
        perform swift_v2._cockpit_health_upsert(
            'enrichment_backlog', 'enrichment', 'gray', 'info',
            'Enrichment-Rückstau', 'Quelle nicht verfügbar', '{}'::jsonb);
    end;

    -- Check 2: ingestion freshness (v_daily_run_log)
    begin
        select run_date, status
          into v_last_run, v_last_status
          from swift_v2.v_daily_run_log
         order by run_date desc nulls last
         limit 1;

        if v_last_run is null then
            perform swift_v2._cockpit_health_upsert(
                'ingestion_freshness', 'ingestion', 'yellow', 'warning',
                'Daten-Ingestion', 'Keine Läufe vorhanden', '{}'::jsonb);
        else
            v_age_days := (current_date - v_last_run);
            if lower(coalesce(v_last_status,'')) like '%fail%'
               or lower(coalesce(v_last_status,'')) like '%error%' then
                v_status := 'red'; v_sev := 'critical';
            elsif v_age_days > 2 then
                v_status := 'yellow'; v_sev := 'warning';
            else
                v_status := 'green'; v_sev := 'info';
            end if;

            v_msg := format('Letzter Lauf: %s (%s) · Alter: %s Tag(e)',
                            v_last_run, coalesce(v_last_status,'—'), v_age_days);

            perform swift_v2._cockpit_health_upsert(
                'ingestion_freshness', 'ingestion', v_status, v_sev,
                'Daten-Ingestion', v_msg,
                jsonb_build_object('age_days', v_age_days,
                                   'last_status', coalesce(v_last_status,'')));
        end if;
    exception when others then
        perform swift_v2._cockpit_health_upsert(
            'ingestion_freshness', 'ingestion', 'gray', 'info',
            'Daten-Ingestion', 'Quelle nicht verfügbar', '{}'::jsonb);
    end;

    -- Check 3: personal-data retention backlog (count only; v_personal_data_retention_due)
    begin
        select count(*) into v_overdue from swift_v2.v_personal_data_retention_due;
        v_status := case when coalesce(v_overdue,0) > 0 then 'yellow' else 'green' end;
        v_sev    := case when coalesce(v_overdue,0) > 0 then 'warning' else 'info' end;
        v_msg    := format('Fällige Löschungen: %s', coalesce(v_overdue,0));

        perform swift_v2._cockpit_health_upsert(
            'retention_backlog', 'retention', v_status, v_sev,
            'Retention / Löschfristen', v_msg,
            jsonb_build_object('overdue_count', coalesce(v_overdue,0)));
    exception when others then
        perform swift_v2._cockpit_health_upsert(
            'retention_backlog', 'retention', 'gray', 'info',
            'Retention / Löschfristen', 'Quelle nicht verfügbar', '{}'::jsonb);
    end;

    -- Check 4: cron health (OPTIONAL; cron schema may be inaccessible -> gray)
    begin
        select count(*) into v_overdue
          from cron.job_run_details
         where status <> 'succeeded'
           and end_time > now() - interval '24 hours';

        v_status := case when coalesce(v_overdue,0) > 0 then 'yellow' else 'green' end;
        v_sev    := case when coalesce(v_overdue,0) > 0 then 'warning' else 'info' end;
        v_msg    := format('Fehlgeschlagene Cron-Läufe (24h): %s', coalesce(v_overdue,0));

        perform swift_v2._cockpit_health_upsert(
            'cron_health', 'cron', v_status, v_sev,
            'Cron-Jobs', v_msg,
            jsonb_build_object('failed_runs_24h', coalesce(v_overdue,0)));
    exception when others then
        perform swift_v2._cockpit_health_upsert(
            'cron_health', 'cron', 'gray', 'info',
            'Cron-Jobs', 'Cron-Status nicht verfügbar', '{}'::jsonb);
    end;
end;
$$;

revoke all on function swift_v2.run_data_health_check() from public;
revoke all on function swift_v2.run_data_health_check() from anon;
revoke all on function swift_v2.run_data_health_check() from authenticated;
grant execute on function swift_v2.run_data_health_check() to service_role;

-- ---------------------------------------------------------------------------
-- 5) Safe, RLS-gated view for the cockpit frontend.
--
--    Uses SECURITY DEFINER (security_invoker = false) — consistent with the
--    existing cockpit operational views (e.g. v_cockpit_enrichment_jobs) that
--    expose locked base tables to cockpit users — and gates rows with an
--    internal auth.uid() active-cockpit-user check so it cannot leak to anon or
--    to non-cockpit authenticated users. Exposes safe columns only.
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_system_health
  with (security_invoker = false) as
select
    h.check_key,
    h.check_group,
    h.status,
    h.severity,
    h.title,
    h.message,
    h.details,
    h.last_checked_at,
    h.next_check_at,
    h.resolved_at,
    h.updated_at
from swift_v2.cockpit_system_health_checks h
where exists (
    select 1 from swift_v2.cockpit_user_profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
);

comment on view swift_v2.v_cockpit_system_health is
  'Phase 6B.2A: safe, RLS-gated read of cockpit_system_health_checks for active cockpit users. Safe operational metrics only — never PII.';

revoke all on swift_v2.v_cockpit_system_health from public;
revoke all on swift_v2.v_cockpit_system_health from anon;
grant select on swift_v2.v_cockpit_system_health to authenticated;
