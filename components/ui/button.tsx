import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary glass CTA: violet → sky gradient, white text.
        default:
          "bg-[linear-gradient(135deg,rgba(124,92,255,0.9),rgba(56,189,248,0.9))] text-white shadow-[0_8px_24px_-8px_rgba(124,92,255,0.6)] hover:brightness-110",
        // Neutral glass button.
        outline:
          "border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-foreground hover:bg-[rgba(255,255,255,0.12)]",
        ghost: "text-foreground hover:bg-[rgba(255,255,255,0.08)]",
        // Destructive glass button.
        danger:
          "bg-[rgba(239,68,68,0.16)] text-[#fecaca] hover:bg-[rgba(239,68,68,0.26)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
