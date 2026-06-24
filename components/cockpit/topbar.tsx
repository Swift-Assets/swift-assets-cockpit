import { Badge } from "@/components/ui/badge";
import type { CockpitProfile } from "@/lib/cockpit/profile";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CockpitTopbar({ profile }: { profile: CockpitProfile }) {
  const name = profile.displayName ?? profile.email ?? "Unbekannt";
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">Swift Assets V2</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">Internal Cockpit</span>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="capitalize">
          {profile.role}
        </Badge>
        {profile.nachlassAuthorized ? (
          <Badge variant="green" title="Nachlass-Berechtigung">
            Nachlass
          </Badge>
        ) : null}

        <div className="flex items-center gap-2 border-l border-border pl-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground"
            aria-hidden
          >
            {initials(name)}
          </span>
          <span className="hidden text-sm font-medium sm:inline">{name}</span>
        </div>

        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
