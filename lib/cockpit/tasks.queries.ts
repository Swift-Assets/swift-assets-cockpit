import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "@/lib/cockpit/tasks";

export type { TaskRow, TaskDueBucket } from "@/lib/cockpit/tasks";

export interface TasksResult {
  available: boolean;
  rows: TaskRow[];
}

const TASK_COLUMNS =
  "task_id, title, description, task_type, priority, status, assigned_to, assigned_to_name, assigned_to_email, created_by, created_by_name, created_by_email, related_kind, related_id, related_label, source_view, due_at, completed_at, created_at, updated_at, age_days, due_bucket, event_count, latest_event_at";

/**
 * Reads the team-visible task view (Phase 6E). Fail-safe: if the view does not
 * exist yet (migration 0026 not applied) or on any error, returns
 * available:false so the UI shows a placeholder. Read-only.
 */
export async function getMyTasks(): Promise<TasksResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_my_tasks")
      .select(TASK_COLUMNS)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as TaskRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}

const ACTIVE_STATUSES = new Set(["open", "in_progress", "waiting"]);
const HIGH_PRIORITIES = new Set(["high", "urgent"]);

export interface TasksSummary {
  available: boolean;
  openTotal: number;
  overdue: number;
  dueToday: number;
  highOrUrgent: number;
}

/** Derives dashboard KPIs from already-loaded task rows (active tasks only). */
export function summarizeTasks(result: TasksResult): TasksSummary {
  if (!result.available) {
    return {
      available: false,
      openTotal: 0,
      overdue: 0,
      dueToday: 0,
      highOrUrgent: 0,
    };
  }
  let openTotal = 0;
  let overdue = 0;
  let dueToday = 0;
  let highOrUrgent = 0;
  for (const t of result.rows) {
    if (!ACTIVE_STATUSES.has(t.status ?? "")) continue;
    openTotal += 1;
    if (t.due_bucket === "overdue") overdue += 1;
    if (t.due_bucket === "today") dueToday += 1;
    if (HIGH_PRIORITIES.has(t.priority ?? "")) highOrUrgent += 1;
  }
  return { available: true, openTotal, overdue, dueToday, highOrUrgent };
}
