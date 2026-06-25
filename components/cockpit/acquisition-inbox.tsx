"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AcquisitionCaseCard,
  type CaseCardData,
} from "@/components/cockpit/acquisition-case-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import type { AcquisitionInboxRow } from "@/lib/cockpit/acquisition-inbox.queries";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

type SegKey = "neu" | "watching" | "pursuing" | "passed" | "nachlass" | "all";
type TypeKey = "all" | "company" | "nachlass";

const TYPE_FILTERS: { key: TypeKey; label: string }[] = [
  { key: "all", label: "Alle Typen" },
  { key: "company", label: "Firma" },
  { key: "nachlass", label: "Nachlass" },
];

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
  activityByEntityId: Record<string, string>,
): CaseCardData {
  const isNachlass = r.kind === "nachlass";
  const watchKey = `${r.kind}:${r.watch_id ?? ""}`;
  const review = r.watch_id ? aiReviewByKey[watchKey] : undefined;
  const companyActivityAr =
    !isNachlass && r.entity_id ? (activityByEntityId[r.entity_id] ?? null) : null;
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
    companyActivityAr,
    summaryAr: review?.summary_ar ?? null,
    aiScore: review?.acquisition_score ?? null,
    aiPriority: review?.priority ?? null,
    aiReasoningAr: review?.reasoning_ar ?? null,
    aiRiskFlags: review?.risk_flags ?? [],
    aiNextAction: review?.recommended_next_action ?? null,
    hasReview: Boolean(review),
    hasDraft: r.watch_id ? draftKeySet.has(watchKey) : false,
  };
}

export function AcquisitionInbox({
  rows,
  aiReviewByKey,
  draftKeys,
  activityByEntityId,
}: {
  rows: AcquisitionInboxRow[];
  aiReviewByKey: Record<string, AiCaseReviewRow>;
  draftKeys: string[];
  activityByEntityId: Record<string, string>;
}) {
  const [segment, setSegment] = useState<SegKey>("neu");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");

  const { cards, counts } = useMemo(() => {
    const draftKeySet = new Set(draftKeys);
    // Global Firma/Nachlass filter — applied BEFORE segment counts so tabs and
    // the visible grid stay consistent with the active type.
    const all = rows
      .map((r) => rowToCard(r, aiReviewByKey, draftKeySet, activityByEntityId))
      .filter((c) => typeFilter === "all" || c.kind === typeFilter);
    const counts: Record<SegKey, number> = {
      neu: all.filter((c) => c.status === "neu").length,
      watching: all.filter((c) => c.source === "watch" && c.status === "watching").length,
      pursuing: all.filter((c) => c.status === "pursuing").length,
      passed: all.filter((c) => c.status === "passed").length,
      nachlass: all.filter((c) => c.kind === "nachlass").length,
      all: all.length,
    };
    return { cards: all, counts };
  }, [rows, aiReviewByKey, draftKeys, activityByEntityId, typeFilter]);

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

  // Render only a slice of the (potentially thousands of) matching cards, with a
  // "Mehr laden" button. Reset the window whenever the filters change so the user
  // always starts at the top of the new list.
  const PAGE_SIZE = 24;
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [segment, typeFilter]);

  const visibleLimited = useMemo(
    () => visible.slice(0, visibleLimit),
    [visible, visibleLimit],
  );

  return (
    <div className="space-y-5">
      {/* Global type filter (Firma / Nachlass) — applies to the whole list */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">Typ</span>
        <div className="flex gap-1 border border-border bg-card p-1">
          {TYPE_FILTERS.map((t) => {
            const active = typeFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTypeFilter(t.key)}
                className={cn(
                  "px-3 py-1.5 text-[13px] font-medium tracking-wide transition-colors",
                  active ? "bg-ink text-paper" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow segments (status) — counts reflect the active type filter */}
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleLimited.map((c) => (
              <AcquisitionCaseCard key={c.key} data={c} />
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="text-xs tabular-nums text-muted-foreground">
              Zeige {visibleLimited.length} von {visible.length} Fällen
            </p>
            {visible.length > visibleLimit ? (
              <button
                type="button"
                onClick={() => setVisibleLimit((n) => n + PAGE_SIZE)}
                className="border border-border bg-card px-4 py-2 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-muted/60"
              >
                Mehr laden
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
