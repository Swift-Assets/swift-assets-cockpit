"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchCompanyCandidates } from "@/lib/cockpit/watchlist.queries";
import {
  isWatchStatus,
  type CompanyCandidate,
  type WatchKind,
} from "@/lib/cockpit/watchlist";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SearchResult =
  | { ok: true; rows: CompanyCandidate[] }
  | { ok: false; error: string };

const PATH = "/cockpit/watchlist";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Validates an optional follow-up date (YYYY-MM-DD) and returns it as an ISO
 * timestamp, or null when empty. Throws a sentinel on invalid input.
 */
function optionalFollowUpIso(date: string): string | null | "invalid" {
  const trimmed = date.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "invalid";
  const d = new Date(`${trimmed}T09:00:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

/**
 * Maps known SECURITY DEFINER RPC exceptions to safe German messages.
 * Never surfaces raw SQL / internal detail to the UI.
 */
function friendlyError(raw?: string): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (msg.includes("no_active_cockpit_profile"))
    return "Kein aktiver Cockpit-Zugang.";
  if (msg.includes("insufficient_role"))
    return "Keine Schreibberechtigung für diese Aktion.";
  if (msg.includes("not_nachlass_authorized"))
    return "Keine Berechtigung für Nachlass-Einträge.";
  if (msg.includes("watchlist_row_not_found"))
    return "Eintrag wurde nicht gefunden.";
  if (msg.includes("invalid_status")) return "Ungültiger Status.";
  if (msg.includes("invalid_kind")) return "Ungültiger Eintragstyp.";
  if (msg.includes("entity_not_eligible_company"))
    return "Dieses Unternehmen kann nicht hinzugefügt werden.";
  if (msg.includes("detection_not_found"))
    return "Eintrag wurde nicht gefunden.";
  if (
    msg.includes("permission") ||
    msg.includes("denied") ||
    msg.includes("forbidden")
  )
    return "Keine Schreibberechtigung für diese Aktion.";
  return "Aktion fehlgeschlagen. Bitte erneut versuchen.";
}

function isKind(value: string): value is WatchKind {
  return value === "company" || value === "nachlass";
}

/** Update the watchlist status (watching | pursuing | passed). */
export async function updateStatusAction(
  kind: string,
  subjectId: string,
  status: string,
): Promise<ActionResult> {
  if (!isKind(kind) || !subjectId) return { ok: false, error: "Ungültige Eingabe." };
  if (!isWatchStatus(status)) return { ok: false, error: "Ungültiger Status." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watchlist_update", {
    p_kind: kind,
    p_subject_id: subjectId,
    p_set_status: true,
    p_status: status,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Update (or clear, when empty) the user's private note for a row. */
export async function updateNoteAction(
  kind: string,
  subjectId: string,
  note: string,
): Promise<ActionResult> {
  if (!isKind(kind) || !subjectId) return { ok: false, error: "Ungültige Eingabe." };

  const trimmed = note.trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watchlist_update", {
    p_kind: kind,
    p_subject_id: subjectId,
    p_set_note: true,
    p_note: trimmed.length > 0 ? trimmed : null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Set a follow-up date (YYYY-MM-DD) for a row. */
export async function setFollowUpAction(
  kind: string,
  subjectId: string,
  date: string,
): Promise<ActionResult> {
  if (!isKind(kind) || !subjectId) return { ok: false, error: "Ungültige Eingabe." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, error: "Ungültiges Datum." };

  const iso = new Date(`${date}T09:00:00`);
  if (Number.isNaN(iso.getTime()))
    return { ok: false, error: "Ungültiges Datum." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watchlist_update", {
    p_kind: kind,
    p_subject_id: subjectId,
    p_set_follow_up: true,
    p_next_follow_up_at: iso.toISOString(),
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Clear the follow-up date for a row. */
export async function clearFollowUpAction(
  kind: string,
  subjectId: string,
): Promise<ActionResult> {
  if (!isKind(kind) || !subjectId) return { ok: false, error: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watchlist_update", {
    p_kind: kind,
    p_subject_id: subjectId,
    p_clear_follow_up: true,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Search eligible company candidates (read-only, non-sensitive columns). */
export async function searchCompaniesAction(
  query: string,
): Promise<SearchResult> {
  const { rows, error } = await searchCompanyCandidates(query);
  if (error) return { ok: false, error };
  return { ok: true, rows };
}

/** Add a company to the user's watchlist via cockpit_watch_company. */
export async function watchCompanyAction(
  entityId: string,
  status: string,
  note: string,
  followUpDate: string,
): Promise<ActionResult> {
  if (!isUuid(entityId)) return { ok: false, error: "Ungültige Eingabe." };
  if (!isWatchStatus(status)) return { ok: false, error: "Ungültiger Status." };

  const iso = optionalFollowUpIso(followUpDate);
  if (iso === "invalid") return { ok: false, error: "Ungültiges Datum." };

  const trimmedNote = note.trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watch_company", {
    p_entity_id: entityId,
    p_note: trimmedNote.length > 0 ? trimmedNote : null,
    p_status: status,
    p_next_follow_up_at: iso,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Add a Nachlass case to the user's watchlist via cockpit_watch_nachlass. */
export async function watchNachlassAction(
  detectionId: string,
  status: string,
  note: string,
  followUpDate: string,
): Promise<ActionResult> {
  if (!isUuid(detectionId)) return { ok: false, error: "Ungültige Eingabe." };
  if (!isWatchStatus(status)) return { ok: false, error: "Ungültiger Status." };

  const iso = optionalFollowUpIso(followUpDate);
  if (iso === "invalid") return { ok: false, error: "Ungültiges Datum." };

  const trimmedNote = note.trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_watch_nachlass", {
    p_detection_id: detectionId,
    p_note: trimmedNote.length > 0 ? trimmedNote : null,
    p_status: status,
    p_next_follow_up_at: iso,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}

/** Remove a row from the watchlist via the kind-specific unwatch RPC. */
export async function removeFromWatchlistAction(
  kind: string,
  subjectId: string,
): Promise<ActionResult> {
  if (!isKind(kind) || !subjectId) return { ok: false, error: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { error } =
    kind === "company"
      ? await supabase.rpc("cockpit_unwatch_company", { p_entity_id: subjectId })
      : await supabase.rpc("cockpit_unwatch_nachlass", {
          p_detection_id: subjectId,
        });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(PATH);
  return { ok: true };
}
