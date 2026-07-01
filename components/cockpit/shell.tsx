import type { ReactNode } from "react";
import { CockpitSidebar } from "@/components/cockpit/sidebar";
import { CockpitTopbar } from "@/components/cockpit/topbar";
import type { CockpitProfile } from "@/lib/cockpit/profile";

/**
 * Cockpit application shell: fixed sidebar + sticky topbar + scrollable content
 * canvas. Presentational composition used by the cockpit layout.
 */
export function CockpitShell({
  profile,
  children,
}: {
  profile: CockpitProfile;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <CockpitSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CockpitTopbar profile={profile} />
        <main className="cockpit-scroll flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-6 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
