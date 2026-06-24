import { Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/cockpit/empty-state";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { WatchlistFilteredTable } from "@/components/cockpit/watchlist-filtered-table";
import { WatchlistAcquisitionFilteredTable } from "@/components/cockpit/watchlist-acquisition-filtered-table";
import { getMyWatchlist } from "@/lib/cockpit/watchlist.queries";
import { getInternalWatchlist } from "@/lib/cockpit/watchlist-internal.queries";
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
 * Unified acquisition watchlist (CORE PHASE 3).
 *
 * Primary table is driven by swift_v2.v_cockpit_watchlist_internal (enriched
 * acquisition data + inline status/note/follow-up editing + follow-up task +
 * outreach draft + remove + expandable detail). Falls back to the basic
 * v_cockpit_my_watchlist table if the internal view is unavailable. All writes
 * go through existing SECURITY DEFINER RPCs; no direct table DML. Privacy: only
 * non-sensitive columns; Nachlass uses safe labels only.
 */
export default async function WatchlistPage() {
  const [basic, tasksResult, internal, drafts, aiReviews] = await Promise.all([
    getMyWatchlist(),
    getMyTasks(),
    getInternalWatchlist(),
    getOutreachDrafts(),
    getAiCaseReviews(),
  ]);
  const openTaskKeys = openTaskContextKeys(tasksResult.rows);
  const draftKeys = activeOutreachDraftKeys(drafts.rows);
  const aiReviewByKey = activeAiReviewByWatchKey(aiReviews.rows);

  // Company entity_ids already on the watchlist, to mark "Bereits in Watchlist".
  const watchedCompanyIds = (
    internal.available
      ? internal.rows
          .filter((r) => r.kind === "company" && r.subject_id)
          .map((r) => r.subject_id as string)
      : basic.rows
          .filter((r) => r.kind === "company" && r.subject_id)
          .map((r) => r.subject_id as string)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Interne Akquise-Watchlist (Firmen & Nachlass) — angereicherte Daten,
            Bearbeitung, Follow-ups und Anfrage-Entwürfe an einem Ort.
          </p>
        </div>
        <Badge variant="green">Core 3 · Akquise</Badge>
      </div>

      <WatchlistAddPanel watchedCompanyIds={watchedCompanyIds} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Akquise-Watchlist</CardTitle>
          <CardDescription>
            {internal.available
              ? "Quelle: swift_v2.v_cockpit_watchlist_internal. Änderungen über gesicherte RPCs; Detailpanel je Zeile aufklappbar."
              : "Interne Erweiterung nicht verfügbar — Basis-Watchlist (v_cockpit_my_watchlist)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {internal.available ? (
            internal.rows.length === 0 ? (
              <EmptyState
                icon={<Star className="h-5 w-5" />}
                title="Noch keine Akquise-Fälle auf der Watchlist"
                description="Fügen Sie ein Unternehmen hinzu, um Bewertungen, Aufgaben und Entwürfe zu verwalten. Nutzen Sie die Suche oben („Unternehmen suchen“)."
              />
            ) : (
              <WatchlistAcquisitionFilteredTable
                rows={internal.rows}
                openTaskKeys={openTaskKeys}
                activeDraftKeys={draftKeys}
                aiReviewByKey={aiReviewByKey}
              />
            )
          ) : basic.error ? (
            <p className="text-sm text-status-yellow">{basic.error}</p>
          ) : basic.rows.length === 0 ? (
            <EmptyState
              icon={<Star className="h-5 w-5" />}
              title="Noch keine Akquise-Fälle auf der Watchlist"
              description="Fügen Sie ein Unternehmen hinzu, um Bewertungen, Aufgaben und Entwürfe zu verwalten. Nutzen Sie die Suche oben („Unternehmen suchen“)."
            />
          ) : (
            <WatchlistFilteredTable rows={basic.rows} openTaskKeys={openTaskKeys} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
