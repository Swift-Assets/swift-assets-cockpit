-- =============================================================================
-- Migration: swift_v2_0027_cockpit_users_view
-- Phase 6I — Safe internal cockpit users list (for the task assignee picker)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Exposes a MINIMAL, internal-only list of ACTIVE cockpit users so tasks can be
-- assigned. It does NOT touch auth.users, does NOT weaken the base table RLS
-- (cockpit_user_profiles keeps its self-read-only policy), and returns rows ONLY
-- to active cockpit users.
--
-- Safety:
--   * Columns limited to user_id, display_name, email, role, is_active.
--   * No auth.users, no metadata/tokens/provider/last-login/identities.
--   * SECURITY DEFINER view (base table is self-read-only) + active-cockpit-user
--     gate via EXISTS(auth.uid()); non-cockpit / anon callers get ZERO rows.
--   * anon/public revoked; authenticated granted SELECT (row-gated).
--   * No functions, no DML, no changes to existing policies.
-- =============================================================================

create or replace view swift_v2.v_cockpit_users
  with (security_invoker = false) as
select
    p.user_id,
    p.display_name,
    p.email,
    p.role::text as role,
    p.is_active
from swift_v2.cockpit_user_profiles p
where p.is_active
  and exists (
    select 1
    from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid())
      and me.is_active
  );

comment on view swift_v2.v_cockpit_users is
  'Phase 6I: minimal list of ACTIVE internal cockpit users for task assignment. Visible only to active cockpit users (anon = 0 rows). Exposes user_id/display_name/email/role/is_active only — never auth.users, tokens, metadata, or PII beyond the internal staff profile.';

revoke all on swift_v2.v_cockpit_users from public;
revoke all on swift_v2.v_cockpit_users from anon;
grant select on swift_v2.v_cockpit_users to authenticated;
