import * as React from "react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 rounded-md border border-input bg-[rgba(255,255,255,0.04)] px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-panel-solid [&>option]:text-foreground",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
