import { cn } from "@/lib/utils";

/**
 * GradientProgress — gradient fill progress bar (Part B).
 *
 * Track: translucent white; fill: violet → sky → green gradient with a soft
 * glow, animated width. `value` is clamped to 0–100.
 */
export function GradientProgress({
  value,
  className,
  label,
  showValue = false,
}: {
  value: number;
  className?: string;
  /** Accessible label for the progress bar. */
  label?: string;
  /** Render the percentage next to the bar. */
  showValue?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-4 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full shadow-glow transition-[width] duration-[400ms] ease-out"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--accent), var(--accent-3), var(--accent-2))",
          }}
        />
      </div>
      {showValue ? (
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {pct}%
        </span>
      ) : null}
    </div>
  );
}
