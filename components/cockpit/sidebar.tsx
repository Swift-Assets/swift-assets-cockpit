"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COCKPIT_NAV } from "@/lib/cockpit/nav";
import { BirdMark, Wordmark } from "@/components/cockpit/brand";
import { cn } from "@/lib/utils";

/**
 * Cockpit sidebar — black chrome mirroring the website Nav.tsx: ink background,
 * #1a1a1a border, real logo, muted #bdbdbd nav text hovering to white, square
 * minimal active state.
 */
export function CockpitSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-soft bg-ink text-white md:flex">
      {/* Brand lockup */}
      <div className="flex h-24 items-center gap-3 border-b border-ink-soft px-6">
        <BirdMark size={40} />
        <Wordmark size="sm" invert />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 pt-1 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-mute">
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
                "group relative flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium tracking-wide transition-colors",
                active
                  ? "bg-ink-soft text-white"
                  : "text-nav hover:text-white",
              )}
            >
              {active ? (
                <span
                  className="absolute inset-y-0 left-0 w-0.5 bg-white"
                  aria-hidden
                />
              ) : null}
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-soft px-6 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-mute">
          Vertraulich · Intern
        </p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-mute-2">
          Nur für autorisierte Mitarbeitende.
        </p>
      </div>
    </aside>
  );
}
