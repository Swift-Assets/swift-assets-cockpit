"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_OPTIONS,
  RELATED_KIND_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/cockpit/tasks";
import { createTaskAction } from "@/app/cockpit/tasks/actions";

export function TaskCreateForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("manual");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [relatedKind, setRelatedKind] = useState("");
  const [relatedLabel, setRelatedLabel] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setTaskType("manual");
    setPriority("medium");
    setDueAt("");
    setRelatedKind("");
    setRelatedLabel("");
    setDescription("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await createTaskAction({
        title,
        task_type: taskType,
        priority,
        due_at: dueAt,
        related_kind: relatedKind,
        related_label: relatedLabel,
        description,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setOk(true);
        reset();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Neue Aufgabe</h2>
        {ok ? (
          <span className="text-xs text-status-green">Aufgabe erstellt.</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-xs sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">Titel *</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kurzer, aussagekräftiger Titel…"
            required
          />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Typ</span>
          <Select
            className="w-full"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          >
            {TASK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Priorität</span>
          <Select
            className="w-full"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Fällig am</span>
          <Input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>

        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Bezugstyp</span>
          <Select
            className="w-full"
            value={relatedKind}
            onChange={(e) => setRelatedKind(e.target.value)}
          >
            <option value="">—</option>
            {RELATED_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-xs sm:col-span-2">
          <span className="text-muted-foreground">Bezug (Label)</span>
          <Input
            value={relatedLabel}
            onChange={(e) => setRelatedLabel(e.target.value)}
            placeholder="z. B. Firmenname oder Fall-Referenz (keine personenbezogenen Rohdaten)"
          />
        </label>

        <label className="space-y-1 text-xs sm:col-span-2 lg:col-span-3">
          <span className="text-muted-foreground">Beschreibung</span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Details…"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-status-red">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || title.trim().length === 0}>
          {pending ? "Wird erstellt…" : "Aufgabe erstellen"}
        </Button>
      </div>
    </form>
  );
}
