"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Right-side slide-over detail panel (presentational). Controlled via `open` /
 * `onClose`. Renders an overlay + a fixed panel with a sticky header and a
 * scrollable body. Use DetailSection / DetailField for consistent inner layout.
 *
 * This is a reusable primitive for future detail UX; the watchlist currently
 * uses an inline expandable row, which remains valid.
 */
export function DetailPanel({
  open,
  onClose,
  title,
  subtitle,
  badges,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-pop">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-base font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
            {badges ? <div className="flex flex-wrap gap-1.5 pt-1">{badges}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Schließen
          </button>
        </div>
        <div className="cockpit-scroll flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-border px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** A titled group of fields inside a DetailPanel (or anywhere). */
export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

/** A label/value row used inside DetailSection. */
export function DetailField({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}
