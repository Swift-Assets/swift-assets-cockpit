import { StatusBadge } from "@/components/cockpit/status-badge";
import { CreateTaskFromContextButton } from "@/components/cockpit/create-task-from-context-button";
import { hasOpenTaskForContext } from "@/lib/cockpit/tasks";
import type { SystemHealthCheck } from "@/lib/cockpit/operations.queries";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

/**
 * Renders a health check's `details` as safe key-value pairs. Defensive: only
 * primitive values (string/number/boolean) are rendered, so nested
 * objects/arrays can never be dumped into the UI.
 */
function DetailsMetrics({
  details,
}: {
  details: Record<string, string | number | boolean | null> | null;
}) {
  if (!details) return null;
  const entries = Object.entries(details).filter(
    ([, v]) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean",
  );
  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <dt className="truncate">{key}</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Dense, fully-visible list of system health checks. Important numbers (message
 * + details metrics) stay visible by default — nothing important is hidden.
 */
export function SystemHealthList({
  checks,
  showTaskAction = false,
  openTaskKeys = [],
}: {
  checks: SystemHealthCheck[];
  /** When true, red/yellow checks show a one-click "create task" button. */
  showTaskAction?: boolean;
  /** Open-task context keys for duplicate detection (from openTaskContextKeys). */
  openTaskKeys?: string[];
}) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Keine Checks vorhanden.</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {checks.map((c) => {
        const actionable = c.status === "red" || c.status === "yellow";
        // data-related checks map to data_quality, others to system_issue.
        const dataGroup =
          c.check_group === "enrichment" ||
          c.check_group === "ingestion" ||
          c.check_group === "retention";
        return (
          <li key={c.check_key} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.title ?? c.check_key}</span>
              <span className="flex shrink-0 items-center gap-2">
                <StatusBadge status={c.status} />
                {showTaskAction && actionable ? (
                  <CreateTaskFromContextButton
                    title={`${dataGroup ? "Datenqualität prüfen" : "System prüfen"}: ${c.title ?? c.check_key}`}
                    description={c.message ?? undefined}
                    taskType={dataGroup ? "data_quality" : "system_issue"}
                    priority={c.status === "red" ? "urgent" : "high"}
                    relatedKind={dataGroup ? "data_quality" : "system"}
                    relatedLabel={c.check_key}
                    sourceView="v_cockpit_system_health"
                    hasExistingTask={hasOpenTaskForContext(openTaskKeys, {
                      taskType: dataGroup ? "data_quality" : "system_issue",
                      relatedKind: dataGroup ? "data_quality" : "system",
                      sourceView: "v_cockpit_system_health",
                      relatedLabel: c.check_key,
                    })}
                  />
                ) : null}
              </span>
            </div>
            {c.message ? (
              <p className="text-sm text-muted-foreground">{c.message}</p>
            ) : null}
            <DetailsMetrics details={c.details} />
            <p className="text-[11px] text-muted-foreground">
              Zuletzt geprüft: {formatDateTime(c.last_checked_at)} · Gruppe:{" "}
              {c.check_group ?? "—"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
