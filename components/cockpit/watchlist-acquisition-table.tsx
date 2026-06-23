import { WatchlistAcquisitionRow } from "@/components/cockpit/watchlist-acquisition-row";
import type { InternalWatchlistRow } from "@/lib/cockpit/watchlist-internal.queries";

const HEADERS = [
  "",
  "Typ",
  "Fall",
  "Ort",
  "Gericht / Az.",
  "Phase",
  "Verwalter",
  "Outreach",
  "Status",
  "Follow-up",
  "Aktionen",
];

/**
 * Unified acquisition watchlist table (CORE PHASE 3). One dense table driven by
 * v_cockpit_watchlist_internal: enriched data + inline status/note/follow-up
 * editing + follow-up task + outreach draft + remove + expandable detail panel.
 */
export function WatchlistAcquisitionTable({
  rows,
  openTaskKeys = [],
  activeDraftKeys = [],
}: {
  rows: InternalWatchlistRow[];
  openTaskKeys?: string[];
  activeDraftKeys?: string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {HEADERS.map((h, i) => (
              <th key={i} className="py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <WatchlistAcquisitionRow
              key={row.watch_id}
              row={row}
              openTaskKeys={openTaskKeys}
              activeDraftKeys={activeDraftKeys}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
