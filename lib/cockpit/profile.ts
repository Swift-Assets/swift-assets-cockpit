import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CockpitRole = "viewer" | "analyst" | "lead" | "admin";

export interface CockpitProfile {
  userId: string;
  email: string | null;
  role: CockpitRole;
  isActive: boolean;
  displayName: string | null;
}

/**
 * Loads the current authenticated user and their Cockpit profile from
 * swift_v2.cockpit_user_profiles (RLS: self-read only).
 *
 * Returns null if there is no session or no matching active profile. Read-only.
 *
 * Wrapped in React `cache()` so it runs at most ONCE per server request: the
 * cockpit layout and any page (e.g. settings) that both call it share a single
 * `supabase.auth.getUser()` round-trip + profile query instead of repeating it.
 * The cache is per-request, so each navigation still re-validates auth fresh.
 */
export const getCockpitProfile = cache(
  async (): Promise<CockpitProfile | null> => {
    const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Read only the safe, still-present profile columns. If a column is absent the
  // query errors and we fall back to a minimal viewer profile rather than leaking
  // access. (The Nachlass feature was removed, so nachlass_authorized is gone.)
  const { data, error } = await supabase
    .from("cockpit_user_profiles")
    .select("role, is_active, display_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "viewer",
      isActive: false,
      displayName: user.email ?? null,
    };
  }

    return {
      userId: user.id,
      email: (data.email as string | null) ?? user.email ?? null,
      role: (data.role as CockpitRole) ?? "viewer",
      isActive: Boolean(data.is_active),
      displayName: (data.display_name as string | null) ?? user.email ?? null,
    };
  },
);
