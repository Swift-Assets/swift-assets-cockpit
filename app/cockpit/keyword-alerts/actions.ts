"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ScanResult = { ok: true; count: number } | { ok: false; error: string };

const PATH = "/cockpit/keyword-alerts";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

function friendlyError(raw?: string): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("not_authenticated")) return "Bitte erneut anmelden.";
  if (m.includes("no_active_cockpit_profile")) return "Kein aktiver Cockpit-Zugang.";
  if (m.includes("name_required")) return "Name ist erforderlich.";
  if (m.includes("keywords_required")) return "Mindestens ein Schlüsselwort erforderlich.";
  if (m.includes("invalid_match_mode")) return "Ungültiger Modus.";
  if (m.includes("rule_not_found")) return "Regel nicht gefunden.";
  if (m.includes("match_not_found")) return "Treffer nicht gefunden.";
  if (
    m.includes("could not find") ||
    m.includes("does not exist") ||
    m.includes("function") ||
    m.includes("404")
  )
    return "Keyword-Alerts noch nicht verfügbar (Migration 0033 nicht angewendet).";
  return "Aktion fehlgeschlagen. Bitte erneut versuchen.";
}

function cleanKeywords(input: string[]): string[] {
  return [...new Set(input.map((k) => k.trim()).filter((k) => k.length > 0))].slice(0, 50);
}

export async function createKeywordAlertRuleAction(
  name: string,
  keywords: string[],
  matchMode: string,
  emailEnabled: boolean,
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Name ist erforderlich." };
  const kw = cleanKeywords(keywords);
  if (kw.length === 0) return { ok: false, error: "Mindestens ein Schlüsselwort erforderlich." };
  if (!["any", "all", "phrase"].includes(matchMode))
    return { ok: false, error: "Ungültiger Modus." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_create_keyword_alert_rule", {
    p_name: name.trim(),
    p_keywords: kw,
    p_match_mode: matchMode,
    p_email_enabled: emailEnabled,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateKeywordAlertRuleAction(input: {
  ruleId: string;
  name?: string;
  keywords?: string[];
  matchMode?: string;
  isActive?: boolean;
  emailEnabled?: boolean;
}): Promise<ActionResult> {
  if (!isUuid(input.ruleId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_update_keyword_alert_rule", {
    p_rule_id: input.ruleId,
    p_name: input.name ?? null,
    p_keywords: input.keywords ? cleanKeywords(input.keywords) : null,
    p_match_mode: input.matchMode ?? null,
    p_is_active: input.isActive ?? null,
    p_email_enabled: input.emailEnabled ?? null,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteKeywordAlertRuleAction(ruleId: string): Promise<ActionResult> {
  if (!isUuid(ruleId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_delete_keyword_alert_rule", {
    p_rule_id: ruleId,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(PATH);
  return { ok: true };
}

export async function dismissKeywordAlertMatchAction(matchId: string): Promise<ActionResult> {
  if (!isUuid(matchId)) return { ok: false, error: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cockpit_dismiss_keyword_alert_match", {
    p_match_id: matchId,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(PATH);
  return { ok: true };
}

export async function scanKeywordAlertsAction(): Promise<ScanResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cockpit_scan_keyword_alerts", {
    p_days: 30,
  });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath(PATH);
  return { ok: true, count: typeof data === "number" ? data : 0 };
}
