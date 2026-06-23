"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createOutreachDraftFromWatchlistAction } from "@/app/cockpit/email-drafts/actions";

/**
 * "Anfrage erstellen" button for an internal watchlist row. Creates an outreach
 * draft via the RPC (server action). Never auto-creates — the user must click.
 * Shows a readiness warning when the source is missing recipient/case data, and
 * is disabled when an active draft already exists for this watch item.
 */
export function OutreachCreateButton({
  kind,
  watchId,
  outreachReady,
  blockedReason,
  hasExistingDraft = false,
}: {
  kind: string;
  watchId: string;
  outreachReady: boolean | null;
  blockedReason: string | null;
  hasExistingDraft?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasExistingDraft && !done) {
    return (
      <Link
        href="/cockpit/email-drafts"
        className="text-xs text-muted-foreground underline underline-offset-2"
      >
        Entwurf existiert
      </Link>
    );
  }

  if (done) {
    return (
      <Link
        href="/cockpit/email-drafts"
        className="text-xs text-status-green underline underline-offset-2"
      >
        Entwurf erstellt ✓ — öffnen
      </Link>
    );
  }

  const warning =
    outreachReady === false
      ? blockedReason === "missing_recipient_email"
        ? "Empfänger-E-Mail fehlt"
        : blockedReason === "missing_case_reference"
          ? "Fallreferenz fehlt"
          : "Unvollständige Daten"
      : null;

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createOutreachDraftFromWatchlistAction(kind, watchId);
      if (!res.ok) setError(res.error);
      else setDone(true);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={create}>
        {pending ? "Wird erstellt…" : "Anfrage erstellen"}
      </Button>
      {warning ? <span className="text-xs text-status-yellow">{warning}</span> : null}
      {error ? <span className="text-xs text-status-red">{error}</span> : null}
    </div>
  );
}
