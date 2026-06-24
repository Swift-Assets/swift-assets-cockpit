import { redirect } from "next/navigation";
import { CockpitShell } from "@/components/cockpit/shell";
import { getCockpitProfile } from "@/lib/cockpit/profile";

// Cockpit pages are always rendered per-request under the user's session.
export const dynamic = "force-dynamic";

export default async function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCockpitProfile();

  // Middleware already gates unauthenticated access; this is defense in depth.
  if (!profile) {
    redirect("/login");
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
