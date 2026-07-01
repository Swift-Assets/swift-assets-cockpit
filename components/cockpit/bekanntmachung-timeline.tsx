"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { CaseTimelineEvent } from "@/lib/cockpit/case-timeline.queries";
import {
  buildArabicCaseSummary,
  buildArabicInsolvencyCaseSummary,
  buildArabicTimelineEventSummary,
  describeAnnouncementTypeDe,
} from "@/lib/cockpit/case-summary-ar";

function fmtDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function relevanceVariant(
  isPre: boolean | null,
  phase: string | null,
): "green" | "yellow" | "muted" {
  if (isPre) return "green";
  if (phase && phase !== "unknown") return "yellow";
  return "muted";
}

/**
 * Internal Bekanntmachung timeline + deterministic Arabic case summary. Renders
 * only safe structured fields — never raw announcement text. The summary is built
 * client-side from the events (no AI, no network).
 */
export function BekanntmachungTimeline({
  events,
  companyName,
  latestPhase,
  latestAnnouncementType,
  latestPublicationDate,
  preVerteilung,
  hasAdministrator,
  hasAdministratorEmail,
  court,
  aktenzeichen,
}: {
  events: CaseTimelineEvent[];
  companyName: string | null;
  latestPhase: string | null;
  latestAnnouncementType: string | null;
  latestPublicationDate: string | null;
  preVerteilung: boolean | null;
  hasAdministrator: boolean;
  hasAdministratorEmail: boolean;
  court: string | null;
  aktenzeichen: string | null;
}) {
  // Prefer the latest timeline event for the case facts; fall back to the
  // card's own latest fields when the timeline view has no rows yet.
  const latest = useMemo(
    () =>
      [...events].sort((a, b) => {
        const ta = a.publicationDate ? Date.parse(a.publicationDate) : 0;
        const tb = b.publicationDate ? Date.parse(b.publicationDate) : 0;
        return tb - ta;
      })[0] ?? null,
    [events],
  );

  // Insolvency CASE summary (NOT company activity), 2–4 deterministic sentences.
  const caseSummaryAr = useMemo(
    () =>
      buildArabicInsolvencyCaseSummary({
        companyName,
        latestPhase: latest?.insolvencyPhase ?? latestPhase,
        latestAnnouncementType: latest?.announcementType ?? latestAnnouncementType,
        latestPublicationDate: latest?.publicationDate ?? latestPublicationDate,
        court: latest?.court ?? court,
        aktenzeichen: latest?.aktenzeichen ?? aktenzeichen,
        preVerteilung: latest?.isPreVerteilung ?? preVerteilung,
        hasAdministrator,
        eventCount: events.length,
      }),
    [
      events,
      latest,
      companyName,
      latestPhase,
      latestAnnouncementType,
      latestPublicationDate,
      court,
      aktenzeichen,
      preVerteilung,
      hasAdministrator,
    ],
  );

  // Risk flags only (the rest of the old structured summary is folded into the
  // case paragraph above).
  const riskFlagsAr = useMemo(
    () =>
      buildArabicCaseSummary({
        events,
        fallbackPhase: latestPhase,
        fallbackPreVerteilung: preVerteilung,
        hasAdministratorEmail,
        court,
        aktenzeichen,
      }).riskFlagsAr,
    [events, latestPhase, preVerteilung, hasAdministratorEmail, court, aktenzeichen],
  );

  // Newest first for display.
  const ordered = useMemo(
    () =>
      [...events].sort((a, b) => {
        const ta = a.publicationDate ? Date.parse(a.publicationDate) : 0;
        const tb = b.publicationDate ? Date.parse(b.publicationDate) : 0;
        return tb - ta;
      }),
    [events],
  );

  return (
    <section className="space-y-3">
      {/* Insolvency CASE summary (distinct from company activity). Arabic block
          renders RTL locally; full text always shown (no clamp), wraps freely. */}
      <div className="space-y-1.5 rounded-md border border-border bg-[rgba(255,255,255,0.03)] p-3">
        <p className="eyebrow">Fallzusammenfassung (AR)</p>
        <p
          dir="rtl"
          lang="ar"
          className="text-[13px] leading-relaxed text-foreground [overflow-wrap:anywhere]"
        >
          {caseSummaryAr}
        </p>
        {riskFlagsAr.length > 0 ? (
          <ul dir="rtl" lang="ar" className="mt-1 space-y-0.5">
            {riskFlagsAr.map((f) => (
              <li key={f} className="text-[11px] text-status-red [overflow-wrap:anywhere]">
                • {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        <p className="eyebrow">Bekanntmachungen (Timeline)</p>
        {ordered.length === 0 ? (
          <p dir="rtl" lang="ar" className="text-[12px] text-muted-foreground">
            لا توجد بيانات Timeline كافية بعد لهذه الحالة.
          </p>
        ) : (
          <ol className="space-y-2">
            {ordered.map((e) => (
              <li
                key={e.id}
                className="border-s-2 border-border ps-3 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular-nums font-medium text-foreground">
                    {fmtDate(e.publicationDate)}
                  </span>
                  <span className="text-muted-foreground">
                    {describeAnnouncementTypeDe(e.insolvencyPhase, e.announcementType)}
                  </span>
                  <Badge variant={relevanceVariant(e.isPreVerteilung, e.insolvencyPhase)}>
                    {e.isPreVerteilung ? "akquiserelevant" : "monitor"}
                  </Badge>
                </div>
                <p
                  dir="rtl"
                  lang="ar"
                  className="mt-0.5 leading-relaxed text-muted-foreground [overflow-wrap:anywhere]"
                >
                  {buildArabicTimelineEventSummary(e)}
                </p>
                {e.court || e.aktenzeichen ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[e.court, e.aktenzeichen].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
