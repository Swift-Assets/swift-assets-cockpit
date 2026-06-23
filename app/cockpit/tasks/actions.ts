"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isTaskPriority,
  isTaskRelatedKind,
  isTaskStatus,
  isTaskType,
} from "@/lib/cockpit/tasks";

export type ActionResult = { ok: true } | { ok: false; error: string };

const TASKS_PATH = "/cockpit/tasks";
const DASHBOARD_PATH = "/cockpit/dashboard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Optional date (YYYY-MM-DD) -> ISO at 09:00, null when empty, "invalid" otherwise. */
function optionalDueIso(date: string): string | null | "invalid" {
  const trimmed = date.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "invalid";
  const d = new Date(`${trimmed}T09:00:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

/** Maps known SECURITY DEFINER RPC exceptions to safe German messages. */
function friendlyError(raw?: string): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (msg.includes("no_active_cockpit_profile"))
    return "Kein aktiver Cockpit-Zugang.";
  if (msg.includes("insufficient_role"))
    return "Keine Berechtigung für diese Aktion.";
  if (msg.includes("title_required")) return "Titel ist erforderlich.";
  if (msg.includes("invalid_task_type")) return "Ungültiger Aufgabentyp.";
  if (msg.includes("invalid_priority")) return "Ungültige Priorität.";
  if (msg.includes("invalid_status")) return "Ungültiger Status.";
  if (msg.includes("invalid_related_kind")) return "Ungültiger Bezugstyp.";
  if (msg.includes("task_not_found")) return "Aufgabe wurde nicht gefunden.";
  return "Aktion fehlgeschlagen. Bitte erneut versuchen.";
}

function revalidate() {
  revalidatePath(TASKS_PATH);
  revalidatePath(DASHBOARD_PATH);
}

export interface CreateTaskInput {
  title: string;
  task_type: string;
  priority: string;
  description?: string;
  due_at?: string; // YYYY-MM-DD
  related_kind?: string;
  related_id?: string;
  related_label?: string;
  source_view?: string;
}

/** Create a task via cockpit_create_task. */
export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Titel ist erforderlich." };
  if (!isTaskType(input.task_type))
    return { ok: false, error: "Ungültiger Aufgabentyp." };
  if (!isTaskPriority(input.priority))
    return { ok: false, error: "Ungültige Priorität." };

  const relatedKind = (input.related_kind ?? "").trim();
  if (relatedKind && !isTaskRelatedKind(relatedKind))
    return { ok: false, error: "Ungültiger Bezugstyp." };

  const iso = optionalDueIso(input.due_at ?? "");
  if (iso === "invalid") return { ok: false, error: "Ungültiges Datum." };

  const relatedId = (input.related_id ?? "").trim();
  if (relatedId && !isUuid(relatedId))
    return { ok: false, error: "Ungültige Eingabe." };

  const description = (input.description ?? "").trim();
  const relatedLabel = (input.related_label ?? "").trim();
  const sourceView = (input.source_view ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_create_task", {
    p_title: title,
    p_task_type: input.task_type,
    p_description: description.length > 0 ? description : null,
    p_priority: input.priority,
    p_assigned_to: null,
    p_related_kind: relatedKind.length > 0 ? relatedKind : null,
    p_related_id: relatedId.length > 0 ? relatedId : null,
    p_related_label: relatedLabel.length > 0 ? relatedLabel : null,
    p_source_view: sourceView.length > 0 ? sourceView : null,
    p_due_at: iso,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidate();
  return { ok: true };
}

export interface UpdateTaskInput {
  task_id: string;
  /** Provide to change; omit to leave unchanged. */
  priority?: string;
  status?: string;
  /** "" clears the due date; "YYYY-MM-DD" sets it; undefined = no change. */
  due_at?: string;
  /** "" / null unassigns; a UUID assigns; undefined = no change. */
  assigned_to?: string | null;
}

/** Update priority / status / due date via cockpit_update_task (set-flag pattern). */
export async function updateTaskAction(
  input: UpdateTaskInput,
): Promise<ActionResult> {
  if (!isUuid(input.task_id)) return { ok: false, error: "Ungültige Eingabe." };

  const params: Record<string, unknown> = { p_task_id: input.task_id };

  if (input.priority !== undefined) {
    if (!isTaskPriority(input.priority))
      return { ok: false, error: "Ungültige Priorität." };
    params.p_set_priority = true;
    params.p_priority = input.priority;
  }

  if (input.status !== undefined) {
    if (!isTaskStatus(input.status))
      return { ok: false, error: "Ungültiger Status." };
    params.p_set_status = true;
    params.p_status = input.status;
  }

  if (input.due_at !== undefined) {
    const iso = optionalDueIso(input.due_at);
    if (iso === "invalid") return { ok: false, error: "Ungültiges Datum." };
    params.p_set_due = true;
    params.p_due_at = iso; // null clears the due date
  }

  if (input.assigned_to !== undefined) {
    const a = input.assigned_to;
    if (a !== null && a !== "" && !isUuid(a))
      return { ok: false, error: "Ungültige Eingabe." };
    params.p_set_assigned = true;
    params.p_assigned_to = a && a.length > 0 ? a : null; // null unassigns
  }

  // Nothing to change.
  if (Object.keys(params).length === 1) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_update_task", params);
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidate();
  return { ok: true };
}

export async function completeTaskAction(
  taskId: string,
  note?: string,
): Promise<ActionResult> {
  if (!isUuid(taskId)) return { ok: false, error: "Ungültige Eingabe." };
  const trimmed = (note ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_complete_task", {
    p_task_id: taskId,
    p_note: trimmed.length > 0 ? trimmed : null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidate();
  return { ok: true };
}

export async function reopenTaskAction(taskId: string): Promise<ActionResult> {
  if (!isUuid(taskId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_reopen_task", {
    p_task_id: taskId,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidate();
  return { ok: true };
}

export async function archiveTaskAction(taskId: string): Promise<ActionResult> {
  if (!isUuid(taskId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_archive_task", {
    p_task_id: taskId,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidate();
  return { ok: true };
}
