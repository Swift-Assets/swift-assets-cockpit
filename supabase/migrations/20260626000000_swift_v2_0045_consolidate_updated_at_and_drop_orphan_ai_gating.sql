-- swift_v2 0045 — consolidate updated_at triggers + drop orphaned AI-gating cluster
--
-- Forward-only parity migration. Already applied in production during a manual
-- DB cleanup; this file records the exact statements so a fresh
-- `supabase db reset` matches prod. No data is created or modified.

-- 1) consolidate updated_at onto swift_v2.set_updated_at()
drop trigger if exists tg_cockpit_user_profiles_updated_at on swift_v2.cockpit_user_profiles;
create trigger tg_cockpit_user_profiles_updated_at
  before update on swift_v2.cockpit_user_profiles
  for each row execute function swift_v2.set_updated_at();
drop function if exists swift_v2.tg_set_updated_at();
drop function if exists public.set_updated_at();

-- 2) orphaned AI-gating + metrics cluster (referenced dropped tables; no live caller)
drop function if exists swift_v2.tg_enforce_ai_enrichment_gating();
drop function if exists swift_v2.ai_budget_today();
drop function if exists swift_v2.compute_daily_metrics(p_run_date date);
drop function if exists swift_v2.upsert_entity_pipeline_status(p_entity_id uuid, p_custom_search_status text, p_company_ai_status text, p_last_custom_search_at timestamp with time zone, p_last_company_ai_at timestamp with time zone, p_last_error_message text);
drop function if exists swift_v2.fn_is_company_eligible_for_ai(p_entity_id uuid);
drop function if exists swift_v2.get_ai_go_flag();
