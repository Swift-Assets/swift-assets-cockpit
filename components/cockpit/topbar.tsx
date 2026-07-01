import { Badge } from "@/components/ui/badge";
import type { CockpitProfile } from "@/lib/cockpit/profile";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Cockpit topbar — black chrome, continuous with the sidebar (website Nav
 * language). Calm, square, restrained.
 */
export function CockpitTopbar({ profile }: { profile: CockpitProfile }) {
  const name = profile.displayName ?? profile.email ?? "Unbekannt";
  return (
    <header className="sticky top-0 z-30 flex h-24 shrink-0 items-center justify-between gap-4 border-b border-border bg-[rgba(11,16,32,0.6)] px-8 text-foreground backdrop-blur-xl">
      <div className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute-2">
        Swift Assets · Internal Cockpit
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="muted" className="capitalize">
          {profile.role}
        </Badge>

        <div className="flex items-center gap-2 border-s border-border ps-4">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(124,92,255,0.9),rgba(56,189,248,0.9))] text-[0.7rem] font-semibold text-white"
            aria-hidden
          >
            {initials(name)}
          </span>
          <span className="hidden text-[13px] font-medium tracking-wide sm:inline">
            {name}
          </span>
        </div>

        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-nav transition-colors hover:bg-[rgba(255,255,255,0.12)] hover:text-foreground"
          >
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
