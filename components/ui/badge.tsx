import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border text-foreground",
        muted:
          "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-muted-foreground",
        // Soft tinted glass pills — distinct light text per tone.
        green:
          "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.16)] text-[#bbf7d0]",
        yellow:
          "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.14)] text-[#fde68a]",
        red: "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.14)] text-[#fecaca]",
        blue: "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.14)] text-[#bae6fd]",
        gray: "border-[rgba(100,116,139,0.35)] bg-[rgba(100,116,139,0.18)] text-[#cbd5e1]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
