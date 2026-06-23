import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/cockpit/dashboard-card";
import { getOperationsData } from "@/lib/cockpit/operations.queries";

export const dynamic = "force-dynamic";

/**
 * Read-only Operations Center MVP (Phase 6B).
 *
 * Live cards are sourced only from existing safe, RLS-gated views
 * (v_cockpit_enrichment_jobs, v_daily_run_log) and read aggregates/timestamps
 * only — no company names, error payloads, or PII. Modules without a safe data
 * source render an explicit placeholder. No writes, no secrets.
 */
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

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export default async function OperationsPage() {
  const { enrichment, ingestion, recentEvents, github } =
    await getOperationsData();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground">
            Betriebsübersicht. Live-Status aus sicheren Views; weitere Module
            folgen, sobald Datenquellen vorhanden sind.
          </p>
        </div>
        <Badge variant="green">Phase 6B · MVP</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Data Ingestion — live (v_daily_run_log) */}
        <DashboardCard
          title="Daten-Ingestion"
          status={ingestion.status}
          value={ingestion.available ? formatDate(ingestion.runDate) : "—"}
          description={
            ingestion.available
              ? "Letzter Pipeline-Lauf aus v_daily_run_log."
              : "Noch nicht verbunden."
          }
        >
          {ingestion.available && ingestion.runDate ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Metric label="Status" value={ingestion.runStatus ?? "—"} />
              <Metric label="Dauer" value={formatDuration(ingestion.durationSeconds)} />
              <Metric label="S1 neu" value={ingestion.s1Inserted ?? 0} />
              <Metric
                label="S1 Fehler"
                value={ingestion.s1Failed ?? 0}
                emphasize={(ingestion.s1Failed ?? 0) > 0}
              />
              <Metric label="S2 angereichert" value={ingestion.s2Enriched ?? 0} />
              <Metric
                label="S2 Fehler"
                value={ingestion.s2Failed ?? 0}
                emphasize={(ingestion.s2Failed ?? 0) > 0}
              />
            </dl>
          ) : null}
        </DashboardCard>

        {/* 2. AI / Enrichment Jobs — live (v_cockpit_enrichment_jobs) */}
        <DashboardCard
          title="AI / Enrichment Jobs"
          status={enrichment.status}
          value={enrichment.available ? enrichment.total : "—"}
          description={
            enrichment.available
              ? "Job-Warteschlange (Aggregat aus v_cockpit_enrichment_jobs)."
              : "Noch nicht verbunden."
          }
        >
          {enrichment.available ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Metric label="Offen" value={enrichment.pending} />
              <Metric label="Laufend" value={enrichment.running} />
              <Metric label="Erledigt" value={enrichment.succeeded} />
              <Metric
                label="Fehlgeschlagen"
                value={enrichment.failed}
                emphasize={enrichment.failed > 0}
              />
            </dl>
          ) : null}
        </DashboardCard>

        {/* 3. Recent operations events — live (v_daily_run_log) */}
        <DashboardCard
          title="Letzte Läufe"
          status={recentEvents.available ? "green" : "gray"}
          description={
            recentEvents.available
              ? "Jüngste Pipeline-Läufe aus v_daily_run_log."
              : "Noch nicht verbunden."
          }
        >
          {recentEvents.available && recentEvents.rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Datum</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 font-medium">Dauer</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.rows.map((r) => (
                  <tr
                    key={r.run_id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-1.5 pr-3">{formatDate(r.run_date)}</td>
                    <td className="py-1.5 pr-3">{r.status ?? "—"}</td>
                    <td className="py-1.5 text-muted-foreground">
                      {formatDuration(r.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : recentEvents.available ? (
            <p className="text-sm text-muted-foreground">Keine Läufe vorhanden.</p>
          ) : null}
        </DashboardCard>

        {/* 4. GitHub Actions — live if a safe run URL exists */}
        <DashboardCard
          title="GitHub Actions"
          status={github.available ? github.status : "gray"}
          description={
            github.available
              ? "Letzter Workflow-Lauf aus v_daily_run_log."
              : "Noch nicht verbunden."
          }
        >
          {github.available ? (
            <div className="space-y-2 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Metric
                  label="Letzter Workflow-Lauf"
                  value={formatDate(github.runDate)}
                />
                <Metric label="Auslöser" value={github.triggeredBy ?? "—"} />
                <Metric label="Status" value={github.runStatus ?? "—"} />
              </dl>
              {github.runUrl ? (
                <a
                  href={github.runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
                >
                  GitHub Run öffnen
                </a>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        {/* 5–7. Placeholders — no safe source yet */}
        <DashboardCard
          title="Datenbank / Supabase"
          status="gray"
          value="—"
          description="Noch keine sichere Operations-View vorhanden."
        />
        <DashboardCard
          title="Public Portal Health"
          status="gray"
          value="—"
          description="Noch nicht verbunden (Quelle fehlt)."
        />
        <DashboardCard
          title="Privacy Guard"
          status="gray"
          value="—"
          description="Noch nicht verbunden (Quelle fehlt)."
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasize
            ? "font-semibold tabular-nums text-status-red"
            : "font-medium tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
