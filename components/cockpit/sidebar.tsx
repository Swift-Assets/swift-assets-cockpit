"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COCKPIT_NAV } from "@/lib/cockpit/nav";
import { cn } from "@/lib/utils";

export function CockpitSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <div className="h-6 w-6 rounded bg-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">
          Swift Assets · Cockpit
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {COCKPIT_NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.description}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <p className="px-3 text-[11px] leading-relaxed text-muted-foreground">
          Internes Werkzeug. Vertraulich.
        </p>
      </div>
    </aside>
  );
}
