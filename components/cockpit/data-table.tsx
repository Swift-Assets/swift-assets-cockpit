import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Presentational table primitives for the cockpit's compact, premium table
 * style (Linear/Attio-like): quiet header, hairline row dividers, hover
 * highlight, horizontal scroll on overflow. Compose these directly, or pass
 * rows via the higher-level helpers. No data logic here.
 */

export function DataTableContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Opaque solid surface — dense tables avoid backdrop-blur (perf: Part C).
        "cockpit-scroll w-full overflow-x-auto rounded-lg border border-border bg-panel-solid",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)}>
      {children}
    </table>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/50">
      <tr className="border-b border-border text-left">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/70 align-middle transition-colors last:border-0 hover:bg-muted/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-3 py-2.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A search/filter toolbar that sits above a table. */
export function DataTableToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
