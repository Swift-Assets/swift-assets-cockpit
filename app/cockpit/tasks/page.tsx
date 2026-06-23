import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyTasks, summarizeTasks, type TaskRow } from "@/lib/cockpit/tasks.queries";

export const dynamic = "force-dynamic";

/**
 * Read-only internal tasks page (Phase 6E). Active tasks first
 * (open/in_progress/waiting), then done/archived. Writes are deferred — the
 * lifecycle RPCs exist in migration 0026 for a later mutation UI.
 */
const ACTIVE = new Set(["open", "in_progress", "waiting"]);

function priorityVariant(p: string | null): "red" | "yellow" | "muted" {
  if (p === "urgent") return "red";
  if (p === "high") return "yellow";
  return "muted";
}

function dueVariant(b: string | null): "red" | "yellow" | "muted" {
  if (b === "overdue") return "red";
  if (b === "today" || b === "tomorrow") return "yellow";
  return "muted";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

const DUE_LABEL: Record<string, string> = {
  overdue: "Überfällig",
  today: "Heute",
  tomorrow: "Morgen",
  upcoming: "Geplant",
  no_due_date: "Kein Datum",
};

function TaskTable({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Aufgabe</th>
            <th className="py-2 pr-4 font-medium">Typ</th>
            <th className="py-2 pr-4 font-medium">Priorität</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Fällig</th>
            <th className="py-2 pr-4 font-medium">Zugewiesen</th>
            <th className="py-2 pr-4 font-medium">Bezug</th>
            <th className="py-2 pr-4 font-medium">Aktualisiert</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.task_id}
              className="border-b border-border/60 align-top last:border-0"
            >
              <td className="py-2 pr-4">
                <div className="font-medium">{t.title ?? "—"}</div>
                {t.description ? (
                  <div className="max-w-[22rem] text-xs text-muted-foreground">
                    {t.description}
                  </div>
                ) : null}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">{t.task_type ?? "—"}</td>
              <td className="py-2 pr-4">
                <Badge variant={priorityVariant(t.priority)}>
                  {t.priority ?? "—"}
                </Badge>
              </td>
              <td className="py-2 pr-4">{t.status ?? "—"}</td>
              <td className="py-2 pr-4">
                <Badge variant={dueVariant(t.due_bucket)}>
                  {DUE_LABEL[t.due_bucket ?? "no_due_date"] ?? "—"}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {formatDate(t.due_at)}
                </div>
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {t.assigned_to_name ?? t.assigned_to_email ?? "—"}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {t.related_kind
                  ? `${t.related_kind}${t.related_label ? `: ${t.related_label}` : ""}`
                  : "—"}
              </td>
              <td className="py-2 pr-4 text-muted-foreground">
                {formatDate(t.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TasksPage() {
  const result = await getMyTasks();
  const summary = summarizeTasks(result);

  const active = result.rows.filter((t) => ACTIVE.has(t.status ?? ""));
  const closed = result.rows.filter((t) => !ACTIVE.has(t.status ?? ""));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">
            Interne Aufgaben & Follow-ups. Read-only (Bearbeitung folgt über
            gesicherte RPCs).
          </p>
        </div>
        <Badge variant={result.available ? "green" : "yellow"}>
          {result.available ? "Phase 6E · aktiv" : "Phase 6E · Quelle fehlt"}
        </Badge>
      </div>

      {!result.available ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Noch nicht verbunden. Erwartete Quelle: swift_v2.v_cockpit_my_tasks
              (Migration 0026 — repo-only, noch nicht angewendet).
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Offen gesamt" value={summary.openTotal} />
            <MiniStat label="Überfällig" value={summary.overdue} emphasize={summary.overdue > 0} />
            <MiniStat label="Heute fällig" value={summary.dueToday} />
            <MiniStat label="Hoch / Dringend" value={summary.highOrUrgent} emphasize={summary.highOrUrgent > 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aktive Aufgaben</CardTitle>
              <CardDescription>
                Offen, in Bearbeitung und wartend.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine aktiven Aufgaben.
                </p>
              ) : (
                <TaskTable rows={active} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Erledigt / Archiviert</CardTitle>
            </CardHeader>
            <CardContent>
              {closed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine erledigten oder archivierten Aufgaben.
                </p>
              ) : (
                <TaskTable rows={closed} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={
            emphasize
              ? "text-xl font-semibold tabular-nums text-status-red"
              : "text-xl font-semibold tabular-nums"
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
