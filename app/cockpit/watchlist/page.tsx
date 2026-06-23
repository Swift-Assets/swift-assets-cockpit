import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WatchlistRow } from "@/components/cockpit/watchlist-row";
import { WatchlistAddPanel } from "@/components/cockpit/watchlist-add-panel";
import { getMyWatchlist } from "@/lib/cockpit/watchlist.queries";

export const dynamic = "force-dynamic";

/**
 * Operational watchlist (Phase 5A).
 *
 * Reads swift_v2.v_cockpit_my_watchlist (RLS-gated to the current user) and
 * exposes status / note / follow-up / remove actions. ALL writes go through the
 * existing SECURITY DEFINER RPCs from migration 0023 (see actions.ts) — there is
 * no direct table DML from the frontend.
 *
 * Privacy: only non-sensitive columns are rendered. Nachlass detail fields
 * (deceased name, estate summary, asset categories, score) are never selected or
 * shown here.
 */
const HEADERS = [
  "Typ",
  "Name / Fall",
  "Ort / Bundesland",
  "Status",
  "Notiz",
  "Follow-up",
  "Letztes Update",
  "Aktionen",
];

export default async function WatchlistPage() {
  const { rows, error } = await getMyWatchlist();

  // Company entity_ids already on the watchlist, to mark "Bereits in Watchlist".
  const watchedCompanyIds = rows
    .filter((r) => r.kind === "company" && r.subject_id)
    .map((r) => r.subject_id as string);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Interne Akquisitions-Watchlist (Firmen & Nachlass). Status, Notiz und
            Follow-up können bearbeitet werden.
          </p>
        </div>
        <Badge variant="green">Phase 5A · aktiv</Badge>
      </div>

      <WatchlistAddPanel watchedCompanyIds={watchedCompanyIds} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meine Watchlist</CardTitle>
          <CardDescription>
            Quelle: swift_v2.v_cockpit_my_watchlist (RLS-geschützt, nur eigene
            Einträge). Änderungen erfolgen ausschließlich über gesicherte RPCs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-status-yellow">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge in Ihrer Watchlist.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {HEADERS.map((h) => (
                      <th key={h} className="py-2 pr-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <WatchlistRow key={row.watch_id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
