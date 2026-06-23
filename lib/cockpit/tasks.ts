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
