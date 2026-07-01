import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SolidCard — opaque variant of the glass surface (same palette, no blur).
 *
 * Per the perf note (Part C): backdrop-filter is expensive when many elements
 * use it at once, so dense tables and long lists should sit on this cheaper
 * opaque surface (--panel-solid) instead of <GlassCard>.
 */
export const SolidCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("solid-surface", className)} {...props} />
));
SolidCard.displayName = "SolidCard";
