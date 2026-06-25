-- =============================================================================
-- Migration: swift_v2_0037_cockpit_company_activity_view
-- PHASE 0040 — Company activity (business description) source for the Cockpit
--
-- Purpose
--   Expose the EXISTING Arabic company-activity description so acquisition cards
--   can show "what does this company do?" on the card exterior, instead of the
--   insolvency/acquisition AI review (which stays inside expanded details).
--
--   Source: swift_v2.entity_ai_company_enrichment.summary_ar — already-generated
--   Arabic business descriptions (e.g. "تعمل الشركة في مجال خدمات الرعاية الطبية…").
--   ~439 distinct entities are covered today. This migration only READS that
--   cached enrichment; it generates nothing.
--
-- Shape: one row per entity (latest enrichment by generated_at), company only.
--
-- Access / security (mirrors the other internal cockpit views)
--   * security_invoker = false (SECURITY DEFINER) + active-cockpit-user gate;
--     anon / public get 0 rows.
--   * revoke from public, anon; grant select to authenticated only.
--   * Exposes ONLY entity_id + the Arabic activity summary + a source label.
--     NEVER reasoning_ar, raw_ai_output, evaluation_meta, or any insolvency text.
--   * Company data only — no natural-person / Nachlass fields. Never used by the
--     public portal.
--
-- Safety: non-destructive. CREATE OR REPLACE VIEW only. No table writes, no DROP,
--   no ALTER TABLE, no RLS changes, no new grants beyond authenticated SELECT.
-- =============================================================================

create or replace view swift_v2.v_cockpit_company_activity
  with (security_invoker = false) as
select distinct on (e.entity_id)
    e.entity_id,
    e.summary_ar                       as company_activity_summary_ar,
    'ai_company_enrichment'::text      as company_activity_source,
    e.generated_at                     as company_activity_generated_at
from swift_v2.entity_ai_company_enrichment e
where nullif(btrim(e.summary_ar), '') is not null
  and exists (
    select 1 from swift_v2.cockpit_user_profiles me
    where me.user_id = (select auth.uid()) and me.is_active
  )
order by e.entity_id, e.generated_at desc nulls last, e.created_at desc nulls last;

comment on view swift_v2.v_cockpit_company_activity is
  'PHASE 0040: latest Arabic company-activity description per entity (from entity_ai_company_enrichment.summary_ar) for the Cockpit card exterior. Active cockpit users only (anon = 0 rows). Company data only; exposes only entity_id + summary + source label — never reasoning/raw AI output/insolvency text. Never used by the public portal.';

revoke all on swift_v2.v_cockpit_company_activity from public, anon;
grant select on swift_v2.v_cockpit_company_activity to authenticated;
