-- =============================================================================
-- Cockpit smoke tests (READ-ONLY)
-- Project: hqyktreytsjeirlpnnyr   Schema: swift_v2
--
-- SAFETY: This file contains ONLY read-only SELECTs. It performs NO insert,
-- update, delete, truncate, or DDL, and assumes NO service_role. Some checks
-- can only be fully verified from a real authenticated session (see Section F);
-- when run as postgres/MCP, auth.uid() is NULL so row-level/JWT behavior is not
-- exercised — structural checks still hold.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Migration records — confirm the key migrations are applied.
--    Expect one row per name (6 rows).
-- -----------------------------------------------------------------------------
select name
from supabase_migrations.schema_migrations
where name in (
    'swift_v2_0028_cockpit_watchlist_internal_outreach', -- watchlist + outreach
    'swift_v2_0026_cockpit_tasks',                        -- tasks
    'swift_v2_0029_cockpit_ai_case_reviews',             -- AI review
    'swift_v2_0030_cockpit_ai_outreach_drafts',          -- AI outreach
    'swift_v2_0031_lock_down_nachlass_review_views'      -- Nachlass lock-down
)
order by name;

-- -----------------------------------------------------------------------------
-- B. Cockpit object counts (tables / views / functions).
--    Edge Functions CANNOT be checked via SQL — verify in the Supabase
--    dashboard / MCP: generate-watchlist-ai-review, generate-outreach-email-draft
--    (both must be ACTIVE with verify_jwt = true).
-- -----------------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
     where table_schema='swift_v2' and table_type='BASE TABLE'
       and table_name like 'cockpit_%')                                   as cockpit_tables,
  (select count(*) from information_schema.views
     where table_schema='swift_v2' and table_name like 'v_cockpit_%')     as cockpit_views,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='swift_v2' and p.proname like 'cockpit_%')           as cockpit_functions;

-- -----------------------------------------------------------------------------
-- C. RLS / security checks.
-- -----------------------------------------------------------------------------
-- C1. Key cockpit base tables have RLS enabled (expect rowsecurity = true).
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='swift_v2'
  and c.relkind='r'
  and c.relname in (
    'cockpit_company_watchlist','cockpit_nachlass_watchlist',
    'cockpit_tasks','cockpit_task_events',
    'cockpit_outreach_drafts','cockpit_outreach_events',
    'cockpit_ai_case_reviews','cockpit_ai_case_review_events',
    'cockpit_user_profiles'
  )
order by c.relname;

-- C2. v_cockpit_ai_case_reviews must NOT expose source_snapshot (expect 0).
select count(*) as ai_review_source_snapshot_exposed
from information_schema.columns
where table_schema='swift_v2' and table_name='v_cockpit_ai_case_reviews'
  and column_name='source_snapshot';

-- C3. v_cockpit_outreach_drafts must NOT expose metadata or source_snapshot
--     (expect 0), but MUST expose generation_mode + ai_model_name (expect 2).
select
  (select count(*) from information_schema.columns
     where table_schema='swift_v2' and table_name='v_cockpit_outreach_drafts'
       and column_name in ('metadata','source_snapshot'))            as forbidden_cols,
  (select count(*) from information_schema.columns
     where table_schema='swift_v2' and table_name='v_cockpit_outreach_drafts'
       and column_name in ('generation_mode','ai_model_name'))       as expected_ai_cols;

-- C4. Nachlass review views include the nachlass_authorized gate (expect t/t).
select
  pg_get_viewdef('swift_v2.v_cockpit_nachlass_review_full'::regclass)  ilike '%nachlass_authorized%' as full_gated,
  pg_get_viewdef('swift_v2.v_cockpit_nachlass_review_queue'::regclass) ilike '%nachlass_authorized%' as queue_gated;

-- C5. Watchlist-internal view must not leak raw text/private natural-person
--     fields (expect 0). (deceased_name lives only in the gated snapshot RPC,
--     not in this view.)
select count(*) as watchlist_internal_forbidden_cols
from information_schema.columns
where table_schema='swift_v2' and table_name='v_cockpit_watchlist_internal'
  and column_name in ('announcement_text','source_excerpt','detection_reasoning_ar',
                      'deceased_name','debtor_name','birth_date','source_url');

-- -----------------------------------------------------------------------------
-- D. Function privilege checks (AI / outreach RPCs).
--    Expect: security_definer=true, search_path pinned, anon CANNOT execute,
--    authenticated CAN execute.
-- -----------------------------------------------------------------------------
select p.proname,
       p.prosecdef as security_definer,
       (p.proconfig::text ilike '%search_path=swift_v2, public, pg_catalog%') as search_path_pinned,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_exec,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_can_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='swift_v2'
  and p.proname in (
    'cockpit_get_outreach_ai_snapshot',
    'cockpit_has_active_outreach_draft',
    'cockpit_store_ai_outreach_draft',
    'cockpit_create_ai_case_review_request',
    'cockpit_store_ai_case_review_result',
    'cockpit_fail_ai_case_review'
  )
order by p.proname;
-- Interpretation: every row should be security_definer=t, search_path_pinned=t,
-- authenticated_can_exec=t, anon_can_exec=f.

-- -----------------------------------------------------------------------------
-- E. Empty-state checks (current counts; informational).
-- -----------------------------------------------------------------------------
select
  (select count(*) from swift_v2.cockpit_company_watchlist)  as company_watchlist_rows,
  (select count(*) from swift_v2.cockpit_nachlass_watchlist) as nachlass_watchlist_rows,
  (select count(*) from swift_v2.cockpit_tasks)              as tasks,
  (select count(*) from swift_v2.cockpit_outreach_drafts)    as outreach_drafts,
  (select count(*) from swift_v2.cockpit_ai_case_reviews)    as ai_reviews;

-- -----------------------------------------------------------------------------
-- F. Safety notes — what these tests CANNOT prove without a real session.
--
--   * Row-level visibility: views gate on auth.uid(); as postgres/MCP,
--     auth.uid() is NULL, so "non-authorized = 0 rows" vs "authorized sees
--     rows" must be confirmed with two real JWTs (a normal active user and a
--     nachlass_authorized user) from the live app.
--   * anon being denied SELECT on the Nachlass views: confirm via the REST/
--     PostgREST layer with the anon key (or `set role anon;` in a session that
--     allows it), not via this postgres-context script.
--   * Edge Functions (generate-watchlist-ai-review, generate-outreach-email-draft):
--     status/verify_jwt and OPENAI_API_KEY presence are dashboard/MCP checks,
--     not SQL.
--   * No real AI generation should be triggered from here (no inserts/calls).
-- =============================================================================
