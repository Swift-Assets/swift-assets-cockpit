import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CockpitShell } from "@/components/cockpit/shell";
import { getCockpitProfile, type CockpitProfile } from "@/lib/cockpit/profile";
import { TEMP_ACCESS_COOKIE, TEMP_ACCESS_VALUE } from "@/lib/auth/temp-access";

// Cockpit pages are always rendered per-request under the user's session.
export const dynamic = "force-dynamic";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Access is gated by the access-code cookie (enforced in middleware). When a
 * real Supabase session exists we use its profile; otherwise, with a valid
 * access cookie, we render the shell under a minimal fallback profile (data that
 * needs a Supabase session simply shows empty states). To restore Magic Link,
 * drop the fallback branch and redirect when getCockpitProfile() is null.
 */
const FALLBACK_PROFILE: CockpitProfile = {
  userId: "",
  email: null,
  role: "viewer",
  isActive: true,
  nachlassAuthorized: false,
  displayName: "Zugangscode",
};

export default async function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCockpitProfile();

  if (!profile) {
    const cookieStore = await cookies();
    const hasTempAccess =
      cookieStore.get(TEMP_ACCESS_COOKIE)?.value === TEMP_ACCESS_VALUE;
    // Defense in depth — middleware already redirects unauthenticated /cockpit/*.
    if (!hasTempAccess) redirect("/login");
    return <CockpitShell profile={FALLBACK_PROFILE}>{children}</CockpitShell>;
  }

  if (!profile.isActive) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Kein aktiver Zugang</h1>
          <p className="text-sm text-muted-foreground">
            Ihr Konto ist angemeldet, aber für das Cockpit nicht aktiviert.
            Bitte wenden Sie sich an einen Administrator.
          </p>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Abmelden
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <CockpitShell profile={profile}>{children}</CockpitShell>;
}
