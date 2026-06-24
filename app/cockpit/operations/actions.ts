"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const OPS_PATH = "/cockpit/operations";

/** Maps RPC errors to safe German messages (incl. not-yet-applied migration). */
function friendlyError(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("insufficient_role")) return "Keine Berechtigung.";
  if (m.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (m.includes("no_active_cockpit_profile")) return "Kein aktiver Cockpit-Zugang.";
  if (m.includes("check_not_found")) return "Check nicht gefunden.";
  if (m.includes("invalid_check_key")) return "Ungültiger Check.";
  if (
    m.includes("could not find") ||
    m.includes("does not exist") ||
    m.includes("function") ||
    m.includes("404")
  )
    return "Aktion noch nicht verfügbar (Migration 0032 nicht angewendet).";
  return "Aktion fehlgeschlagen. Bitte erneut versuchen.";
}

export async function resolveSystemHealthCheckAction(
  checkKey: string,
): Promise<ActionResult> {
  if (!checkKey) return { ok: false, error: "Ungültiger Check." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_resolve_system_health_check", {
    p_check_key: checkKey,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(OPS_PATH);
  return { ok: true };
}

export async function reopenSystemHealthCheckAction(
  checkKey: string,
): Promise<ActionResult> {
  if (!checkKey) return { ok: false, error: "Ungültiger Check." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_reopen_system_health_check", {
    p_check_key: checkKey,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(OPS_PATH);
  return { ok: true };
}

export async function runHealthCheckNowAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_run_health_check_now");
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(OPS_PATH);
  return { ok: true };
}
