import { createClient } from "@/lib/supabase/server";

/** A safe, minimal active cockpit user (from swift_v2.v_cockpit_users). */
export interface CockpitUser {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
}

export interface CockpitUsersResult {
  available: boolean;
  rows: CockpitUser[];
}

/**
 * Reads the safe active cockpit users list (Phase 6I). Fail-safe: if the view
 * does not exist yet (migration 0027 not applied) or on any error, returns
 * available:false so the assignee picker degrades gracefully. Read-only; never
 * touches cockpit_user_profiles or auth.users directly.
 */
export async function getCockpitUsers(): Promise<CockpitUsersResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_users")
      .select("user_id, display_name, email, role, is_active")
      .order("display_name", { ascending: true });

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as CockpitUser[] };
  } catch {
    return { available: false, rows: [] };
  }
}
