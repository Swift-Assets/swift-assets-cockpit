import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Themed native checkbox for the glass system: translucent field, violet accent
 * (via CSS accent-color), sky focus ring. Renders a real <input type="checkbox">
 * so labels/forms/keyboard behavior are native.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "h-4 w-4 shrink-0 cursor-pointer rounded border border-input bg-[rgba(255,255,255,0.04)] accent-[color:var(--accent)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
