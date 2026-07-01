import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * StatusTag — soft tinted pill (Part B "status / priority tags").
 *
 * Distinct background/text per tone, tuned for the dark glass surface:
 *   positive/done  green   · high/danger red · medium/warn yellow · low/neutral gray
 * Optional pulsing dot for live/connected indicators.
 */
const statusTagVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        positive:
          "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.16)] text-[#bbf7d0]",
        danger:
          "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.14)] text-[#fecaca]",
        warning:
          "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.14)] text-[#fde68a]",
        neutral:
          "border-[rgba(100,116,139,0.35)] bg-[rgba(100,116,139,0.18)] text-[#cbd5e1]",
        info:
          "border-[rgba(56,189,248,0.3)] bg-[rgba(56,189,248,0.14)] text-[#bae6fd]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

const DOT_COLOR: Record<string, string> = {
  positive: "bg-accent-2",
  danger: "bg-danger",
  warning: "bg-warning",
  neutral: "bg-low",
  info: "bg-accent-3",
};

export interface StatusTagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusTagVariants> {
  /** Show a leading dot. Pass "pulse" for the animated live indicator. */
  dot?: boolean | "pulse";
}

export function StatusTag({
  className,
  tone,
  dot,
  children,
  ...props
}: StatusTagProps) {
  const toneKey = tone ?? "neutral";
  return (
    <span className={cn(statusTagVariants({ tone }), className)} {...props}>
      {dot ? (
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            DOT_COLOR[toneKey],
            dot === "pulse" && "animate-pulse-dot",
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

export { statusTagVariants };
