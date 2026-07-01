import { cn } from "@/lib/utils";

/**
 * Spinner — sky-top / violet-right ring (Part B loader). Sizes in px.
 */
export function Spinner({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Wird geladen"
      className={cn("inline-block animate-[spin_0.8s_linear_infinite] rounded-full", className)}
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 10)),
        borderStyle: "solid",
        borderColor: "transparent",
        borderTopColor: "var(--accent-3)",
        borderRightColor: "var(--accent)",
      }}
    />
  );
}

/**
 * Loader — full-screen dimmed + blurred overlay with a centered spinner
 * (Part B loader overlay). Presentational; render conditionally by the caller.
 */
export function Loader({ label }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[rgba(11,16,32,0.78)] backdrop-blur-[6px]"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size={40} />
      {label ? (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
