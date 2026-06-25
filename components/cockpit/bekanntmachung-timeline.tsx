"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { CaseTimelineEvent } from "@/lib/cockpit/case-timeline.queries";
import {
  buildArabicCaseSummary,
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
  fallbackPhase,
  fallbackPreVerteilung,
  hasAdministratorEmail,
  court,
  aktenzeichen,
}: {
  events: CaseTimelineEvent[];
  fallbackPhase: string | null;
  fallbackPreVerteilung: boolean | null;
  hasAdministratorEmail: boolean;
  court: string | null;
  aktenzeichen: string | null;
}) {
  const summary = useMemo(
    () =>
      buildArabicCaseSummary({
        events,
        fallbackPhase,
        fallbackPreVerteilung,
        hasAdministratorEmail,
        court,
        aktenzeichen,
      }),
    [events, fallbackPhase, fallbackPreVerteilung, hasAdministratorEmail, court, aktenzeichen],
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
      {/* Arabic case summary */}
      <div className="space-y-1.5 rounded-md bg-muted/40 p-3">
        <p className="eyebrow">KI-freie Fallzusammenfassung (AR)</p>
        <p dir="rtl" className="text-sm font-medium leading-relaxed text-foreground">
          {summary.headlineAr}
        </p>
        <p dir="rtl" className="text-[13px] leading-relaxed text-muted-foreground">
          {summary.statusAr}
        </p>
        <p dir="rtl" className="text-[13px] leading-relaxed text-muted-foreground">
          {summary.relevanceAr}
        </p>
        <p dir="rtl" className="text-[13px] leading-relaxed text-foreground">
          الإجراء المقترح: {summary.nextActionAr}
        </p>
        {summary.riskFlagsAr.length > 0 ? (
          <ul dir="rtl" className="mt-1 space-y-0.5">
            {summary.riskFlagsAr.map((f) => (
              <li key={f} className="text-[11px] text-status-red">
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
          <p className="text-[12px] text-muted-foreground">
            لا توجد بيانات timeline كافية بعد لهذه الحالة.
          </p>
        ) : (
          <ol className="space-y-2">
            {ordered.map((e) => (
              <li
                key={e.id}
                className="border-l-2 border-border pl-3 text-xs"
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
                <p dir="rtl" className="mt-0.5 leading-relaxed text-muted-foreground">
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
