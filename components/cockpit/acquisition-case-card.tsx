"use client";

import { memo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PHASE_LABEL_DE, type PhaseLabel } from "@/lib/cockpit/phase";
import { buildOutreachPreview } from "@/lib/cockpit/email-template";
import {
  updateStatusAction,
  watchCompanyAction,
  watchNachlassAction,
} from "@/app/cockpit/watchlist/actions";
import { createOutreachDraftFromWatchlistAction } from "@/app/cockpit/email-drafts/actions";

export type CaseStatus = "neu" | "watching" | "pursuing" | "passed";

/** Normalized acquisition case (from a new lead OR a watched row). */
export interface CaseCardData {
  key: string;
  kind: "company" | "nachlass";
  source: "lead" | "watch";
  entityId: string | null;
  watchId: string | null;
  detectionId: string | null;
  subjectId: string | null;
  title: string;
  city: string | null;
  bundesland: string | null;
  court: string | null;
  aktenzeichen: string | null;
  latestPhase: string | null;
  latestAnnouncementType: string | null;
  phasePriority: string | null;
  preVerteilung: boolean | null;
  latestPublicationDate: string | null;
  administratorName: string | null;
  administratorEmail: string | null;
  administratorPhone: string | null;
  handelsregisterStatus: string | null;
  bundesanzeigerStatus: string | null;
  financialDataStatus: string | null;
  missingDataFlags: string[];
  sourceQualityFlags: string[];
  status: CaseStatus;
  /** Company business-activity description (Arabic) — shown on the card exterior. */
  companyActivityAr: string | null;
  hasDraft: boolean;
}

const STATUS_META: Record<
  CaseStatus,
  { label: string; variant: "blue" | "green" | "yellow" | "muted" }
> = {
  neu: { label: "Neu", variant: "blue" },
  watching: { label: "In Beobachtung", variant: "muted" },
  pursuing: { label: "Kontakt aufnehmen", variant: "green" },
  passed: { label: "Ignoriert", variant: "muted" },
};

function priorityVariant(p: string | null): "red" | "yellow" | "muted" {
  if (p === "high") return "red";
  if (p === "low") return "yellow";
  return "muted";
}

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

const ACTIVITY_PLACEHOLDER = "وصف نشاط الشركة غير متوفر بعد.";

