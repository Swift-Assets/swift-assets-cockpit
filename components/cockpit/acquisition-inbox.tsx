"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AcquisitionCaseCard,
  type CaseCardData,
} from "@/components/cockpit/acquisition-case-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import type { AcquisitionInboxRow } from "@/lib/cockpit/acquisition-inbox.queries";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

type SegKey = "neu" | "watching" | "pursuing" | "passed" | "nachlass" | "all";

const SEGMENTS: { key: SegKey; label: string }[] = [
  { key: "neu", label: "Neue Fälle" },
  { key: "watching", label: "In Beobachtung" },
  { key: "pursuing", label: "Kontakt aufnehmen" },
  { key: "passed", label: "Ignoriert" },
  { key: "nachlass", label: "Nachlass" },
  { key: "all", label: "Alle" },
];

function inboxStatusToCard(s: AcquisitionInboxRow["inbox_status"]): CaseCardData["status"] {
  if (s === "neu") return "neu";
  if (s === "pursuing") return "pursuing";
  if (s === "passed") return "passed";
  return "watching";
}

function rowToCard(
  r: AcquisitionInboxRow,
  aiReviewByKey: Record<string, AiCaseReviewRow>,
  draftKeySet: Set<string>,
): CaseCardData {
  const isNachlass = r.kind === "nachlass";
  const watchKey = `${r.kind}:${r.watch_id ?? ""}`;
  return {
    key: r.case_key,
    kind: isNachlass ? "nachlass" : "company",
    source: r.source === "watchlist" ? "watch" : "lead",
    entityId: r.entity_id,
    watchId: r.watch_id,
    detectionId: r.detection_id,
    subjectId: isNachlass ? r.detection_id : r.entity_id,
    title: isNachlass
      ? (r.person_name ?? r.safe_display_label ?? "Nachlassverfahren")
      : (r.display_title ?? r.safe_display_label ?? "—"),
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
    handelsregisterStatus: r.handelsregister_status,
    bundesanzeigerStatus: r.bundesanzeiger_status,
    financialDataStatus: r.financial_data_status,
    missingDataFlags: r.missing_data_flags ?? [],
    sourceQualityFlags: r.source_quality_flags ?? [],
    status: inboxStatusToCard(r.inbox_status),
    summaryAr: r.watch_id ? (aiReviewByKey[watchKey]?.summary_ar ?? null) : null,
    hasDraft: r.watch_id ? draftKeySet.has(watchKey) : false,
  };
}

export function AcquisitionInbox({
  rows,
  aiReviewByKey,
  draftKeys,
}: {
  rows: AcquisitionInboxRow[];
  aiReviewByKey: Record<string, AiCaseReviewRow>;
  draftKeys: string[];
}) {
  const [segment, setSegment] = useState<SegKey>("neu");

  const { cards, counts } = useMemo(() => {
    const draftKeySet = new Set(draftKeys);
    const all = rows.map((r) => rowToCard(r, aiReviewByKey, draftKeySet));
    const counts: Record<SegKey, number> = {
      neu: all.filter((c) => c.status === "neu").length,
      watching: all.filter((c) => c.source === "watch" && c.status === "watching").length,
      pursuing: all.filter((c) => c.status === "pursuing").length,
      passed: all.filter((c) => c.status === "passed").length,
      nachlass: all.filter((c) => c.kind === "nachlass").length,
      all: all.length,
    };
    return { cards: all, counts };
  }, [rows, aiReviewByKey, draftKeys]);

  const visible = useMemo(() => {
    switch (segment) {
      case "neu":
        return cards.filter((c) => c.status === "neu");
      case "watching":
        return cards.filter((c) => c.source === "watch" && c.status === "watching");
      case "pursuing":
        return cards.filter((c) => c.status === "pursuing");
      case "passed":
        return cards.filter((c) => c.status === "passed");
      case "nachlass":
        return cards.filter((c) => c.kind === "nachlass");
      case "all":
      default:
        return cards;
    }
  }, [cards, segment]);

  return (
    <div className="space-y-5">
      {/* Segmented control */}
      <div className="cockpit-scroll flex gap-1 overflow-x-auto border border-border bg-card p-1">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2 text-[13px] font-medium tracking-wide transition-colors",
                active ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              <span className="text-[0.7rem] tabular-nums opacity-70">{counts[s.key]}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Keine Fälle in dieser Kategorie"
          description={
            segment === "neu"
              ? "Aktuell keine neuen Insolvenzfälle im Akquise-Fenster. Neue Bekanntmachungen erscheinen hier automatisch."
              : "Wechseln Sie die Kategorie oder fügen Sie über die Suche oben einen Fall hinzu."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <AcquisitionCaseCard key={c.key} data={c} />
          ))}
        </div>
      )}
    </div>
  );
}
