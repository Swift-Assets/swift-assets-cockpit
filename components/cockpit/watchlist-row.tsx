"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_OPTIONS,
  rpcSubjectId,
  type WatchlistRow as Row,
} from "@/lib/cockpit/watchlist";
import {
  type ActionResult,
  clearFollowUpAction,
  removeFromWatchlistAction,
  setFollowUpAction,
  updateNoteAction,
  updateStatusAction,
} from "@/app/cockpit/watchlist/actions";
import { CreateTaskFromContextButton } from "@/components/cockpit/create-task-from-context-button";

const COLUMN_COUNT = 8;

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

export function WatchlistRow({ row }: { row: Row }) {
  const subjectId = rpcSubjectId(row);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(row.note ?? "");
  const [dateDraft, setDateDraft] = useState(toDateInput(row.next_follow_up_at));

  const disabled = pending || !subjectId;
  const typeLabel = row.kind === "nachlass" ? "Nachlass" : "Firma";

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error);
      } else {
        onSuccess?.();
      }
    });
  }

  function handleRemove() {
    if (!subjectId) return;
    const ok = window.confirm(
      `„${row.title ?? typeLabel}“ aus der Watchlist entfernen?`,
    );
    if (!ok) return;
    run(() => removeFromWatchlistAction(row.kind, subjectId));
  }

  return (
    <>
      <tr className="border-b border-border/60 align-top last:border-0">
        <td className="py-3 pr-4">
          <Badge variant="muted">{typeLabel}</Badge>
        </td>
        <td className="py-3 pr-4 font-medium">{row.title ?? "—"}</td>
        <td className="py-3 pr-4 text-muted-foreground">
          {[row.city, row.bundesland].filter(Boolean).join(", ") || "—"}
        </td>

        {/* Status */}
        <td className="py-3 pr-4">
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

        {/* Notiz */}
        <td className="py-3 pr-4">
          <div className="space-y-1">
            <p className="max-w-[16rem] whitespace-pre-wrap text-muted-foreground">
              {row.note ? row.note : "—"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setNoteDraft(row.note ?? "");
                setEditingNote((v) => !v);
              }}
            >
              Notiz bearbeiten
            </Button>
          </div>
        </td>

        {/* Follow-up */}
        <td className="py-3 pr-4">
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
                Follow-up setzen
              </Button>
              {row.next_follow_up_at ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    run(
                      () => clearFollowUpAction(row.kind, subjectId!),
                      () => setDateDraft(""),
                    )
                  }
                >
                  Follow-up löschen
                </Button>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              Aktuell: {formatDate(row.next_follow_up_at)}
            </span>
          </div>
        </td>

        <td className="py-3 pr-4 text-muted-foreground">
          {formatDate(row.updated_at)}
        </td>

        {/* Aktionen */}
        <td className="py-3 pr-4">
          <div className="flex flex-col items-start gap-1.5">
            <CreateTaskFromContextButton
              title={`Follow-up: ${
                row.kind === "company"
                  ? (row.title ?? "Firmen-Watchlist-Eintrag")
                  : "Nachlass-Watchlist-Eintrag"
              }`}
              taskType="follow_up"
              priority="medium"
              relatedKind={
                row.kind === "company"
                  ? "company"
                  : row.kind === "nachlass"
                    ? "nachlass"
                    : "watchlist"
              }
              relatedId={subjectId ?? undefined}
              relatedLabel={
                row.kind === "company"
                  ? (row.title ?? "Firmen-Watchlist-Eintrag")
                  : "Nachlass-Watchlist-Eintrag"
              }
              sourceView="v_cockpit_my_watchlist"
              label="Follow-up erstellen"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={handleRemove}
            >
              Aus Watchlist entfernen
            </Button>
          </div>
        </td>
      </tr>

      {editingNote ? (
        <tr className="border-b border-border/60">
          <td colSpan={COLUMN_COUNT} className="py-3">
            <div className="space-y-2 rounded-md bg-muted/40 p-3">
              <Textarea
                aria-label="Notiz"
                value={noteDraft}
                disabled={pending}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Interne Notiz…"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    run(
                      () => updateNoteAction(row.kind, subjectId!, noteDraft),
                      () => setEditingNote(false),
                    )
                  }
                >
                  Speichern
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setNoteDraft(row.note ?? "");
                    setEditingNote(false);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}

      {error ? (
        <tr>
          <td colSpan={COLUMN_COUNT} className="pb-3">
            <p className="text-sm text-status-red">{error}</p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
