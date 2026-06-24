"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { generateAiOutreachDraftAction } from "@/app/cockpit/outreach-ai/actions";

/**
 * "KI-E-Mail-Entwurf erstellen" button for an internal watchlist row.
 *
 * Manual only — never auto-generates. Invokes the Edge Function (server action)
 * which builds a professional German email from a SAFE snapshot and stores it as
 * a normal editable outreach draft. No send button, no mailto. By default it
 * will NOT overwrite an existing active draft; if one exists it surfaces a link
 * to the drafts page instead.
 */
export function AiOutreachCreateButton({
  kind,
  watchId,
  hasExistingDraft = false,
}: {
  kind: string;
  watchId: string;
  hasExistingDraft?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(hasExistingDraft);

  if (done) {
    return (
      <span className="text-xs text-status-green">
        KI-E-Mail-Entwurf wurde gespeichert.{" "}
        <Link href="/cockpit/email-drafts" className="underline underline-offset-2">
          öffnen
        </Link>
      </span>
    );
  }

  if (existing) {
    return (
      <Link
        href="/cockpit/email-drafts"
        className="text-xs text-muted-foreground underline underline-offset-2"
      >
        Entwurf existiert bereits
      </Link>
    );
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateAiOutreachDraftAction(kind, watchId);
      if (res.ok) {
        setDone(true);
      } else if (res.activeDraftExists) {
        setExisting(true);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !watchId}
        onClick={generate}
      >
        {pending ? "Wird erstellt…" : "KI-E-Mail-Entwurf erstellen"}
      </Button>
      {error ? <span className="text-xs text-status-red">{error}</span> : null}
    </div>
  );
}
