"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AiOutreachResult =
  | { ok: true; draftId?: string }
  | { ok: false; error: string; activeDraftExists?: boolean };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

/** Maps safe Edge Function / RPC error tokens to German UI messages. */
function friendlyError(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("active_draft_exists"))
    return "Es existiert bereits ein aktiver Entwurf für diesen Fall.";
  if (m.includes("ai_provider_not_configured"))
    return "KI-Anbieter ist noch nicht konfiguriert.";
  if (m.includes("watchlist_item_not_found"))
    return "Watchlist-Eintrag wurde nicht gefunden.";
  if (m.includes("insufficient_role")) return "Keine Berechtigung.";
  if (m.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (m.includes("no_active_cockpit_profile")) return "Kein aktiver Cockpit-Zugang.";
  if (m.includes("invalid_ai_response"))
    return "KI-Antwort konnte nicht verarbeitet werden.";
  if (m.includes("invalid_language")) return "Ungültige Sprache.";
  if (m.includes("subject_required")) return "Betreff fehlt.";
  if (m.includes("body_required")) return "Text fehlt.";
  if (m.includes("invalid_kind")) return "Ungültiger Typ.";
  if (
    m.includes("failed to send") ||
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("fetch")
  )
    return "KI-Funktion noch nicht verbunden.";
  return "KI-E-Mail-Entwurf fehlgeschlagen. Bitte erneut versuchen.";
}

/**
 * Requests an AI-generated German outreach email draft for a watchlist item by
 * invoking the Supabase Edge Function `generate-outreach-email-draft` with the
 * user's session JWT. All AI work and provider keys live server-side in the
 * Edge Function — never here, never in the browser. No direct table writes, no
 * email sending. By default it will NOT overwrite an existing active draft
 * (`active_draft_exists`); pass replaceExisting=true to replace.
 *
 * Until the Edge Function is deployed (and a provider key configured), the
 * invoke fails and a safe German message is shown.
 */
export async function generateAiOutreachDraftAction(
  kind: string,
  watchId: string,
  replaceExisting = false,
): Promise<AiOutreachResult> {
  if (kind !== "company") return { ok: false, error: "Ungültiger Typ." };
  if (!isUuid(watchId)) return { ok: false, error: "Ungültige Eingabe." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "generate-outreach-email-draft",
      { body: { watch_kind: kind, watch_id: watchId, replace_existing: replaceExisting } },
    );

    const token = (
      (error?.message ?? "") +
      " " +
      ((data as { error?: string } | null)?.error ?? "")
    ).toLowerCase();
    const activeDraftExists = token.includes("active_draft_exists");

    if (error)
      return { ok: false, error: friendlyError(error.message), activeDraftExists };
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok === false) {
      return {
        ok: false,
        error: friendlyError((data as { error?: string }).error),
        activeDraftExists,
      };
    }

    revalidatePath("/cockpit/watchlist");
    revalidatePath("/cockpit/email-drafts");
    return {
      ok: true,
      draftId: (data as { draft_id?: string } | null)?.draft_id,
    };
  } catch (e) {
    return {
      ok: false,
      error: friendlyError(e instanceof Error ? e.message : undefined),
    };
  }
}
