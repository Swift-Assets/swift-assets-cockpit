"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/cockpit/tasks";
import {
  archiveTaskAction,
  completeTaskAction,
  reopenTaskAction,
  updateTaskAction,
  type ActionResult,
} from "@/app/cockpit/tasks/actions";
import type { CockpitUser } from "@/lib/cockpit/users.queries";

function userLabel(u: CockpitUser): string {
  const name = u.display_name ?? u.email ?? "Unbekannt";
  return u.role ? `${name} (${u.role})` : name;
}

const ACTIVE = new Set(["open", "in_progress", "waiting"]);

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function TaskRowActions({
  taskId,
  status,
  priority,
  dueAt,
  assignedTo,
  users,
  usersAvailable = false,
}: {
  taskId: string;
  status: string | null;
  priority: string | null;
  dueAt: string | null;
  assignedTo: string | null;
  users: CockpitUser[];
  usersAvailable?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState(toDateInput(dueAt));

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  function handleArchive() {
    if (!window.confirm("Diese Aufgabe archivieren?")) return;
    run(() => archiveTaskAction(taskId));
  }

  const isActive = ACTIVE.has(status ?? "");
  const isDone = status === "done";
  const isArchived = status === "archived";

  return (
    <div className="space-y-1.5">
      {/* Inline updates */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          aria-label="Priorität"
          className="h-8 text-xs"
          value={priority ?? "medium"}
          disabled={pending || isArchived}
          onChange={(e) =>
            run(() => updateTaskAction({ task_id: taskId, priority: e.target.value }))
          }
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          className="h-8 text-xs"
          value={status ?? "open"}
          disabled={pending || isArchived}
          onChange={(e) =>
            run(() => updateTaskAction({ task_id: taskId, status: e.target.value }))
          }
        >
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="Fällig am"
          className="h-8 w-[8.5rem] text-xs"
          value={dueDraft}
          disabled={pending || isArchived}
          onChange={(e) => setDueDraft(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || isArchived}
          onClick={() =>
            run(() => updateTaskAction({ task_id: taskId, due_at: dueDraft }))
          }
        >
          Datum speichern
        </Button>
        {usersAvailable ? (
          <Select
            aria-label="Zugewiesen an"
            className="h-8 text-xs"
            value={assignedTo ?? ""}
            disabled={pending || isArchived}
            onChange={(e) =>
              run(() =>
                updateTaskAction({
                  task_id: taskId,
                  assigned_to: e.target.value || null,
                }),
              )
            }
          >
            <option value="">— Nicht zugewiesen —</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {userLabel(u)}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            Benutzerliste nicht verfügbar
          </span>
        )}
      </div>

      {/* Quick lifecycle actions */}
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
            onClick={handleArchive}
          >
            Archivieren
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">archiviert</span>
        )}
      </div>

      {error ? <p className="text-xs text-status-red">{error}</p> : null}
    </div>
  );
}
