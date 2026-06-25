import { EmptyState } from "@/components/cockpit/empty-state";
import { PageHeader } from "@/components/cockpit/page-header";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { AcquisitionInbox } from "@/components/cockpit/acquisition-inbox";
import {
  getAcquisitionInbox,
  sanitizeInboxLimit,
} from "@/lib/cockpit/acquisition-inbox.queries";
import {
  activeOutreachDraftKeys,
  getOutreachDrafts,
} from "@/lib/cockpit/outreach.queries";
import {
  companyActivityByEntityId,
  getCompanyActivitySummariesForEntities,
} from "@/lib/cockpit/company-activity.queries";

export const dynamic = "force-dynamic";

/**
 * Acquisition Inbox — card-first workflow on the unified backend view
 * swift_v2.v_cockpit_acquisition_inbox (getAcquisitionInbox): new company + new
 * Nachlass + watched company/Nachlass cases in one safe source. The inbox is
 * capped SERVER-SIDE (default 240, max 1000 via ?limit=) so the page never loads
 * the full ~21k result. Company activity summaries are loaded only for the
 * loaded entity IDs. All actions use existing SECURITY DEFINER RPCs; no email is
 * sent. Privacy: safe internal fields only — Nachlass person_name is
 * internal-only; no raw text/raw_json/source_snapshot.
 */
export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const { limit: limitParam } = await searchParams;
  const limit = sanitizeInboxLimit(limitParam);

  // Inbox first (server-capped); company activity is scoped to the loaded rows.
  const [inbox, drafts] = await Promise.all([
    getAcquisitionInbox({ limit }),
    getOutreachDrafts(),
  ]);

  const companyEntityIds = inbox.available
    ? inbox.rows
        .filter((r) => r.kind === "company" && r.entity_id)
        .map((r) => r.entity_id as string)
    : [];

  const activity = await getCompanyActivitySummariesForEntities(companyEntityIds);

  const draftKeys = activeOutreachDraftKeys(drafts.rows);
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
          draftKeys={draftKeys}
          activityByEntityId={activityByEntityId}
          loadedCount={inbox.loadedCount}
          totalCount={inbox.totalCount}
          serverLimit={inbox.limit}
        />
      )}
    </div>
  );
}
