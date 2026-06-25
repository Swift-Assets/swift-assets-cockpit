-- =============================================================================
-- Migration: swift_v2_0043_cockpit_insolvency_admin_soft_cleanup
-- PHASE 0050A — Soft-quarantine existing false-positive administrators
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit approval (PHASE 0050B), AND after migration 0042.
--
-- What it does (NON-DESTRUCTIVE):
--   Classifies every still-'unreviewed' administrator with the deterministic
--   classifier and writes quality_status / quality_reason / is_visible /
--   quality_checked_at / quality_checked_by. Clearly invalid identities become
--   is_visible=false (and are hidden by the view). NO rows are deleted; NO
--   mentions are removed; NO source announcement rows are touched.
--
--   Read-only preview (PHASE 0050A) over 2,159 admins:
--     invalid ≈ 12   (hidden),  suspect ≈ 142 (visible, flagged),  valid ≈ 2,005
--     → visible after cleanup ≈ 2,147.
--
--   Safe to re-run: only rows still 'unreviewed' are touched, so a manual review
--   (valid/suspect/invalid/quarantined) is never overwritten.
-- =============================================================================

update swift_v2.insolvency_administrators ad
set quality_status     = (c.classification->>'quality_status'),
    quality_reason     = (c.classification->>'reason'),
    is_visible         = (c.classification->>'is_visible')::boolean,
    quality_checked_at = now(),
    quality_checked_by = 'phase_0050',
    updated_at         = now()
from lateral (
    select swift_v2.fn_classify_insolvency_administrator_identity(
        ad.display_name, ad.email, ad.phone, ad.address, ad.source_count
    ) as classification
) c
where ad.quality_status = 'unreviewed';
