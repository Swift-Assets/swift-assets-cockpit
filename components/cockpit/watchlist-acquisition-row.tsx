"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_OPTIONS } from "@/lib/cockpit/watchlist";
import {
  type ActionResult,
  clearFollowUpAction,
  removeFromWatchlistAction,
  setFollowUpAction,
  updateNoteAction,
  updateStatusAction,
} from "@/app/cockpit/watchlist/actions";
import { CreateTaskFromContextButton } from "@/components/cockpit/create-task-from-context-button";
import { OutreachCreateButton } from "@/components/cockpit/outreach-create-button";
import { hasOpenTaskForContext } from "@/lib/cockpit/tasks";
import type { InternalWatchlistRow } from "@/lib/cockpit/watchlist-internal.queries";
import { AiReviewSection } from "@/components/cockpit/ai-review-section";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

export const ACQUISITION_COLUMN_COUNT = 11;

function formatDate(value: string | null): string {
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

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const PHASE_LABEL: Record<string, string> = {
  vorlaeufig: "Vorläufig",
  eroeffnung: "Eröffnung",
  berichtstermin: "Berichtstermin",
  pruefungstermin: "Prüfungstermin",
  verwertung: "Verwertung",
  verteilung: "Verteilung",
  schlussverteilung: "Schlussverteilung",
  aufhebung: "Aufhebung",
  einstellung_mangels_masse: "Einstellung (Masse)",
  unknown: "Unbekannt",
};

function priorityVariant(p: string | null): "red" | "yellow" | "muted" {
  if (p === "high") return "red";
  if (p === "low") return "yellow";
  return "muted";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function WatchlistAcquisitionRow({
  row,
  openTaskKeys = [],
  activeDraftKeys = [],
  aiReview = null,
}: {
  row: InternalWatchlistRow;
  openTaskKeys?: string[];
  activeDraftKeys?: string[];
  aiReview?: AiCaseReviewRow | null;
}) {
  const subjectId = row.subject_id;
  const isNachlass = row.kind === "nachlass";
  const label = isNachlass
    ? (row.safe_display_label ?? "Nachlassverfahren")
    : (row.display_title ?? row.safe_display_label ?? "—");

  const hasOpenFollowUp = hasOpenTaskForContext(openTaskKeys, {
    taskType: "follow_up",
    relatedKind: row.kind,
    relatedId: subjectId ?? undefined,
  });
  // Draft context key — kept in sync with outreachDraftKey() (server helper).
  const hasExistingDraft = new Set(activeDraftKeys).has(
    `${row.kind}:${row.watch_id}`,
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(row.note ?? "");
  const [dateDraft, setDateDraft] = useState(toDateInput(row.next_follow_up_at));

  const disabled = pending || !subjectId;

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else onSuccess?.();
    });
  }

  function handleRemove() {
    if (!subjectId) return;
    if (!window.confirm(`„${label}“ aus der Watchlist entfernen?`)) return;
    run(() => removeFromWatchlistAction(row.kind, subjectId));
  }

  const followUpTask = (
    <CreateTaskFromContextButton
      title={`Follow-up: ${label}`}
      taskType="follow_up"
      priority="medium"
      relatedKind={row.kind}
      relatedId={subjectId ?? undefined}
      relatedLabel={label}
      sourceView="v_cockpit_my_watchlist"
      label="Follow-up erstellen"
      hasExistingTask={hasOpenFollowUp}
    />
  );

  const outreachButton = (
    <OutreachCreateButton
      kind={row.kind}
      watchId={row.watch_id}
      outreachReady={row.outreach_ready}
      blockedReason={row.outreach_blocked_reason}
      hasExistingDraft={hasExistingDraft}
    />
  );

  return (
    <>
      <tr className="border-b border-border/60 align-top last:border-0">
        <td className="py-3 pr-2">
          <button
            type="button"
            aria-label={open ? "Details schließen" : "Details öffnen"}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▾" : "▸"}
          </button>
        </td>
        <td className="py-3 pr-3">
          <Badge variant="muted">{isNachlass ? "Nachlass" : "Firma"}</Badge>
        </td>
        <td className="py-3 pr-3">
          <div className="font-medium">{label}</div>
          {aiReview && aiReview.acquisition_score !== null ? (
            <div className="mt-0.5">
              <Badge variant="muted">KI {aiReview.acquisition_score}</Badge>
            </div>
          ) : null}
          {row.note ? (
            <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
              {row.note}
            </div>
          ) : null}
        </td>
        <td className="py-3 pr-3 text-muted-foreground">
          {[row.city, row.bundesland].filter(Boolean).join(", ") || "—"}
        </td>
        <td className="py-3 pr-3 text-muted-foreground">
          <div>{row.court ?? "—"}</div>
          <div className="text-xs">{row.aktenzeichen ?? "—"}</div>
        </td>
        <td className="py-3 pr-3">
          <Badge variant={priorityVariant(row.phase_priority)}>
            {PHASE_LABEL[row.latest_phase ?? "unknown"] ?? "Unbekannt"}
          </Badge>
          {row.pre_verteilung_relevance ? (
            <div className="text-xs text-status-green">pre-Verteilung</div>
          ) : null}
        </td>
        <td className="py-3 pr-3 text-muted-foreground">
          <div>{row.administrator_name ?? "—"}</div>
          {row.administrator_email ? (
            <div className="text-xs">{row.administrator_email}</div>
          ) : (
            <div className="text-xs text-status-yellow">keine E-Mail</div>
          )}
        </td>
        <td className="py-3 pr-3">
          <Badge variant={row.outreach_ready ? "green" : "yellow"}>
            {row.outreach_ready ? "bereit" : "unvollständig"}
          </Badge>
          <div className="mt-1">{outreachButton}</div>
        </td>
        <td className="py-3 pr-3">
          <Select
            aria-label="Status"
            value={row.status ?? "watching"}
            disabled={disabled}
            onChange={(e) =>
              run(() => updateStatusAction(row.kind, subjectId!, e.target.value))
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </td>
        <td className="py-3 pr-3">
          <div className="flex flex-col gap-1.5">
            <Input
              type="date"
              aria-label="Follow-up Datum"
              className="w-[9.5rem]"
              value={dateDraft}
              disabled={disabled}
              onChange={(e) => setDateDraft(e.target.value)}
            />
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={disabled || !dateDraft}
                onClick={() =>
                  run(() => setFollowUpAction(row.kind, subjectId!, dateDraft))
                }
              >
                Setzen
              </Button>
              {row.next_follow_up_at ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    run(
                      () => clearFollowUpAction(row.kind, subjectId!),
                      () => setDateDraft(""),
                    )
                  }
                >
                  Löschen
                </Button>
              ) : null}
            </div>
          </div>
        </td>
        <td className="py-3 pr-3">
          <div className="flex flex-col items-start gap-1.5">
            {followUpTask}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={handleRemove}
            >
              Entfernen
            </Button>
          </div>
        </td>
      </tr>

      {open ? (
        <tr className="border-b border-border/60 bg-muted/20">
          <td colSpan={ACQUISITION_COLUMN_COUNT} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-5 text-sm md:grid-cols-3">
              {/* A. Case identity */}
              <dl className="space-y-1">
                <p className="mb-1 font-medium">Fall</p>
                <Field label="Bezeichnung" value={label} />
                <Field label="Typ" value={isNachlass ? "Nachlass" : "Firma"} />
                <Field label="Status" value={row.status ?? "—"} />
                <Field label="Gericht" value={row.court ?? "—"} />
                <Field label="Aktenzeichen" value={row.aktenzeichen ?? "—"} />
                {!isNachlass ? (
                  <Field
                    label="Ort"
                    value={
                      [row.city, row.bundesland].filter(Boolean).join(", ") || "—"
                    }
                  />
                ) : null}
                <Field
                  label="Letzte Veröffentlichung"
                  value={formatDate(row.latest_publication_date)}
                />
                <Field label="Typ-Hinweis" value={row.latest_announcement_type ?? "—"} />
              </dl>

              {/* B. Phase & relevance */}
              <dl className="space-y-1">
                <p className="mb-1 font-medium">Phase & Relevanz</p>
                <Field
                  label="Phase"
                  value={PHASE_LABEL[row.latest_phase ?? "unknown"] ?? "Unbekannt"}
                />
                <Field label="Priorität" value={row.phase_priority ?? "—"} />
                <Field
                  label="pre-Verteilung"
                  value={row.pre_verteilung_relevance ? "ja" : "nein"}
                />
                <p className="pt-1 text-xs text-muted-foreground">
                  Hoch / pre-Verteilung deutet auf eine frühere Verfahrensphase und
                  höhere Akquise-Relevanz hin. „Monitor“ bedeutet späte Phase oder
                  geringere unmittelbare Relevanz.
                </p>
              </dl>

              {/* C. Administrator */}
              <dl className="space-y-1">
                <p className="mb-1 font-medium">Insolvenzverwalter</p>
                <Field label="Name" value={row.administrator_name ?? "—"} />
                <Field label="E-Mail" value={row.administrator_email ?? "—"} />
                <Field label="Telefon" value={row.administrator_phone ?? "—"} />
                <Field label="Anschrift (Kanzlei)" value={row.administrator_address ?? "—"} />
                <Field label="Quelle" value={row.administrator_source ?? "—"} />
                <Field label="Konfidenz" value={row.administrator_confidence ?? "—"} />
              </dl>

              {/* D. Data quality */}
              <dl className="space-y-1">
                <p className="mb-1 font-medium">Datenqualität</p>
                <Field label="Handelsregister" value={row.handelsregister_status ?? "—"} />
                <Field label="Bundesanzeiger" value={row.bundesanzeiger_status ?? "—"} />
                <Field label="Finanzdaten" value={row.financial_data_status ?? "—"} />
                <Field
                  label="Qualität"
                  value={
                    row.source_quality_flags && row.source_quality_flags.length > 0
                      ? row.source_quality_flags.join(", ")
                      : "—"
                  }
                />
                <Field
                  label="Lücken"
                  value={
                    row.missing_data_flags && row.missing_data_flags.length > 0
                      ? row.missing_data_flags.join(", ")
                      : "—"
                  }
                />
              </dl>

              {/* E. Outreach */}
              <dl className="space-y-1">
                <p className="mb-1 font-medium">Outreach</p>
                <Field
                  label="Bereit"
                  value={row.outreach_ready ? "ja" : "nein"}
                />
                <Field label="Grund" value={row.outreach_blocked_reason ?? "—"} />
                <div className="pt-1">{outreachButton}</div>
              </dl>

              {/* F. Notes & follow-up */}
              <div className="space-y-2 md:col-span-1">
                <p className="font-medium">Notiz & Follow-up</p>
                <Textarea
                  aria-label="Notiz"
                  value={noteDraft}
                  disabled={pending}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Interne Notiz…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      run(() => updateNoteAction(row.kind, subjectId!, noteDraft))
                    }
                  >
                    Notiz speichern
                  </Button>
                  {followUpTask}
                </div>
              </div>

              {/* G. AI review */}
              <div className="md:col-span-2">
                <AiReviewSection
                  kind={row.kind}
                  watchId={row.watch_id}
                  review={aiReview}
                />
              </div>
            </div>
          </td>
        </tr>
      ) : null}

      {error ? (
        <tr>
          <td colSpan={ACQUISITION_COLUMN_COUNT} className="pb-3">
            <p className="text-sm text-status-red">{error}</p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
