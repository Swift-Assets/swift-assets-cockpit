import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/cockpit/dashboard-card";
import { StatusBadge, type TrafficStatus } from "@/components/cockpit/status-badge";
import { SystemHealthList } from "@/components/cockpit/system-health-list";
import { getDashboardData } from "@/lib/cockpit/dashboard.queries";
import {
  getOperationsData,
  getSystemHealth,
  isSafeGithubRunUrl,
} from "@/lib/cockpit/operations.queries";

export const dynamic = "force-dynamic";

/**
 * Cockpit command center (Phase 6C).
 *
 * Information-dense, read-only overview combining every safe source already in
 * use: system health (v_cockpit_system_health), operations
 * (v_daily_run_log, v_cockpit_enrichment_jobs), watchlist/leads
 * (v_cockpit_my_watchlist, v_cockpit_companies, v_cockpit_review_inbox) and data
 * coverage (v_public_insolvency_statistics). Missing sources render explicit
 * placeholders naming the future safe view. No PII, no writes, no secrets.
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

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export default async function DashboardPage() {
  const [{ watchlist, companyActivity, reviewQueue, coverage }, systemHealth, ops] =
    await Promise.all([
      getDashboardData(),
      getSystemHealth(),
      getOperationsData(),
    ]);

  const watchlistStatus: TrafficStatus = !watchlist.available
    ? "gray"
    : watchlist.overdue > 0
      ? "yellow"
      : "green";

  const redCount = systemHealth.checks.filter((c) => c.status === "red").length;
  const yellowCount = systemHealth.checks.filter(
    (c) => c.status === "yellow",
  ).length;

  // Operator attention items (informational only).
  const attention: { label: string; status: TrafficStatus }[] = [];
  for (const c of systemHealth.checks) {
    if (c.status === "red" || c.status === "yellow") {
      attention.push({
        label: `${c.title ?? c.check_key}: ${c.message ?? c.status}`,
        status: c.status,
      });
    }
  }
  if (ops.ingestion.available && ops.ingestion.status !== "green") {
    attention.push({
      label: `Daten-Ingestion: letzter Lauf ${formatDate(ops.ingestion.runDate)} (${ops.ingestion.runStatus ?? "—"})`,
      status: ops.ingestion.status,
    });
  }
  if (ops.enrichment.available && ops.enrichment.failed > 0) {
    attention.push({
      label: `Enrichment Dead-Letter: ${ops.enrichment.failed}`,
      status: "yellow",
    });
  }
  if (watchlist.available && watchlist.overdue > 0) {
    attention.push({
      label: `Überfällige Follow-ups: ${watchlist.overdue}`,
      status: "yellow",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Interne Gesamtübersicht des Swift-Assets-Projekts — System, Pipeline,
            Akquise und Datenabdeckung auf einen Blick.
          </p>
        </div>
        <Badge variant="green">Phase 6C</Badge>
      </div>

      {/* A. Top summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <SummaryCard
          title="System"
          status={systemHealth.available ? systemHealth.status : "gray"}
          value={
            systemHealth.available ? `${systemHealth.checks.length} Checks` : "—"
          }
          hint={
            systemHealth.available
              ? `${redCount} rot · ${yellowCount} gelb`
              : "Keine Quelle"
          }
        />
        <SummaryCard
          title="Ingestion"
          status={ops.ingestion.available ? ops.ingestion.status : "gray"}
          value={ops.ingestion.available ? formatDate(ops.ingestion.runDate) : "—"}
          hint={ops.ingestion.available ? (ops.ingestion.runStatus ?? "—") : "—"}
        />
        <SummaryCard
          title="Enrichment"
          status={ops.enrichment.available ? ops.enrichment.status : "gray"}
          value={ops.enrichment.available ? ops.enrichment.total : "—"}
          hint={
            ops.enrichment.available
              ? `${ops.enrichment.failed} dead-letter`
              : "—"
          }
        />
        <SummaryCard
          title="Watchlist / Leads"
          status={watchlistStatus}
          value={watchlist.available ? watchlist.total : "—"}
          hint={
            watchlist.available ? `${watchlist.overdue} überfällig` : "Keine Quelle"
          }
        />
        <SummaryCard
          title="Public Portal"
          status="gray"
          value="—"
          hint="Noch nicht verbunden"
        />
        <SummaryCard
          title="Privacy Guard"
          status="gray"
          value="—"
          hint="Noch nicht verbunden"
        />
      </div>

      {/* F. Operator next actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Was braucht Aufmerksamkeit?</CardTitle>
          <CardDescription>
            Informativ — keine automatischen Aktionen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="text-sm text-status-green">
              Aktuell keine offenen Warnungen aus verbundenen Quellen.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {attention.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">{a.label}</span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Public Portal Health und Privacy Guard sind noch nicht verbunden
            (separate, freizugebende Quellen).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* B. System Health panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              System Health
              <StatusBadge
                status={systemHealth.available ? systemHealth.status : "gray"}
              />
            </CardTitle>
            <CardDescription>
              Quelle: v_cockpit_system_health.{" "}
              <Link href="/cockpit/operations" className="underline">
                Operations öffnen
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemHealth.available ? (
              <SystemHealthList checks={systemHealth.checks} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch nicht verbunden. Erwartete Quelle: v_cockpit_system_health
                (Migration 0024 + run_data_health_check()).
              </p>
            )}
          </CardContent>
        </Card>

        {/* C. Pipeline / Operations snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline / Operations</CardTitle>
            <CardDescription>
              Quellen: v_daily_run_log, v_cockpit_enrichment_jobs.{" "}
              <Link href="/cockpit/operations" className="underline">
                Operations öffnen
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Metric
                label="Letzter Lauf"
                value={ops.ingestion.available ? formatDate(ops.ingestion.runDate) : "—"}
              />
              <Metric
                label="Lauf-Status"
                value={ops.ingestion.runStatus ?? "—"}
              />
              <Metric
                label="S1 neu"
                value={ops.ingestion.s1Inserted ?? "—"}
              />
              <Metric
                label="S1 Fehler"
                value={ops.ingestion.s1Failed ?? "—"}
                emphasize={(ops.ingestion.s1Failed ?? 0) > 0}
              />
              <Metric
                label="S2 angereichert"
                value={ops.ingestion.s2Enriched ?? "—"}
              />
              <Metric
                label="S2 Fehler"
                value={ops.ingestion.s2Failed ?? "—"}
                emphasize={(ops.ingestion.s2Failed ?? 0) > 0}
              />
              <Metric label="Jobs offen" value={ops.enrichment.pending} />
              <Metric label="Jobs laufend" value={ops.enrichment.running} />
              <Metric label="Jobs erledigt" value={ops.enrichment.succeeded} />
              <Metric
                label="Jobs Dead-Letter"
                value={ops.enrichment.failed}
                emphasize={ops.enrichment.failed > 0}
              />
            </dl>

            <div>
              <p className="mb-1 font-medium">Letzte Läufe</p>
              {ops.recentEvents.available && ops.recentEvents.rows.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Datum</th>
                      <th className="py-1 pr-3 font-medium">Status</th>
                      <th className="py-1 pr-3 font-medium">Dauer</th>
                      <th className="py-1 font-medium">Quelle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.recentEvents.rows.map((r) => (
                      <tr
                        key={r.run_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-1 pr-3">{formatDate(r.run_date)}</td>
                        <td className="py-1 pr-3">{r.status ?? "—"}</td>
                        <td className="py-1 pr-3 text-muted-foreground">
                          {formatDuration(r.duration_seconds)}
                        </td>
                        <td className="py-1">
                          {isSafeGithubRunUrl(r.triggered_by_run_url) ? (
                            <a
                              href={r.triggered_by_run_url as string}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline"
                            >
                              Run öffnen
                            </a>
                          ) : (
                            <span className="text-muted-foreground">
                              {r.triggered_by ?? "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-muted-foreground">Keine Läufe vorhanden.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* D. Watchlist / Acquisition snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              Watchlist / Akquise
              <StatusBadge status={watchlistStatus} />
            </CardTitle>
            <CardDescription>
              Quellen: v_cockpit_my_watchlist, v_cockpit_companies,
              v_cockpit_review_inbox.{" "}
              <Link href="/cockpit/watchlist" className="underline">
                Watchlist öffnen
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {watchlist.available ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Metric label="Gesamt" value={watchlist.total} />
                <Metric label="Firmen" value={watchlist.companies} />
                <Metric label="Nachlass" value={watchlist.nachlass} />
                <Metric
                  label="Überfällig"
                  value={watchlist.overdue}
                  emphasize={watchlist.overdue > 0}
                />
                <Metric label="Heute fällig" value={watchlist.today} />
                <Metric label="Beobachten" value={watchlist.watching} />
                <Metric label="In Prüfung" value={watchlist.pursuing} />
                <Metric label="Abgelehnt" value={watchlist.passed} />
                <Metric
                  label="Neue Firmen heute"
                  value={
                    companyActivity.available ? (companyActivity.today ?? 0) : "—"
                  }
                />
                <Metric
                  label="Neue Firmen 24h"
                  value={
                    companyActivity.available
                      ? (companyActivity.last24h ?? 0)
                      : "—"
                  }
                />
                <Metric
                  label="Review-Inbox"
                  value={reviewQueue.available ? (reviewQueue.value ?? 0) : "—"}
                />
              </dl>
            ) : (
              <p className="text-muted-foreground">
                Noch nicht verbunden. Erwartete Quelle: v_cockpit_my_watchlist.
              </p>
            )}
          </CardContent>
        </Card>

        {/* E. Data coverage / source quality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Datenabdeckung / Quellenqualität
            </CardTitle>
            <CardDescription>
              Quellen: v_public_insolvency_statistics (firmenbezogen),
              v_cockpit_companies, v_cockpit_enrichment_jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {coverage.available ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <Metric
                    label="Firmen (Cockpit)"
                    value={coverage.companiesTotal ?? "—"}
                  />
                  <Metric
                    label="Enrichment-Jobs"
                    value={coverage.enrichmentJobsTotal ?? "—"}
                  />
                  <Metric
                    label="Firmen-Insolvenzen"
                    value={coverage.totalCompanyInsolvencies ?? "—"}
                  />
                  <Metric
                    label="HR-Verifizierung"
                    value={
                      coverage.handelsregisterVerificationRate !== null
                        ? `${coverage.handelsregisterVerificationRate}%`
                        : "—"
                    }
                  />
                </dl>

                {coverage.byPhase.length > 0 ? (
                  <div>
                    <p className="mb-1 font-medium">Nach Phase</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                      {coverage.byPhase.map((p) => (
                        <Metric key={p.label} label={p.label} value={p.count} />
                      ))}
                    </dl>
                  </div>
                ) : null}

                {coverage.topBundeslaender.length > 0 ? (
                  <div>
                    <p className="mb-1 font-medium">Top-Bundesländer</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                      {coverage.topBundeslaender.map((b) => (
                        <Metric key={b.label} label={b.label} value={b.count} />
                      ))}
                    </dl>
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Stand: {formatDateTime(coverage.generatedAt)}. Erweiterte
                  Abdeckung (Ankündigungen, Handelsregister-, Bundesanzeiger-Quote)
                  folgt über eine geplante sichere View
                  „swift_v2.v_cockpit_data_coverage_summary“.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Noch nicht verbunden. Geplante sichere View:
                „swift_v2.v_cockpit_data_coverage_summary“.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Placeholders for not-yet-connected modules (explicitly named) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Public Portal Health"
          status="gray"
          value="—"
          description="Noch nicht verbunden — benötigt sichere Quelle (cockpit_portal_health_runs, Phase 6B.2B)."
        />
        <DashboardCard
          title="Privacy Guard"
          status="gray"
          value="—"
          description="Noch nicht verbunden — benötigt sichere Quelle (cockpit_portal_privacy_findings, Phase 6B.2C)."
        />
        <DashboardCard
          title="Aufgaben / Tasks"
          status="gray"
          value="—"
          description="Noch nicht verbunden — benötigt cockpit_tasks (zukünftige Migration)."
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  status,
  value,
  hint,
}: {
  title: string;
  status: TrafficStatus;
  value: number | string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{title}</span>
          <StatusBadge status={status} />
        </div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
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
