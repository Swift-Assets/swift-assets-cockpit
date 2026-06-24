import { createClient } from "@/lib/supabase/server";

/** One row of swift_v2.v_cockpit_keyword_alert_rules (own rules only). */
export interface KeywordAlertRule {
  rule_id: string;
  name: string | null;
  keywords: string[] | null;
  match_mode: string | null;
  is_active: boolean | null;
  email_enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  match_count: number | null;
}

/** One row of swift_v2.v_cockpit_keyword_alert_matches (own matches only). */
export interface KeywordAlertMatch {
  match_id: string;
  rule_id: string | null;
  entity_id: string | null;
  announcement_id: string | null;
  matched_keywords: string[] | null;
  announcement_date: string | null;
  company_name: string | null;
  court: string | null;
  case_number: string | null;
  phase: string | null;
  administrator_name: string | null;
  matched_at: string | null;
  email_queued_at: string | null;
  email_sent_at: string | null;
  status: string | null;
}

export interface RulesResult {
  available: boolean;
  rows: KeywordAlertRule[];
}
export interface MatchesResult {
  available: boolean;
  rows: KeywordAlertMatch[];
}

/** Fail-safe: returns available:false if the view is absent (migration 0033 not applied). */
export async function getKeywordAlertRules(): Promise<RulesResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_keyword_alert_rules")
      .select(
        "rule_id, name, keywords, match_mode, is_active, email_enabled, created_at, updated_at, match_count",
      )
      .order("created_at", { ascending: false });
    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as KeywordAlertRule[] };
  } catch {
    return { available: false, rows: [] };
  }
}

export async function getKeywordAlertMatches(): Promise<MatchesResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_keyword_alert_matches")
      .select(
        "match_id, rule_id, entity_id, announcement_id, matched_keywords, announcement_date, company_name, court, case_number, phase, administrator_name, matched_at, email_queued_at, email_sent_at, status",
      )
      .order("matched_at", { ascending: false })
      .limit(100);
    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as KeywordAlertMatch[] };
  } catch {
    return { available: false, rows: [] };
  }
}
