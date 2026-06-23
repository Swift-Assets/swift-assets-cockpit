"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true; reviewId?: string }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

/** Maps safe Edge Function / RPC error tokens to German UI messages. */
function friendlyError(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("ai_provider_not_configured"))
    return "KI-Anbieter ist noch nicht konfiguriert.";
  if (m.includes("watchlist_item_not_found"))
    return "Watchlist-Eintrag nicht gefunden.";
  if (m.includes("nachlass_not_authorized"))
    return "Keine Berechtigung für Nachlass-Fälle.";
  if (m.includes("insufficient_role")) return "Keine Berechtigung.";
  if (m.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (m.includes("no_active_cockpit_profile")) return "Kein aktiver Cockpit-Zugang.";
  if (m.includes("invalid_ai_response"))
    return "KI-Antwort konnte nicht verarbeitet werden.";
  if (m.includes("invalid_review_state"))
    return "Diese KI-Bewertung wurde bereits verarbeitet. Bitte neu laden.";
  if (m.includes("invalid_kind")) return "Ungültiger Typ.";
  if (
    m.includes("failed to send") ||
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("fetch")
  )
    return "KI-Funktion noch nicht verbunden.";
  return "KI-Bewertung fehlgeschlagen. Bitte erneut versuchen.";
}

/**
 * Requests an AI case review for a watchlist item by invoking the Supabase Edge
 * Function `generate-watchlist-ai-review` with the user's session JWT. All AI
 * work and provider keys live server-side in the Edge Function — never here,
 * never in the browser. No direct table writes.
 *
 * Until the Edge Function is deployed (and a provider key configured), the
 * invoke fails and a safe "KI-Funktion noch nicht verbunden." message is shown.
 */
export async function generateAiCaseReviewAction(
  kind: string,
  watchId: string,
): Promise<ActionResult> {
  if (kind !== "company" && kind !== "nachlass")
    return { ok: false, error: "Ungültiger Typ." };
  if (!isUuid(watchId)) return { ok: false, error: "Ungültige Eingabe." };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.functions.invoke(
      "generate-watchlist-ai-review",
      { body: { watch_kind: kind, watch_id: watchId } },
    );

    if (error) return { ok: false, error: friendlyError(error.message) };
    if (data && typeof data === "object" && (data as { ok?: boolean }).ok === false) {
      return { ok: false, error: friendlyError((data as { error?: string }).error) };
    }

    revalidatePath("/cockpit/watchlist");
    return {
      ok: true,
      reviewId: (data as { review_id?: string } | null)?.review_id,
    };
  } catch (e) {
    return {
      ok: false,
      error: friendlyError(e instanceof Error ? e.message : undefined),
    };
  }
}
