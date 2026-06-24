import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Polished, intentional empty state. Used when a list/table has 0 rows so the
 * screen reads as "nothing here yet", never as broken. Icon is optional; the
 * action slot typically holds a button or a disabled "next-step" hint.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
