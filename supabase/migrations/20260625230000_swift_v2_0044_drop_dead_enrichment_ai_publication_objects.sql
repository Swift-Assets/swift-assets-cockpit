-- swift_v2 0044 — drop dead enrichment / AI-case-review / publication-review objects
--
-- Forward-only parity migration. These objects were ALREADY dropped in
-- production during a manual DB cleanup; this file records the exact idempotent
-- DROP statements so a fresh `supabase db reset` matches prod. Idempotent
-- (IF EXISTS) — safe to re-run. No data is created or modified.

-- views (6)
drop view if exists swift_v2.v_cockpit_company_web_search;
drop view if exists swift_v2.v_retention_purge_queue;
drop view if exists swift_v2.v_cockpit_ai_case_reviews;
drop view if exists swift_v2.v_cockpit_company_activity;
drop view if exists swift_v2.v_cockpit_enrichment_jobs;
drop view if exists swift_v2.v_cockpit_review_inbox;

-- publication-review functions (8)
drop function if exists swift_v2.fn_approve_publication_review(p_review_id uuid, p_actor uuid, p_actor_role text, p_review_notes text);
drop function if exists swift_v2.fn_publish_publication_review(p_review_id uuid, p_actor uuid, p_actor_role text, p_review_notes text);
drop function if exists swift_v2.fn_reject_publication_review(p_review_id uuid, p_actor uuid, p_rejection_reason text, p_actor_role text, p_review_notes text);
drop function if exists swift_v2.fn_unpublish_publication_review(p_review_id uuid, p_actor uuid, p_reason text, p_actor_role text, p_review_notes text);
drop function if exists swift_v2.fn_cockpit_approve_publication(p_review_id uuid, p_review_notes text);
drop function if exists swift_v2.fn_cockpit_reject_publication(p_review_id uuid, p_rejection_reason text, p_review_notes text);
drop function if exists swift_v2.tg_pub_review_audit_log();
drop function if exists swift_v2.tg_pub_review_status_timestamps();

-- evaluation/report functions (3)
drop function if exists swift_v2.promote_enrichment_to_evaluation(p_enrichment_id uuid, p_priority text, p_acquisition_score integer, p_phase_window text, p_publish_recommendation text, p_risk_flags text[], p_recommended_next_action text);
drop function if exists swift_v2.fn_promote_evaluation_to_report(p_evaluation_id uuid, p_min_score integer, p_disclaimer_version text);
drop function if exists swift_v2.fn_auto_promote_evaluations(p_limit integer, p_min_score integer);

-- AI case-review functions (6)
drop function if exists swift_v2.cockpit_create_ai_case_review_request(p_watch_kind text, p_watch_id uuid);
drop function if exists swift_v2.cockpit_store_ai_case_review_result(p_review_id uuid, p_summary_ar text, p_summary_de text, p_acquisition_score integer, p_priority text, p_reasoning_ar text, p_risk_flags jsonb, p_recommended_next_action text, p_confidence text, p_model_provider text, p_model_name text);
drop function if exists swift_v2.cockpit_fail_ai_case_review(p_review_id uuid, p_error_code text, p_error_message text);
drop function if exists swift_v2.cockpit_archive_ai_case_review(p_review_id uuid);
drop function if exists swift_v2.cockpit_get_ai_case_review_source_snapshot(p_review_id uuid);
drop function if exists swift_v2._cockpit_ai_review_event(p_review_id uuid, p_event_type text, p_note text, p_details jsonb);

-- redundant unattached updated_at trigger fns (2)
drop function if exists swift_v2.tg_siihs_set_updated_at();
drop function if exists swift_v2.touch_updated_at();

-- junk (1)
drop function if exists public.normalize_jungle_case_update_case_id();

-- duplicate indexes (2)
drop index if exists swift_v2.idx_portal_entities_registry_key;
drop index if exists swift_v2.idx_portal_entities_fallback_key;
