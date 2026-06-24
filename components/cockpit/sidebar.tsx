"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COCKPIT_NAV } from "@/lib/cockpit/nav";
import { BirdMark, Wordmark } from "@/components/cockpit/brand";
import { cn } from "@/lib/utils";

export function CockpitSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-border bg-card md:flex">
      {/* Brand lockup: bird + halo + wordmark */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <BirdMark size={34} />
        <Wordmark size="sm" />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="px-3 pb-1.5 pt-2 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/70">
          Navigation
        </p>
        {COCKPIT_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.description}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[0.7rem] font-medium text-foreground">
            Vertraulich · Intern
          </p>
          <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
            Nur für autorisierte Mitarbeitende.
          </p>
        </div>
      </div>
    </aside>
  );
}
