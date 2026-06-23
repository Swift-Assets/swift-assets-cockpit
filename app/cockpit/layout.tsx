import { redirect } from "next/navigation";
import { CockpitSidebar } from "@/components/cockpit/sidebar";
import { CockpitTopbar } from "@/components/cockpit/topbar";
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

  return (
    <div className="flex min-h-screen">
      <CockpitSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CockpitTopbar profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
