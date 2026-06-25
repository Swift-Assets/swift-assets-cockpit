"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DetailPanel,
  DetailSection,
  DetailField,
} from "@/components/cockpit/detail-panel";
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
  summaryAr: string | null;
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

const AR_PLACEHOLDER = "ملخص AI غير متوفر بعد.";

export function AcquisitionCaseCard({ data }: { data: CaseCardData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
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
    <>
      <div className="flex flex-col border border-border bg-card transition-colors hover:bg-muted/40">
        {/* Body (click → profile) */}
        <button
          type="button"
          onClick={() => setOpen(true)}
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
          {/* Arabic AI summary */}
          <p dir="rtl" className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
            {data.summaryAr?.trim() ? data.summaryAr : AR_PLACEHOLDER}
          </p>
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

        {expanded ? (
          <dl className="space-y-1.5 border-t border-border px-4 py-3 text-xs">
            <Row label="Gericht" value={data.court} />
            <Row label="Aktenzeichen" value={data.aktenzeichen} />
            <Row label="Verwalter" value={data.administratorName} />
            {data.administratorEmail ? <Row label="E-Mail" value={data.administratorEmail} /> : null}
            {data.administratorPhone ? <Row label="Telefon" value={data.administratorPhone} /> : null}
            <Row label="Handelsregister" value={data.handelsregisterStatus} />
            <Row label="Bundesanzeiger" value={data.bundesanzeigerStatus} />
            <Row label="Finanzdaten" value={data.financialDataStatus} />
            {data.missingDataFlags.length > 0 ? (
              <Row label="Lücken" value={data.missingDataFlags.join(", ")} />
            ) : null}
          </dl>
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={ignore}
          >
            اهمل
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={emailDisabled}
            title={emailTitle}
            onClick={generateEmail}
          >
            E-Mail generieren
          </Button>
        </div>
        {error ? <p className="px-4 pb-3 text-xs text-status-red">{error}</p> : null}
        {done ? <p className="px-4 pb-3 text-xs text-status-green">{done}</p> : null}
      </div>

      {/* Profile drawer */}
      <DetailPanel
        open={open}
        onClose={() => setOpen(false)}
        title={data.title}
        subtitle={[data.city, data.bundesland].filter(Boolean).join(", ") || undefined}
        badges={
          <>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="outline">{data.kind === "nachlass" ? "Nachlass" : "Firma"}</Badge>
            <Badge variant={priorityVariant(data.phasePriority)}>{phaseLabel}</Badge>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={follow}>
              تابع
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={ignore}>
              اهمل
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={emailDisabled} title={emailTitle} onClick={generateEmail}>
              E-Mail generieren
            </Button>
            {error ? <span className="text-xs text-status-red">{error}</span> : null}
            {done ? <span className="text-xs text-status-green">{done}</span> : null}
          </div>
        }
      >
        <DetailSection title="KI-Zusammenfassung (AR)">
          <p dir="rtl" className="text-sm leading-relaxed text-foreground">
            {data.summaryAr?.trim() ? data.summaryAr : AR_PLACEHOLDER}
          </p>
        </DetailSection>

        <DetailSection title="Fall">
          <DetailField label="Phase" value={phaseLabel} />
          <DetailField label="Typ-Hinweis" value={data.latestAnnouncementType ?? "—"} />
          <DetailField label="Priorität" value={data.phasePriority ?? "—"} />
          <DetailField label="Letzte Bekanntmachung" value={fmtDate(data.latestPublicationDate)} />
          <DetailField label="Gericht" value={data.court ?? "—"} />
          <DetailField label="Aktenzeichen" value={data.aktenzeichen ?? "—"} />
          <p className="pt-1 text-xs text-muted-foreground">
            Detaillierte Bekanntmachungs-Timeline: noch nicht verfügbar (Backend).
          </p>
        </DetailSection>

        <DetailSection title="Insolvenzverwalter">
          <DetailField label="Name" value={data.administratorName ?? "—"} />
          <DetailField label="E-Mail" value={data.administratorEmail ?? "—"} />
          <DetailField label="Telefon" value={data.administratorPhone ?? "—"} />
        </DetailSection>

        <DetailSection title="Daten & Anreicherung">
          <DetailField label="Handelsregister" value={data.handelsregisterStatus ?? "—"} />
          <DetailField label="Bundesanzeiger" value={data.bundesanzeigerStatus ?? "—"} />
          <DetailField label="Finanzdaten" value={data.financialDataStatus ?? "—"} />
          <DetailField
            label="Lücken"
            value={data.missingDataFlags.length > 0 ? data.missingDataFlags.join(", ") : "—"}
          />
          <DetailField
            label="Qualität"
            value={data.sourceQualityFlags.length > 0 ? data.sourceQualityFlags.join(", ") : "—"}
          />
        </DetailSection>

        <DetailSection title="E-Mail-Vorschau (kein Versand)">
          <p className="text-xs font-medium text-foreground">{preview.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-muted-foreground">
            {preview.body}
          </pre>
          <p className="pt-2 text-[11px] text-muted-foreground">
            „E-Mail generieren“ erstellt einen editierbaren Entwurf unter E-Mail-Entwürfe — es wird nichts versendet.
          </p>
        </DetailSection>
      </DetailPanel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}
