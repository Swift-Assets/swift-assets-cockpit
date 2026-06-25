import { EmptyState } from "@/components/cockpit/empty-state";
import { PageHeader } from "@/components/cockpit/page-header";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { AcquisitionInbox } from "@/components/cockpit/acquisition-inbox";
import {
  getAcquisitionGateCounts,
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
import { GATES, sanitizeGate } from "@/lib/cockpit/acquisition-relevance";

export const dynamic = "force-dynamic";

/**
 * Acquisition Gate (Phase 0043) — acquisition-relevance triage over the unified
 * view swift_v2.v_cockpit_acquisition_inbox. The active gate (?gate=, default
 * "acquisition") is filtered SERVER-SIDE so the default view shows only NEW,
 * pre-Verteilung-relevant company cases — low-value/late-stage noise lives in the
 * "monitor"/"all" gates and nothing is deleted. Server-capped (?limit=, default
 * 240, max 1000). Company activity summaries are scoped to the loaded rows. All
 * actions use existing SECURITY DEFINER RPCs; no email sent. Privacy: safe
 * internal fields only — Nachlass person_name is internal-only; no raw
 * text/raw_json/source_snapshot.
 */
export default async function AcquisitionGatePage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; gate?: string }>;
}) {
  const { limit: limitParam, gate: gateParam } = await searchParams;
  const limit = sanitizeInboxLimit(limitParam);
  const gate = sanitizeGate(gateParam);

  const [inbox, drafts, gateCounts] = await Promise.all([
    getAcquisitionInbox({ limit, gate }),
    getOutreachDrafts(),
    getAcquisitionGateCounts(GATES.map((g) => g.key)),
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
        eyebrow="Acquisition Gate"
        title="Acquisition Gate"
        lead="Akquiserelevante Insolvenzfälle, Watchlist und ignorierte Fälle für die interne Akquise. Standard: neue, akquiserelevante Firmenfälle vor der Verteilung."
      />

      <WatchlistAddPanel watchedCompanyIds={watchedCompanyIds} />

      {!inbox.available ? (
        <EmptyState
          title="Acquisition Gate View nicht verfügbar."
          description="Die unified Inbox-View (v_cockpit_acquisition_inbox) ist derzeit nicht erreichbar. Bitte später erneut versuchen oder die Anwendung neu laden."
        />
      ) : (
        <AcquisitionInbox
          rows={inbox.rows}
          draftKeys={draftKeys}
          activityByEntityId={activityByEntityId}
          gate={gate}
          gateCounts={gateCounts}
          loadedCount={inbox.loadedCount}
          totalCount={inbox.totalCount}
          serverLimit={inbox.limit}
        />
      )}
    </div>
  );
}
