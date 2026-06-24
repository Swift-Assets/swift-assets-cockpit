import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Thin wrapper over Button that adds a leading icon and a pending/loading
 * label. Purely presentational — wire onClick/disabled from the caller. Keeps
 * action affordances visually consistent across the cockpit.
 */
export function ActionButton({
  children,
  icon,
  pending = false,
  pendingLabel,
  className,
  disabled,
  ...props
}: ButtonProps & {
  icon?: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <Button
      className={cn(className)}
      disabled={disabled || pending}
      {...props}
    >
      {icon && !pending ? <span className="-ml-0.5">{icon}</span> : null}
      {pending ? (pendingLabel ?? "Wird ausgeführt…") : children}
    </Button>
  );
}
