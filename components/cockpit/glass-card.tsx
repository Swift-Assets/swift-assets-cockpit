import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GlassCard — the core translucent surface (Part B "glass card").
 *
 * Uses --panel + backdrop blur. Per the perf note (Part C), reserve this for
 * hero cards, KPI cards, side panels and modals. For big tables / long lists
 * use <SolidCard> (opaque, cheaper — no blur).
 */
export const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("glass-surface", className)} {...props} />
));
GlassCard.displayName = "GlassCard";
