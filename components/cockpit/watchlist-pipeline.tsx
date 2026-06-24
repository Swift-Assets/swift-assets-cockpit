"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { WatchlistAcquisitionFilteredTable } from "@/components/cockpit/watchlist-acquisition-filtered-table";
import { EmptyState } from "@/components/cockpit/empty-state";
import { followUpBucket } from "@/lib/cockpit/watchlist";
import type { InternalWatchlistRow } from "@/lib/cockpit/watchlist-internal.queries";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

/**
 * Acquisition pipeline view (Phase 7A). Segments the watchlist into operational
 * stages, then renders the existing acquisition table for the selected segment.
 *
 * Status mapping note: the backend `cockpit_company_watchlist.status` only
 * supports {watching, pursuing, passed}. The pipeline maps onto those plus
 * derived buckets:
 *   - Neue Fälle        = watching + kein Follow-up gesetzt (noch nicht triagiert)
 *   - In Beobachtung    = watching + Follow-up gesetzt
 *   - Follow-up fällig  = Follow-up heute/überfällig (außer „passed“)
 *   - Kontakt aufnehmen = pursuing
 *   - Ignoriert         = passed
 *   - Archiviert/Erledigt = (kein DB-Status vorhanden — siehe Hinweis)
 */
type SegmentKey =
  | "all"
  | "new"
  | "monitoring"
  | "followup"
  | "contact"
  | "ignored"
  | "archived";

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "new", label: "Neue Fälle" },
  { key: "monitoring", label: "In Beobachtung" },
  { key: "followup", label: "Follow-up fällig" },
  { key: "contact", label: "Kontakt aufnehmen" },
  { key: "ignored", label: "Ignoriert" },
  { key: "archived", label: "Archiviert / Erledigt" },
];

function matches(row: InternalWatchlistRow, seg: SegmentKey, now: Date): boolean {
  const due = (() => {
    const b = followUpBucket(row.next_follow_up_at, now);
    return b === "overdue" || b === "today";
  })();
  switch (seg) {
    case "all":
      return true;
    case "new":
      return row.status === "watching" && !row.next_follow_up_at;
    case "monitoring":
      return row.status === "watching" && Boolean(row.next_follow_up_at);
    case "followup":
      return due && row.status !== "passed";
    case "contact":
      return row.status === "pursuing";
    case "ignored":
      return row.status === "passed";
    case "archived":
      return false; // no archived/done status in the backend yet
    default:
      return false;
  }
}

export function WatchlistPipeline({
  rows,
  openTaskKeys = [],
  activeDraftKeys = [],
  aiReviewByKey = {},
}: {
  rows: InternalWatchlistRow[];
  openTaskKeys?: string[];
  activeDraftKeys?: string[];
  aiReviewByKey?: Record<string, AiCaseReviewRow>;
}) {
  const [segment, setSegment] = useState<SegmentKey>("all");
  const now = useMemo(() => new Date(), []);

  const counts = useMemo(() => {
    const c = {} as Record<SegmentKey, number>;
    for (const s of SEGMENTS) c[s.key] = rows.filter((r) => matches(r, s.key, now)).length;
    return c;
  }, [rows, now]);

  const filtered = useMemo(
    () => rows.filter((r) => matches(r, segment, now)),
    [rows, segment, now],
  );

  return (
    <div className="space-y-4">
      {/* Segmented control */}
      <div className="cockpit-scroll flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.7rem] tabular-nums",
                  active ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground",
                )}
              >
                {counts[s.key]}
              </span>
            </button>
          );
        })}
      </div>

      {segment === "archived" ? (
        <EmptyState
          title="Noch nicht verfügbar"
          description="Ein Status „Archiviert / Erledigt“ existiert im Backend noch nicht (verfügbar sind: Beobachten, In Prüfung, Abgelehnt). Diese Stufe wird aktiviert, sobald der Watchlist-Status erweitert wurde."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Fälle in dieser Stufe"
          description="Wechseln Sie die Stufe oder fügen Sie über die Suche oben einen Fall hinzu."
        />
      ) : (
        <WatchlistAcquisitionFilteredTable
          rows={filtered}
          openTaskKeys={openTaskKeys}
          activeDraftKeys={activeDraftKeys}
          aiReviewByKey={aiReviewByKey}
        />
      )}
    </div>
  );
}
