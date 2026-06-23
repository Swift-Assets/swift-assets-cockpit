/**
 * Client-safe task enums, options and types (no server imports). Shared by the
 * server query/action modules and the client form/row components.
 */

export type TaskDueBucket =
  | "overdue"
  | "today"
  | "tomorrow"
  | "upcoming"
  | "no_due_date";

export type TaskType =
  | "follow_up"
  | "review"
  | "outreach"
  | "system_issue"
  | "data_quality"
  | "legal_review"
  | "privacy_review"
  | "portal_health"
  | "manual";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "done"
  | "archived";

export type TaskRelatedKind =
  | "company"
  | "nachlass"
  | "watchlist"
  | "entity"
  | "system"
  | "portal"
  | "privacy"
  | "email"
  | "data_quality"
  | "manual";

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "manual", label: "Manuell" },
  { value: "follow_up", label: "Follow-up" },
  { value: "review", label: "Prüfung" },
  { value: "outreach", label: "Outreach" },
  { value: "system_issue", label: "System-Problem" },
  { value: "data_quality", label: "Datenqualität" },
  { value: "legal_review", label: "Rechtsprüfung" },
  { value: "privacy_review", label: "Datenschutz-Prüfung" },
  { value: "portal_health", label: "Portal-Health" },
];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
  { value: "urgent", label: "Dringend" },
];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "waiting", label: "Wartend" },
  { value: "done", label: "Erledigt" },
  { value: "archived", label: "Archiviert" },
];

export const RELATED_KIND_OPTIONS: { value: TaskRelatedKind; label: string }[] = [
  { value: "company", label: "Firma" },
  { value: "nachlass", label: "Nachlass" },
  { value: "watchlist", label: "Watchlist" },
  { value: "entity", label: "Entität" },
  { value: "system", label: "System" },
  { value: "portal", label: "Portal" },
  { value: "privacy", label: "Datenschutz" },
  { value: "email", label: "E-Mail" },
  { value: "data_quality", label: "Datenqualität" },
  { value: "manual", label: "Manuell" },
];

const TASK_TYPES = new Set(TASK_TYPE_OPTIONS.map((o) => o.value));
const PRIORITIES = new Set(PRIORITY_OPTIONS.map((o) => o.value));
const RELATED_KINDS = new Set(RELATED_KIND_OPTIONS.map((o) => o.value));

export function isTaskType(v: string): v is TaskType {
  return TASK_TYPES.has(v as TaskType);
}
export function isTaskPriority(v: string): v is TaskPriority {
  return PRIORITIES.has(v as TaskPriority);
}
export function isTaskRelatedKind(v: string): v is TaskRelatedKind {
  return RELATED_KINDS.has(v as TaskRelatedKind);
}

const TASK_STATUSES = new Set(TASK_STATUS_OPTIONS.map((o) => o.value));
export function isTaskStatus(v: string): v is TaskStatus {
  return TASK_STATUSES.has(v as TaskStatus);
}

/** A task is "open" (blocks duplicates) when not done and not archived. */
export function isOpenTaskStatus(status: string | null): boolean {
  return status === "open" || status === "in_progress" || status === "waiting";
}

export function taskTypeLabel(v: string | null): string {
  return TASK_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? (v ?? "—");
}
export function priorityLabel(v: string | null): string {
  return PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? (v ?? "—");
}

/** One row of swift_v2.v_cockpit_my_tasks — safe internal task fields only. */
export interface TaskRow {
  task_id: string;
  title: string | null;
  description: string | null;
  task_type: string | null;
  priority: string | null;
  status: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  related_kind: string | null;
  related_id: string | null;
  related_label: string | null;
  source_view: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  age_days: number | null;
  due_bucket: TaskDueBucket | null;
  event_count: number | null;
  latest_event_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Lightweight duplicate detection for context-created tasks                    */
/* -------------------------------------------------------------------------- */

/** Safe context describing a would-be task created from a UI element. */
export interface TaskContext {
  taskType: string;
  relatedKind?: string | null;
  relatedId?: string | null;
  sourceView?: string | null;
  relatedLabel?: string | null;
}

function idKey(kind: string, id: string): string {
  return `id:${kind}:${id}`;
}
function labelKey(
  kind: string,
  sourceView: string,
  label: string,
  taskType: string,
): string {
  return `lbl:${kind}:${sourceView}:${label}:${taskType}`;
}

/**
 * Builds the set of "open task" context keys from already-loaded task rows.
 * Returned as a string[] so it can be passed to client components. Each open
 * task contributes an id-based key (when it has a related_id) and a
 * label-based key (source_view + related_label + task_type).
 */
export function openTaskContextKeys(tasks: TaskRow[]): string[] {
  const out = new Set<string>();
  for (const t of tasks) {
    if (!isOpenTaskStatus(t.status)) continue;
    const kind = t.related_kind ?? "";
    if (t.related_id) out.add(idKey(kind, t.related_id));
    out.add(
      labelKey(kind, t.source_view ?? "", t.related_label ?? "", t.task_type ?? ""),
    );
  }
  return [...out];
}

/**
 * True when an open task already matches the given context. Matches by
 * related_id when the context carries one, otherwise by
 * source_view + related_label + task_type (related_kind always considered).
 */
export function hasOpenTaskForContext(
  keys: string[] | Set<string>,
  ctx: TaskContext,
): boolean {
  const set = Array.isArray(keys) ? new Set(keys) : keys;
  const kind = ctx.relatedKind ?? "";
  if (ctx.relatedId) {
    return set.has(idKey(kind, ctx.relatedId));
  }
  return set.has(
    labelKey(kind, ctx.sourceView ?? "", ctx.relatedLabel ?? "", ctx.taskType),
  );
}

/** Returns the matching open task (for showing its title), or null. */
export function findOpenTaskForContext(
  tasks: TaskRow[],
  ctx: TaskContext,
): TaskRow | null {
  const kind = ctx.relatedKind ?? "";
  for (const t of tasks) {
    if (!isOpenTaskStatus(t.status)) continue;
    if ((t.related_kind ?? "") !== kind) continue;
    if (ctx.relatedId) {
      if (t.related_id === ctx.relatedId) return t;
    } else if (
      (t.source_view ?? "") === (ctx.sourceView ?? "") &&
      (t.related_label ?? "") === (ctx.relatedLabel ?? "") &&
      (t.task_type ?? "") === ctx.taskType
    ) {
      return t;
    }
  }
  return null;
}
