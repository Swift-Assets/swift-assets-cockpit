import { EmptyState } from "@/components/cockpit/empty-state";
import { PageHeader } from "@/components/cockpit/page-header";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { AcquisitionInbox } from "@/components/cockpit/acquisition-inbox";
import { getAcquisitionInbox } from "@/lib/cockpit/acquisition-inbox.queries";
import {
  activeOutreachDraftKeys,
  getOutreachDrafts,
} from "@/lib/cockpit/outreach.queries";
import {
  activeAiReviewByWatchKey,
  getAiCaseReviews,
} from "@/lib/cockpit/ai-reviews.queries";
import {
  companyActivityByEntityId,
  getCompanyActivitySummaries,
} from "@/lib/cockpit/company-activity.queries";

export const dynamic = "force-dynamic";

/**
 * Acquisition Inbox (Phase 0035C) — card-first workflow on the unified backend
 * view swift_v2.v_cockpit_acquisition_inbox (getAcquisitionInbox): new company +
 * new Nachlass + watched company/Nachlass cases in one safe source. Arabic AI
 * summaries (v_cockpit_ai_case_reviews) and active outreach-draft keys are still
 * loaded to enrich watched cards. All actions use existing SECURITY DEFINER
 * RPCs; no email is sent. Privacy: safe internal fields only — Nachlass
 * person_name is internal-only; no raw text/raw_json/source_snapshot.
 */
export default async function WatchlistPage() {
  const [inbox, drafts, aiReviews, activity] = await Promise.all([
    getAcquisitionInbox(),
    getOutreachDrafts(),
    getAiCaseReviews(),
    getCompanyActivitySummaries(),
  ]);

  const draftKeys = activeOutreachDraftKeys(drafts.rows);
  const aiReviewByKey = activeAiReviewByWatchKey(aiReviews.rows);
  const activityByEntityId = companyActivityByEntityId(activity.rows);

  const watchedCompanyIds = inbox.available
    ? inbox.rows
        .filter((r) => r.source === "watchlist" && r.kind === "company" && r.entity_id)
        .map((r) => r.entity_id as string)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Acquisition Inbox"
        title="Neue Insolvenzfälle"
        lead="Neue Insolvenzfälle, Beobachtung, Kontaktaufnahme und ignorierte Fälle — als Karten. Firmen- und Nachlassinsolvenzen für die interne Akquise."
      />

      <WatchlistAddPanel watchedCompanyIds={watchedCompanyIds} />

      {!inbox.available ? (
        <EmptyState
          title="Acquisition Inbox View nicht verfügbar."
          description="Die unified Inbox-View (v_cockpit_acquisition_inbox) ist derzeit nicht erreichbar. Bitte später erneut versuchen oder die Anwendung neu laden."
        />
      ) : inbox.rows.length === 0 ? (
        <EmptyState
          title="Noch keine Akquise-Fälle"
          description="Aktuell sind keine Insolvenzfälle im Akquise-Fenster erfasst und Ihre Watchlist ist leer. Neue Fälle erscheinen hier automatisch; Unternehmen können Sie über die Suche oben hinzufügen."
        />
      ) : (
        <AcquisitionInbox
          rows={inbox.rows}
          aiReviewByKey={aiReviewByKey}
          draftKeys={draftKeys}
          activityByEntityId={activityByEntityId}
        />
      )}
    </div>
  );
}
