"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  archiveTaskAction,
  completeTaskAction,
  reopenTaskAction,
  type ActionResult,
} from "@/app/cockpit/tasks/actions";

const ACTIVE = new Set(["open", "in_progress", "waiting"]);

export function TaskRowActions({
  taskId,
  status,
}: {
  taskId: string;
  status: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  const isActive = ACTIVE.has(status ?? "");
  const isDone = status === "done";
  const isArchived = status === "archived";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {isActive ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => run(() => completeTaskAction(taskId))}
          >
            Erledigen
          </Button>
        ) : null}
        {isDone ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => reopenTaskAction(taskId))}
          >
            Wieder öffnen
          </Button>
        ) : null}
        {!isArchived ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => archiveTaskAction(taskId))}
          >
            Archivieren
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      {error ? <p className="text-xs text-status-red">{error}</p> : null}
    </div>
  );
}
