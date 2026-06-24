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
        muted: "border-transparent bg-muted text-muted-foreground",
        // Traffic-light + accent statuses used across cockpit modules.
        green: "border-status-green/20 bg-status-green/10 text-status-green",
        yellow: "border-status-yellow/20 bg-status-yellow/10 text-status-yellow",
        red: "border-status-red/20 bg-status-red/10 text-status-red",
        blue: "border-status-blue/20 bg-status-blue/10 text-status-blue",
        gray: "border-status-gray/20 bg-status-gray/10 text-status-gray",
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
