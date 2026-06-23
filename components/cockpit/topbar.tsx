import { Badge } from "@/components/ui/badge";
import type { CockpitProfile } from "@/lib/cockpit/profile";

export function CockpitTopbar({ profile }: { profile: CockpitProfile }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
      <div className="text-sm text-muted-foreground">
        Swift Assets V2 — Internal Cockpit
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline">{profile.role}</Badge>
        {profile.nachlassAuthorized ? (
          <Badge variant="green">Nachlass</Badge>
        ) : null}
        <span className="text-sm font-medium">
          {profile.displayName ?? profile.email}
        </span>
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
