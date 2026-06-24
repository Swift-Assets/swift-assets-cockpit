"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  reopenSystemHealthCheckAction,
  resolveSystemHealthCheckAction,
  runHealthCheckNowAction,
} from "@/app/cockpit/operations/actions";

/**
 * Per-check resolve/reopen controls (Phase 7A). After an operator inspects and
 * fixes an issue they can mark it resolved; resolved checks can be reopened.
 * Calls writer-gated RPCs (migration 0032). Until that migration is applied the
 * action returns a safe "noch nicht verfügbar" message.
 */
export function SystemHealthCheckActions({
  checkKey,
  resolved,
}: {
  checkKey: string;
  resolved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Fehlgeschlagen.");
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-1.5">
        {resolved ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => reopenSystemHealthCheckAction(checkKey))}
          >
            Wieder öffnen
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => resolveSystemHealthCheckAction(checkKey))}
          >
            Als geprüft markieren
          </Button>
        )}
      </span>
      {error ? <span className="text-xs text-status-red">{error}</span> : null}
    </span>
  );
}

/** Page-level "re-run checks" button. */
export function RunHealthCheckButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const res = await runHealthCheckNowAction();
            setMsg(res.ok ? "Checks aktualisiert." : res.error);
          });
        }}
      >
        {pending ? "Wird ausgeführt…" : "Checks jetzt prüfen"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </span>
  );
}
