import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Editorial page header matching the Swift Assets website: an uppercase,
 * wide-tracked eyebrow label, a large bold title, a short hairline divider, an
 * optional lead paragraph, and an optional right-aligned action slot.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  action,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0 space-y-5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <div className="h-px w-24 bg-ink-mid" aria-hidden />
        {lead ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {lead}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </div>
  );
}
