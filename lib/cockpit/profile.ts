import { createClient } from "@/lib/supabase/server";

export type CockpitRole = "viewer" | "analyst" | "lead" | "admin";

export interface CockpitProfile {
  userId: string;
  email: string | null;
  role: CockpitRole;
  isActive: boolean;
  nachlassAuthorized: boolean;
  displayName: string | null;
}

/**
 * Loads the current authenticated user and their Cockpit profile from
 * swift_v2.cockpit_user_profiles (RLS: self-read only).
 *
 * Returns null if there is no session or no matching active profile. Read-only;
 * no writes are performed in this PR.
 */
export async function getCockpitProfile(): Promise<CockpitProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Column names below are intentionally defensive: this PR does not assume the
  // full profile shape beyond the documented fields (role, active flags,
  // nachlass_authorized). If a column is absent the query simply errors and we
  // fall back to a minimal viewer profile rather than leaking access.
  const { data, error } = await supabase
    .from("cockpit_user_profiles")
    .select("role, is_active, nachlass_authorized, display_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "viewer",
      isActive: false,
      nachlassAuthorized: false,
      displayName: user.email ?? null,
    };
  }

  return {
    userId: user.id,
    email: (data.email as string | null) ?? user.email ?? null,
    role: (data.role as CockpitRole) ?? "viewer",
    isActive: Boolean(data.is_active),
    nachlassAuthorized: Boolean(data.nachlass_authorized),
    displayName: (data.display_name as string | null) ?? user.email ?? null,
  };
}
