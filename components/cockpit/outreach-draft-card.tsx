"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveOutreachDraftAction,
  markOutreachDraftReadyAction,
  updateOutreachDraftAction,
  type ActionResult,
} from "@/app/cockpit/email-drafts/actions";
import type { OutreachDraft } from "@/lib/cockpit/outreach.queries";

function statusVariant(s: string | null): "green" | "yellow" | "muted" {
  if (s === "ready") return "green";
  if (s === "draft") return "yellow";
  return "muted";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

const PLACEHOLDER_RE = /\[(Name|E-Mail|Telefon)\]/;

export function OutreachDraftCard({ draft }: { draft: OutreachDraft }) {
  const archived = draft.status === "archived";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [subject, setSubject] = useState(draft.subject ?? "");
  const [recipientName, setRecipientName] = useState(draft.recipient_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(draft.recipient_email ?? "");
  const [body, setBody] = useState(draft.body ?? "");

  function run(action: () => Promise<ActionResult>, success: string) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else setOk(success);
    });
  }

  function save() {
    run(
      () =>
        updateOutreachDraftAction({
          draft_id: draft.draft_id,
          subject,
          body,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
        }),
      "Gespeichert.",
    );
  }

  function markReady() {
    run(() => markOutreachDraftReadyAction(draft.draft_id), "Als bereit markiert.");
  }

  function archive() {
    if (!window.confirm("Diesen Entwurf archivieren?")) return;
    run(() => archiveOutreachDraftAction(draft.draft_id), "Archiviert.");
  }

  const emailMissing = recipientEmail.trim().length === 0;
  const hasPlaceholder = PLACEHOLDER_RE.test(body);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="min-w-0">{draft.subject ?? "—"}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {emailMissing ? (
              <Badge variant="yellow">Empfänger-E-Mail fehlt</Badge>
            ) : null}
            {hasPlaceholder ? (
              <Badge variant="yellow">Signatur-Platzhalter prüfen</Badge>
            ) : null}
            <Badge variant={statusVariant(draft.status)}>{draft.status ?? "—"}</Badge>
          </span>
        </CardTitle>
        <CardDescription>
          Firma · erstellt von{" "}
          {draft.created_by_name ?? "—"} · {formatDateTime(draft.created_at)} ·
          aktualisiert {draft.updated_by_name ? `${draft.updated_by_name}, ` : ""}
          {formatDateTime(draft.updated_at)} · {draft.event_count ?? 0} Ereignisse
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Betreff</span>
            <Input
              value={subject}
              disabled={archived || pending}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Empfängername</span>
            <Input
              value={recipientName}
              disabled={archived || pending}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Empfänger-E-Mail</span>
            <Input
              type="email"
              value={recipientEmail}
              disabled={archived || pending}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Entwurfstext</span>
            <Textarea
              className="min-h-[220px]"
              value={body}
              disabled={archived || pending}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-status-red">{error}</p> : null}
        {ok ? <p className="text-sm text-status-green">{ok}</p> : null}

        {archived ? (
          <p className="text-xs text-muted-foreground">
            Archiviert — Bearbeitung deaktiviert.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              Speichern
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || draft.status === "ready"}
              onClick={markReady}
            >
              Als bereit markieren
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={archive}
            >
              Archivieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
