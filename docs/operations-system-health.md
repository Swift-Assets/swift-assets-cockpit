# Operations — Datenbank / Supabase health (Phase 6B.2A)

## Status

The migration `supabase/migrations/20260623120000_swift_v2_0024_cockpit_system_health.sql`
is **repo-only and NOT applied to production**. Until it is applied (with explicit
human approval), the "Datenbank / Supabase" card on `/cockpit/operations` renders
its safe gray placeholder, because `getSystemHealth()` fails safe when the view is
absent.

## What the migration creates

- `swift_v2.cockpit_system_health_checks` — internal snapshot table (one row per
  `check_key`), RLS-enabled, fully revoked from `anon`/`authenticated`.
- `swift_v2._cockpit_health_upsert(...)` — internal SECURITY DEFINER upsert helper.
- `swift_v2.run_data_health_check()` — SECURITY DEFINER, pinned `search_path`,
  exception-guarded per check; `EXECUTE` granted to `service_role` only.
- `swift_v2.v_cockpit_system_health` — safe, RLS-gated view (active cockpit users
  only); `SELECT` granted to `authenticated`, revoked from `anon`.

### Checks computed (safe metrics only)

| check_key | group | source | safe output |
|---|---|---|---|
| `enrichment_backlog` | enrichment | `v_cockpit_enrichment_jobs` | dead_letter / pending / running counts |
| `ingestion_freshness` | ingestion | `v_daily_run_log` | last run date, status, age in days |
| `retention_backlog` | retention | `v_personal_data_retention_due` | overdue **count only** |
| `cron_health` | cron | `cron.job_run_details` (optional) | failed-run count (24h); gray if inaccessible |

No PII, natural-person data, Nachlass details, raw announcement text, `report`
jsonb, `error_message`, or company display names are read or stored.

## Traffic-light rollup

The card status is the worst of its checks: red > yellow > green > gray. Per check:
- enrichment: dead_letter > 0 → yellow, else green
- ingestion: latest run failed → red; stale (> 2 days) → yellow; else green; no runs → yellow
- retention: overdue > 0 → yellow, else green
- cron: failed runs in 24h → yellow; inaccessible → gray; else green

## Next step (NOT in this PR — requires approval)

Schedule `swift_v2.run_data_health_check()` via **pg_cron** (e.g. every 15 min) so
the snapshot stays fresh. This was intentionally omitted here. Until scheduled,
the table can be populated by a manual `select swift_v2.run_data_health_check();`
(service_role / SQL editor) after the migration is applied.

## Validation queries (read-only, run AFTER applying in a non-prod or approved context)

```sql
-- Grants: authenticated SELECT on the view, nothing for anon, no table access.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='swift_v2'
  and table_name in ('cockpit_system_health_checks','v_cockpit_system_health')
  and grantee in ('anon','authenticated');

-- RLS enabled on the base table.
select relname, relrowsecurity from pg_class
where relname = 'cockpit_system_health_checks';

-- Function hardening: SECURITY DEFINER + pinned search_path.
select proname, prosecdef, proconfig from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='swift_v2' and p.proname in ('run_data_health_check','_cockpit_health_upsert');

-- View exposes no PII columns.
select column_name from information_schema.columns
where table_schema='swift_v2' and table_name='v_cockpit_system_health';
```
