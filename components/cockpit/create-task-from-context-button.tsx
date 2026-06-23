"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  createTaskAction,
  type CreateTaskInput,
} from "@/app/cockpit/tasks/actions";

/**
 * One-click "create task from context" button. Accepts SAFE prefilled values
 * only (callers must not pass raw PII / announcement text). Creates the task via
 * the existing createTaskAction RPC wrapper, shows inline pending/success/error,
 * and disables itself after success to avoid accidental duplicates.
 */
export function CreateTaskFromContextButton({
  title,
  taskType,
  priority,
  description,
  relatedKind,
  relatedId,
  relatedLabel,
  sourceView,
  dueAt,
  label = "Aufgabe erstellen",
  size = "sm",
  variant = "outline",
  hasExistingTask = false,
  existingTaskLabel,
}: {
  title: string;
  taskType: CreateTaskInput["task_type"];
  priority: CreateTaskInput["priority"];
  description?: string;
  relatedKind?: string;
  relatedId?: string;
  relatedLabel?: string;
  sourceView?: string;
  dueAt?: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  /** When true, an open task already exists for this context: block creation. */
  hasExistingTask?: boolean;
  existingTaskLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const res = await createTaskAction({
        title,
        task_type: taskType,
        priority,
        description,
        related_kind: relatedKind,
        related_id: relatedId,
        related_label: relatedLabel,
        source_view: sourceView,
        due_at: dueAt,
      });
      if (!res.ok) setError(res.error);
      else setDone(true);
    });
  }

  if (done) {
    return <span className="text-xs text-status-green">Aufgabe erstellt ✓</span>;
  }

  if (hasExistingTask) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={existingTaskLabel ?? undefined}
      >
        Aufgabe existiert
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={pending}
        onClick={create}
      >
        {pending ? "Wird erstellt…" : label}
      </Button>
      {error ? <span className="text-xs text-status-red">{error}</span> : null}
    </span>
  );
}
