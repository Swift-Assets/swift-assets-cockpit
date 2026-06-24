-- =============================================================================
-- Migration: swift_v2_0032_cockpit_system_health_actions
-- PRODUCT CORRECTION PHASE 7A — Operations reset/resolve actions
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION. Apply only after approval.
--
-- Adds writer-gated SECURITY DEFINER RPCs so an operator can, after inspecting
-- and fixing an issue, mark a system health check resolved / reopen it / re-run
-- the health checks. No schema change to cockpit_system_health_checks (it
-- already has resolved_at). Non-destructive.
--
-- Safety: writes via SECURITY DEFINER + _cockpit_writer_role() (analyst/lead/
-- admin) only; anon/public revoked. No RLS weakening. run_now wraps the
-- existing swift_v2.run_data_health_check().
-- =============================================================================

-- Mark a check as resolved (operator confirmed it was inspected/fixed).
create or replace function swift_v2.cockpit_resolve_system_health_check(
    p_check_key text
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    if p_check_key is null or length(btrim(p_check_key)) = 0 then
        raise exception 'invalid_check_key';
    end if;
    update swift_v2.cockpit_system_health_checks
       set resolved_at = now(), updated_at = now()
     where check_key = p_check_key;
    if not found then raise exception 'check_not_found'; end if;
    -- v_role referenced to enforce the writer gate.
    perform v_role;
end;
$$;
revoke all on function swift_v2.cockpit_resolve_system_health_check(text) from public, anon;
grant execute on function swift_v2.cockpit_resolve_system_health_check(text) to authenticated;

-- Reopen a previously resolved check.
create or replace function swift_v2.cockpit_reopen_system_health_check(
    p_check_key text
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    if p_check_key is null or length(btrim(p_check_key)) = 0 then
        raise exception 'invalid_check_key';
    end if;
    update swift_v2.cockpit_system_health_checks
       set resolved_at = null, updated_at = now()
     where check_key = p_check_key;
    if not found then raise exception 'check_not_found'; end if;
    perform v_role;
end;
$$;
revoke all on function swift_v2.cockpit_reopen_system_health_check(text) from public, anon;
grant execute on function swift_v2.cockpit_reopen_system_health_check(text) to authenticated;

-- Re-run the data health checks on demand (wraps existing routine).
create or replace function swift_v2.cockpit_run_health_check_now()
  returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
begin
    perform v_role;
    perform swift_v2.run_data_health_check();
end;
$$;
revoke all on function swift_v2.cockpit_run_health_check_now() from public, anon;
grant execute on function swift_v2.cockpit_run_health_check_now() to authenticated;

-- =============================================================================
-- POST-APPLY READ-ONLY VALIDATION:
--   select to_regprocedure('swift_v2.cockpit_resolve_system_health_check(text)') is not null;  -- t
--   select to_regprocedure('swift_v2.cockpit_reopen_system_health_check(text)')  is not null;  -- t
--   select to_regprocedure('swift_v2.cockpit_run_health_check_now()')            is not null;  -- t
--   -- prosecdef=t, search_path pinned, anon EXECUTE = false for each.
-- =============================================================================
