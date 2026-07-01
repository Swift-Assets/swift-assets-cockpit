"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Toast — glass notification (Part B). Pinned bottom-inline-start, dark glass
 * background, border colored by type, slide-in animation.
 *
 * Two ways to use:
 *   1. <Toast type="success">…</Toast> as a standalone presentational element.
 *   2. Wrap the tree in <ToastProvider> and call useToast().show(...) to queue
 *      transient toasts (auto-dismiss).
 */
export type ToastType = "success" | "error" | "info";

const TYPE_BORDER: Record<ToastType, string> = {
  success: "border-[rgba(34,197,94,0.6)]",
  error: "border-[rgba(239,68,68,0.6)]",
  info: "border-[rgba(56,189,248,0.6)]",
};

export function Toast({
  type = "info",
  className,
  children,
  onClose,
}: {
  type?: ToastType;
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "animate-toast-in pointer-events-auto flex items-start gap-3 rounded-md border bg-[rgba(17,24,44,0.95)] px-4 py-3 text-sm text-foreground shadow-pop backdrop-blur-[8px]",
        TYPE_BORDER[type],
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

// --- Optional provider / hook -------------------------------------------------

interface ToastItem {
  id: number;
  type: ToastType;
  message: React.ReactNode;
}

interface ToastContextValue {
  show: (message: React.ReactNode, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
  duration = 4000,
}: {
  children: React.ReactNode;
  duration?: number;
}) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback(
    (message: React.ReactNode, type: ToastType = "info") => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => remove(id), duration);
    },
    [duration, remove],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 start-4 z-[90] flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <Toast key={t.id} type={t.type} onClose={() => remove(t.id)}>
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
