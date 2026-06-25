import { EmptyState } from "@/components/cockpit/empty-state";
import { PageHeader } from "@/components/cockpit/page-header";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { AcquisitionInbox } from "@/components/cockpit/acquisition-inbox";
import { getInternalWatchlist } from "@/lib/cockpit/watchlist-internal.queries";
import { getAcquisitionLeads } from "@/lib/cockpit/acquisition.queries";
import { getMyTasks } from "@/lib/cockpit/tasks.queries";
import { openTaskContextKeys } from "@/lib/cockpit/tasks";
import {
  activeOutreachDraftKeys,
  getOutreachDrafts,
} from "@/lib/cockpit/outreach.queries";
import {
  activeAiReviewByWatchKey,
  getAiCaseReviews,
} from "@/lib/cockpit/ai-reviews.queries";

export const dynamic = "force-dynamic";

/**
 * Acquisition Inbox (Phase 0035A) — card-first acquisition workflow.
 *
 * "Neue Fälle" are real, in-window company insolvency leads from
 * v_cockpit_company_announcements (getAcquisitionLeads) not yet watched.
 * Watched cases (company + Nachlass) come from v_cockpit_watchlist_internal.
 * Arabic AI summaries come from v_cockpit_ai_case_reviews where present;
 * otherwise a tasteful placeholder is shown (never fabricated). All actions use
 * existing SECURITY DEFINER RPCs; no email is sent. A tabular view is kept as a
 * collapsible fallback. Privacy: safe columns only — no raw text/raw_json/
 * source_snapshot; Nachlass uses safe labels from the approved internal view.
 */
export default async function WatchlistPage() {
  const [internal, leadsResult, tasksResult, drafts, aiReviews] =
    await Promise.all([
      getInternalWatchlist(),
      getAcquisitionLeads(60),
      getMyTasks(),
      getOutreachDrafts(),
      getAiCaseReviews(),
    ]);

  const watchedRows = internal.available ? internal.rows : [];
  const leads = leadsResult.available ? leadsResult.rows : [];
  const openTaskKeys = openTaskContextKeys(tasksResult.rows);
  const draftKeys = activeOutreachDraftKeys(drafts.rows);
  const aiReviewByKey = activeAiReviewByWatchKey(aiReviews.rows);

  const watchedCompanyIds = watchedRows
    .filter((r) => r.kind === "company" && r.subject_id)
    .map((r) => r.subject_id as string);

  const nothing = watchedRows.length === 0 && leads.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Acquisition Inbox"
        title="Neue Insolvenzfälle"
        lead="Neue Insolvenzfälle, Beobachtung, Kontaktaufnahme und ignorierte Fälle — als Karten. Firmen- und Nachlassinsolvenzen für die interne Akquise."
      />

      <WatchlistAddPanel watchedCompanyIds={watchedCompanyIds} />

      {nothing ? (
        <EmptyState
          title="Noch keine Akquise-Fälle"
          description="Aktuell sind keine neuen Insolvenzfälle im Akquise-Fenster erfasst und Ihre Watchlist ist leer. Neue Fälle erscheinen hier automatisch; Unternehmen können Sie über die Suche oben hinzufügen."
        />
      ) : (
        <AcquisitionInbox
          watchedRows={watchedRows}
          leads={leads}
          aiReviewByKey={aiReviewByKey}
          draftKeys={draftKeys}
          openTaskKeys={openTaskKeys}
        />
      )}
    </div>
  );
}
