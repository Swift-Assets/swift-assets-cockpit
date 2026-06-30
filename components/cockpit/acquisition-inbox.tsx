"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AcquisitionCaseCard,
  type CaseCardData,
} from "@/components/cockpit/acquisition-case-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import type { AcquisitionInboxRow } from "@/lib/cockpit/acquisition-inbox.queries";
import type { CaseTimelineEvent } from "@/lib/cockpit/case-timeline.queries";
import { GATES, type Gate } from "@/lib/cockpit/acquisition-relevance";

// Keep in sync with sanitizeInboxLimit() in acquisition-inbox.queries.ts.
const MAX_SERVER_LIMIT = 1000;
const SERVER_STEP = 240;
const PAGE_SIZE = 24;

function inboxStatusToCard(s: AcquisitionInboxRow["inbox_status"]): CaseCardData["status"] {
  if (s === "neu") return "neu";
  if (s === "pursuing") return "pursuing";
  if (s === "passed") return "passed";
  return "watching";
}

function rowToCard(
  r: AcquisitionInboxRow,
  draftKeySet: Set<string>,
  timelineByEntityId: Record<string, CaseTimelineEvent[]>,
): CaseCardData {
  const watchKey = `${r.kind}:${r.watch_id ?? ""}`;
  const timeline = r.entity_id ? (timelineByEntityId[r.entity_id] ?? []) : [];
  return {
    key: r.case_key,
    kind: "company",
    source: r.source === "watchlist" ? "watch" : "lead",
    entityId: r.entity_id,
    watchId: r.watch_id,
    detectionId: r.detection_id,
    subjectId: r.entity_id,
    title: r.display_title ?? r.safe_display_label ?? "—",
    city: r.city,
    bundesland: r.bundesland,
    court: r.court,
    aktenzeichen: r.aktenzeichen,
    latestPhase: r.latest_phase,
    latestAnnouncementType: r.latest_announcement_type,
    phasePriority: r.phase_priority,
    preVerteilung: r.pre_verteilung_relevance,
    latestPublicationDate: r.latest_publication_date,
    administratorName: r.administrator_name,
    administratorEmail: r.administrator_email,
    administratorPhone: r.administrator_phone,
    administratorAddress: r.administrator_address,
    handelsregisterStatus: r.handelsregister_status,
    bundesanzeigerStatus: r.bundesanzeiger_status,
    financialDataStatus: r.financial_data_status,
    missingDataFlags: r.missing_data_flags ?? [],
    sourceQualityFlags: r.source_quality_flags ?? [],
    status: inboxStatusToCard(r.inbox_status),
    companyActivityAr: r.company_activity_ar,
    companyActivitySource: r.company_activity_source,
    companyActivityConfidence: r.company_activity_confidence,
    timeline,
    hasDraft: r.watch_id ? draftKeySet.has(watchKey) : false,
  };
}

const EMPTY_BY_GATE: Record<Gate, { title: string; description: string }> = {
  acquisition: {
    title: "Keine akquiserelevanten Fälle",
    description:
      "Aktuell keine neuen Firmenfälle im akquiserelevanten Fenster (vor der Verteilung). Spätphasen-Fälle finden Sie unter „Monitor“.",
  },
  watchlist: {
    title: "Keine beobachteten Fälle",
    description: "Übernehmen Sie Fälle mit „تابع“, um sie hier zu sammeln.",
  },
  ignored: {
    title: "Keine ignorierten Fälle",
    description: "Mit „اهمل“ ignorierte Fälle erscheinen hier.",
  },
  monitor: {
    title: "Keine Monitor-Fälle",
    description:
      "Spätphasen / geringwertige, rein verfahrensbezogene Fälle erscheinen hier.",
  },
  all: {
    title: "Keine Fälle",
    description: "Aktuell sind keine Fälle geladen.",
  },
};

export function AcquisitionInbox({
  rows,
  draftKeys,
  timelineByEntityId,
  gate,
  gateCounts,
  loadedCount,
  totalCount,
  serverLimit,
}: {
  rows: AcquisitionInboxRow[];
  draftKeys: string[];
  timelineByEntityId: Record<string, CaseTimelineEvent[]>;
  gate: Gate;
  gateCounts: Record<string, number | null>;
  loadedCount: number;
  totalCount: number | null;
  serverLimit: number;
}) {
  // Rows are already filtered SERVER-SIDE to the active gate; the client only
  // paginates the render window.
  const cards = useMemo(() => {
    const draftKeySet = new Set(draftKeys);
    return rows.map((r) => rowToCard(r, draftKeySet, timelineByEntityId));
  }, [rows, draftKeys, timelineByEntityId]);

  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [gate]);

  const visibleLimited = useMemo(
    () => cards.slice(0, visibleLimit),
    [cards, visibleLimit],
  );

  const empty = EMPTY_BY_GATE[gate];

  return (
    <div className="space-y-5">
      {/* Acquisition Gate tabs — server-driven (each is a ?gate= link). */}
      <div className="cockpit-scroll flex gap-1 overflow-x-auto border border-border bg-card p-1">
        {GATES.map((g) => {
          const active = gate === g.key;
          const count = gateCounts[g.key];
          return (
            <Link
              key={g.key}
              href={`/cockpit/watchlist?gate=${g.key}`}
              title={g.description}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2 text-[13px] font-medium tracking-wide transition-colors",
                active ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
              {typeof count === "number" ? (
                <span className="text-[0.7rem] tabular-nums opacity-70">{count}</span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleLimited.map((c) => (
              <AcquisitionCaseCard key={c.key} data={c} />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-xs tabular-nums text-muted-foreground">
              Zeige {visibleLimited.length} von {cards.length} geladenen Fällen
            </p>
            {cards.length > visibleLimit ? (
              <button
                type="button"
                onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}
                className="border border-border bg-card px-4 py-2 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-muted/60"
              >
                Mehr laden
              </button>
            ) : null}

            {totalCount !== null ? (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                Serverseitig geladen: {loadedCount.toLocaleString("de-DE")} von{" "}
                {totalCount.toLocaleString("de-DE")} Fällen
              </p>
            ) : null}
            {totalCount !== null &&
            totalCount > loadedCount &&
            serverLimit < MAX_SERVER_LIMIT ? (
              <Link
                href={`/cockpit/watchlist?gate=${gate}&limit=${Math.min(
                  serverLimit + SERVER_STEP,
                  MAX_SERVER_LIMIT,
                )}`}
                className="text-[12px] font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                Mehr vom Server laden
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
