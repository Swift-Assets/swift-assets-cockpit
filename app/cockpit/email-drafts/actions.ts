"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const WATCHLIST_PATH = "/cockpit/watchlist";
const DRAFTS_PATH = "/cockpit/email-drafts";
const DASHBOARD_PATH = "/cockpit/dashboard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

const VALID_STATUS = new Set(["draft", "ready", "archived", "sent_external_later"]);

/** Maps known SECURITY DEFINER RPC exceptions to safe German messages. */
function friendlyError(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (m.includes("no_active_cockpit_profile")) return "Kein aktiver Cockpit-Zugang.";
  if (m.includes("insufficient_role")) return "Keine Berechtigung.";
  if (m.includes("invalid_kind")) return "Ungültiger Typ.";
  if (m.includes("watchlist_item_not_found"))
    return "Watchlist-Eintrag wurde nicht gefunden.";
  if (m.includes("draft_not_found")) return "Entwurf wurde nicht gefunden.";
  if (m.includes("invalid_status")) return "Ungültiger Status.";
  if (m.includes("subject_required")) return "Betreff ist erforderlich.";
  if (m.includes("body_required")) return "Text ist erforderlich.";
  return "Aktion fehlgeschlagen. Bitte erneut versuchen.";
}

export async function createOutreachDraftFromWatchlistAction(
  kind: string,
  watchId: string,
): Promise<ActionResult> {
  if (kind !== "company") return { ok: false, error: "Ungültiger Typ." };
  if (!isUuid(watchId)) return { ok: false, error: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "cockpit_create_outreach_draft_from_watchlist",
    { p_watch_kind: kind, p_watch_id: watchId },
  );
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(WATCHLIST_PATH);
  revalidatePath(DRAFTS_PATH);
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export interface UpdateOutreachDraftInput {
  draft_id: string;
  subject?: string;
  body?: string;
  recipient_name?: string;
  recipient_email?: string;
  status?: string;
}

export async function updateOutreachDraftAction(
  input: UpdateOutreachDraftInput,
): Promise<ActionResult> {
  if (!isUuid(input.draft_id)) return { ok: false, error: "Ungültige Eingabe." };
  if (input.status !== undefined && !VALID_STATUS.has(input.status))
    return { ok: false, error: "Ungültiger Status." };
  if (input.subject !== undefined && input.subject.trim().length === 0)
    return { ok: false, error: "Betreff ist erforderlich." };
  if (input.body !== undefined && input.body.trim().length === 0)
    return { ok: false, error: "Text ist erforderlich." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_update_outreach_draft", {
    p_draft_id: input.draft_id,
    p_subject: input.subject !== undefined ? input.subject.trim() : null,
    p_body: input.body !== undefined ? input.body.trim() : null,
    p_recipient_name:
      input.recipient_name !== undefined ? input.recipient_name.trim() : null,
    p_recipient_email:
      input.recipient_email !== undefined ? input.recipient_email.trim() : null,
    p_status: input.status ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };

  revalidatePath(DRAFTS_PATH);
  return { ok: true };
}

export async function markOutreachDraftReadyAction(
  draftId: string,
): Promise<ActionResult> {
  if (!isUuid(draftId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_mark_outreach_draft_ready", {
    p_draft_id: draftId,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(DRAFTS_PATH);
  return { ok: true };
}

export async function archiveOutreachDraftAction(
  draftId: string,
  note?: string,
): Promise<ActionResult> {
  if (!isUuid(draftId)) return { ok: false, error: "Ungültige Eingabe." };
  const trimmed = (note ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_archive_outreach_draft", {
    p_draft_id: draftId,
    p_note: trimmed.length > 0 ? trimmed : null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(DRAFTS_PATH);
  return { ok: true };
}
