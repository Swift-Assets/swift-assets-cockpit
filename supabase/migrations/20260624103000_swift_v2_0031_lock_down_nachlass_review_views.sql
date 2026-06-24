-- =============================================================================
-- Migration: swift_v2_0031_lock_down_nachlass_review_views
-- CORE PHASE 6A-S1 — Security lock-down of existing Nachlass review views
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval. Apply this BEFORE migration 0030
-- and BEFORE deploying the generate-outreach-email-draft Edge Function.
--
-- Problem fixed:
--   swift_v2.v_cockpit_nachlass_review_full and
--   swift_v2.v_cockpit_nachlass_review_queue were SELECTable by ANY
--   authenticated user with NO authorization gate in their own definitions.
--   They run as definer (security_invoker = false) so base-table RLS does not
--   protect them. v_cockpit_nachlass_review_full exposes sensitive internal
--   Nachlass data (detection_reasoning_ar, source_excerpt, deceased_name,
--   deceased_city, announcement_text, source_url, administrator contact, etc.).
--
-- Fix:
--   Recreate BOTH cockpit-facing views with an authorization gate that returns
--   ZERO rows unless the caller is an active cockpit user with
--   nachlass_authorized = true. Columns are preserved exactly (no data shape
--   change for authorized reviewers). Grants are reaffirmed: revoke from
--   public/anon; grant select to authenticated (safe only because the view now
--   self-filters to 0 rows for non-authorized users).
--
-- Non-goals / safety:
--   * Underlying swift_v2.v_nachlass_review_queue is NOT changed and is NOT
--     granted to authenticated (only postgres/service_role) — left as-is.
--   * NO columns removed. NO base tables/RLS changed. NO destructive change.
--   * NO public portal change. NO AI outreach logic change. NO email/SMTP.
--   * Views kept as definer (security_invoker = false) so authorized reviewers
--     keep seeing rows; the new WHERE EXISTS gate is the access control.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) v_cockpit_nachlass_review_full — recreate with nachlass_authorized gate.
--    Column list reproduced verbatim from the current definition; only a
--    WHERE EXISTS authorization gate is added.
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_nachlass_review_full
  with (security_invoker = false) as
select
    r.review_id,
    r.review_status,
    r.priority,
    r.assigned_to,
    r.reviewed_by,
    r.reviewed_at,
    r.decision_reason,
    r.review_notes,
    r.published_at,
    r.unpublished_at,
    r.expired_at,
    r.created_at as review_created_at,
    r.updated_at as review_updated_at,
    d.detection_id,
    d.entity_id,
    d.is_nachlass_candidate,
    d.deceased_estate_signal_score,
    d.detection_reasoning_ar,
    d.source_excerpt,
    d.opportunity_window_start,
    d.opportunity_window_end,
    d.delete_after,
    case
        when d.opportunity_window_end is null then null::integer
        else (d.opportunity_window_end - current_date)
    end as days_remaining_in_window,
    ann.case_number,
    ann.case_type,
    ann.court,
    ann.court_normalized,
    ann.announcement_date,
    ann.announcement_type_hint,
    ann.debtor_name as deceased_name,
    ann.debtor_city as deceased_city,
    ann.insolvency_admin_name,
    ann.insolvency_admin_email,
    ann.insolvency_admin_phone,
    ann.announcement_text,
    ann.source_url,
    d.estate_summary_ar,
    d.estate_asset_categories,
    d.estate_extracted_at
from swift_v2.nachlass_opportunity_reviews r
join swift_v2.nachlass_detection_results d on d.detection_id = r.detection_id
left join swift_v2.raw_insolvency_announcements ann on ann.id::text = d.source_announcement_id
where exists (
    select 1
    from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid())
      and me.is_active
      and me.nachlass_authorized
);

comment on view swift_v2.v_cockpit_nachlass_review_full is
  'INTERNAL Nachlass review view. Rows visible ONLY to active cockpit users with nachlass_authorized = true (WHERE EXISTS gate; anon/non-authorized = 0 rows). Contains sensitive review data (deceased name/city, source excerpt, detection reasoning, raw announcement text, administrator contact) — MUST NEVER be exposed in the public portal.';

-- ---------------------------------------------------------------------------
-- 2) v_cockpit_nachlass_review_queue — recreate with the same gate.
--    Wraps swift_v2.v_nachlass_review_queue (unchanged). Column list reproduced
--    verbatim from the current definition; only a WHERE EXISTS gate is added.
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_nachlass_review_queue
  with (security_invoker = false) as
select
    q.review_id,
    q.review_status,
    q.priority,
    q.assigned_to,
    q.reviewed_by,
    q.reviewed_at,
    q.decision_reason,
    q.review_notes,
    q.published_at,
    q.unpublished_at,
    q.expired_at,
    q.review_created_at,
    q.review_updated_at,
    q.detection_id,
    q.entity_id,
    q.is_nachlass_candidate,
    q.deceased_estate_signal_score,
    q.detection_reasoning_ar,
    q.opportunity_window_start,
    q.opportunity_window_end,
    q.delete_after,
    q.days_remaining_in_window,
    q.announcement_date,
    q.case_number,
    q.case_type,
    q.court,
    q.court_normalized,
    q.announcement_type_hint
from swift_v2.v_nachlass_review_queue q
where exists (
    select 1
    from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid())
      and me.is_active
      and me.nachlass_authorized
);

comment on view swift_v2.v_cockpit_nachlass_review_queue is
  'INTERNAL Nachlass review queue. Rows visible ONLY to active cockpit users with nachlass_authorized = true (WHERE EXISTS gate; anon/non-authorized = 0 rows). Contains sensitive review data (detection reasoning, case identifiers) — MUST NEVER be exposed in the public portal.';

-- ---------------------------------------------------------------------------
-- 3) Reaffirm grants. Safe to keep SELECT for authenticated ONLY because each
--    view now self-filters to 0 rows unless the caller is nachlass_authorized.
-- ---------------------------------------------------------------------------
revoke all on swift_v2.v_cockpit_nachlass_review_full  from public, anon;
revoke all on swift_v2.v_cockpit_nachlass_review_queue from public, anon;
grant select on swift_v2.v_cockpit_nachlass_review_full  to authenticated;
grant select on swift_v2.v_cockpit_nachlass_review_queue to authenticated;

-- =============================================================================
-- POST-APPLY READ-ONLY SMOKE TESTS (run manually after production apply):
--
--   -- a) anon must get a permission error (no SELECT grant):
--   set role anon;
--   select count(*) from swift_v2.v_cockpit_nachlass_review_full;   -- expect: permission denied
--   reset role;
--
--   -- b) authenticated CAN select (no error) but a NON-nachlass_authorized
--   --    user gets 0 rows (run as such a JWT from the app / supabase client):
--   --    select count(*) from swift_v2.v_cockpit_nachlass_review_full; -> 0
--   --    select count(*) from swift_v2.v_cockpit_nachlass_review_queue; -> 0
--
--   -- c) a nachlass_authorized active user sees rows (run from such a session).
--
--   -- d) view definitions include the nachlass_authorized gate:
--   select pg_get_viewdef('swift_v2.v_cockpit_nachlass_review_full'::regclass) ilike '%nachlass_authorized%';   -- expect: true
--   select pg_get_viewdef('swift_v2.v_cockpit_nachlass_review_queue'::regclass) ilike '%nachlass_authorized%';  -- expect: true
-- =============================================================================