function AcquisitionCaseCardImpl({ data }: { data: CaseCardData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const phaseLabel = PHASE_LABEL_DE[(data.latestPhase as PhaseLabel) ?? "unknown"] ?? "Unbekannt";
  const status = STATUS_META[data.status];
  const preview = buildOutreachPreview({
    kind: data.kind,
    caseLabel: data.title,
    aktenzeichen: data.aktenzeichen,
    latestPublicationDate: data.latestPublicationDate,
  });

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Fehlgeschlagen.");
      else {
        setDone(okMsg);
        router.refresh();
      }
    });
  }

  function changeStatus(target: "pursuing" | "passed", okMsg: string) {
    if (data.source === "watch" && data.subjectId) {
      run(() => updateStatusAction(data.kind, data.subjectId as string, target), okMsg);
    } else if (data.source === "lead" && data.kind === "company" && data.entityId) {
      run(() => watchCompanyAction(data.entityId as string, target, "", ""), okMsg);
    } else if (data.source === "lead" && data.kind === "nachlass" && data.detectionId) {
      run(() => watchNachlassAction(data.detectionId as string, target, "", ""), okMsg);
    } else {
      setError("Aktion nicht möglich: fehlende Fall-ID.");
    }
  }

  function follow() {
    changeStatus("pursuing", "Als Kontakt markiert.");
  }

  function ignore() {
    changeStatus("passed", "Ignoriert.");
  }

  function generateEmail() {
    if (!data.watchId) return;
    run(
      () => createOutreachDraftFromWatchlistAction(data.kind, data.watchId as string),
      "E-Mail-Entwurf erstellt.",
    );
  }

  const emailDisabled = pending || !data.watchId;
  const emailTitle = !data.watchId
    ? "Zuerst übernehmen, um einen Entwurf zu erstellen."
    : data.hasDraft
      ? "Es existiert bereits ein Entwurf — erneut erstellen."
      : "Erstellt einen editierbaren Entwurf (kein Versand).";

  return (
    <div className="flex flex-col border border-border bg-card transition-colors hover:bg-muted/40">
      {/* Body (click → expand inline; no sidebar/drawer) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex-1 px-4 pt-4 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Badge variant="outline">{data.kind === "nachlass" ? "Nachlass" : "Firma"}</Badge>
          {data.preVerteilung ? <Badge variant="green">pre-Verteilung</Badge> : null}
        </div>
        <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold tracking-tight">
          {data.title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[data.city, data.bundesland].filter(Boolean).join(", ") || "—"}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant={priorityVariant(data.phasePriority)}>{phaseLabel}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            {fmtDate(data.latestPublicationDate)}
          </span>
        </div>
        {/* Card exterior summary: for companies, "what does this company do?"
            (business activity). The insolvency/acquisition AI review block has
            been removed from the cards. Nachlass shows no exterior AI text. */}
        {data.kind === "company" ? (
          <p dir="rtl" className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">الوصف: </span>
            {data.companyActivityAr?.trim()
              ? data.companyActivityAr
              : ACTIVITY_PLACEHOLDER}
          </p>
        ) : null}
      </button>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center justify-center gap-1.5 border-t border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-expanded={expanded}
      >
        {expanded ? "Weniger" : "Mehr Details"}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Inline expanded detail (replaces the old right-side drawer) */}
      {expanded ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {/* Unternehmenstätigkeit (AR) — full business-activity description */}
          {data.kind === "company" ? (
            <section className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow">Unternehmenstätigkeit (AR)</p>
                {data.companyActivityAr?.trim() ? (
                  <Badge variant="muted">Quelle: AI-Enrichment</Badge>
                ) : null}
              </div>
              <p dir="rtl" className="text-sm leading-relaxed text-foreground">
                {data.companyActivityAr?.trim()
                  ? data.companyActivityAr
                  : ACTIVITY_PLACEHOLDER}
              </p>
            </section>
          ) : null}

          {/* Fall */}
          <section className="space-y-1.5">
            <p className="eyebrow">Fall</p>
            <dl className="space-y-1.5 text-xs">
              <Row label="Phase" value={phaseLabel} />
              <Row label="Typ-Hinweis" value={data.latestAnnouncementType} />
              <Row label="Priorität" value={data.phasePriority} />
              <Row label="Letzte Bekanntmachung" value={fmtDate(data.latestPublicationDate)} />
              <Row label="Gericht" value={data.court} />
              <Row label="Aktenzeichen" value={data.aktenzeichen} />
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Detaillierte Bekanntmachungs-Timeline: noch nicht verfügbar (Backend).
            </p>
          </section>

          {/* Insolvenzverwalter */}
          <section className="space-y-1.5">
            <p className="eyebrow">Insolvenzverwalter</p>
            <dl className="space-y-1.5 text-xs">
              <Row label="Name" value={data.administratorName} />
              <Row label="E-Mail" value={data.administratorEmail} />
              <Row label="Telefon" value={data.administratorPhone} />
            </dl>
          </section>

          {/* Datenqualität (Bundesanzeiger intentionally hidden — retired) */}
          <section className="space-y-1.5">
            <p className="eyebrow">Datenqualität</p>
            <dl className="space-y-1.5 text-xs">
              <Row label="Handelsregister" value={data.handelsregisterStatus} />
              <Row label="Finanzdaten" value={data.financialDataStatus} />
              <Row
                label="Lücken"
                value={data.missingDataFlags.length > 0 ? data.missingDataFlags.join(", ") : null}
              />
              <Row
                label="Qualität"
                value={data.sourceQualityFlags.length > 0 ? data.sourceQualityFlags.join(", ") : null}
              />
            </dl>
          </section>

          {/* E-Mail preview — only after explicit click; never sent */}
          {showEmail ? (
            <section className="space-y-1.5 border-t border-border pt-4">
              <p className="eyebrow">E-Mail-Vorschau (kein Versand)</p>
              <p className="text-xs font-medium text-foreground">{preview.subject}</p>
              <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
                {preview.body}
              </pre>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={emailDisabled}
                  title={emailTitle}
                  onClick={generateEmail}
                >
                  Entwurf speichern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setShowEmail(false)}
                >
                  Schließen
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                „Entwurf speichern“ legt einen editierbaren Entwurf unter E-Mail-Entwürfe an — es wird nichts versendet.
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant={data.status === "pursuing" ? "default" : "outline"}
          disabled={pending}
          onClick={follow}
        >
          تابع
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={ignore}>
          اهمل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setExpanded(true);
            setShowEmail((v) => !v);
          }}
          aria-expanded={showEmail}
        >
          E-Mail generieren
        </Button>
      </div>
      {error ? <p className="px-4 pb-3 text-xs text-status-red">{error}</p> : null}
      {done ? <p className="px-4 pb-3 text-xs text-status-green">{done}</p> : null}
    </div>
  );
}

/**
 * Memoized: card `data` objects are stable across parent re-renders (built in a
 * useMemo in the inbox), so paginating ("Mehr laden") or any parent state change
 * does not re-render already-mounted cards. Per-card expand state is internal.
 */
export const AcquisitionCaseCard = memo(AcquisitionCaseCardImpl);

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}
