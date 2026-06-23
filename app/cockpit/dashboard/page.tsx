import { Badge } from "@/components/ui/badge";
import { DashboardCard } from "@/components/cockpit/dashboard-card";
import { getDashboardData } from "@/lib/cockpit/dashboard.queries";

export const dynamic = "force-dynamic";

/**
 * Read-only dashboard MVP (Phase 6A).
 *
 * Live cards are sourced only from existing safe, RLS-gated views (watchlist,
 * company activity, review inbox). Modules without a safe data source yet render
 * a "Noch nicht verbunden" placeholder rather than inventing values. No PII, no
 * writes, no secrets.
 */
export default async function DashboardPage() {
  const { watchlist, companyActivity, reviewQueue } = await getDashboardData();

  const watchlistStatus = !watchlist.available
    ? "gray"
    : watchlist.overdue > 0
      ? "yellow"
      : "green";

  const reviewStatus = !reviewQueue.available
    ? "gray"
    : (reviewQueue.value ?? 0) > 0
      ? "yellow"
      : "green";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Interne Übersicht. Live-Kennzahlen aus sicheren Views; weitere Module
            folgen, sobald Datenquellen vorhanden sind.
          </p>
        </div>
        <Badge variant="green">Phase 6A · MVP</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Watchlist — live */}
        <DashboardCard
          title="Watchlist"
          status={watchlistStatus}
          value={watchlist.available ? watchlist.total : "—"}
          description={
            watchlist.available
              ? "Einträge in Ihrer persönlichen Watchlist."
              : "Quelle nicht verfügbar."
          }
        >
          {watchlist.available ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
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
            </dl>
          ) : null}
        </DashboardCard>

        {/* 2. Company activity — live */}
        <DashboardCard
          title="Firmen-Aktivität"
          status={companyActivity.available ? "green" : "gray"}
          value={companyActivity.available ? (companyActivity.today ?? 0) : "—"}
          description={
            companyActivity.available
              ? "Neu erfasste Firmen (heute) aus v_cockpit_companies."
              : "Noch nicht verbunden."
          }
        >
          {companyActivity.available ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Metric label="Neu heute" value={companyActivity.today ?? 0} />
              <Metric label="Neu (24h)" value={companyActivity.last24h ?? 0} />
            </dl>
          ) : null}
        </DashboardCard>

        {/* 3. Review queue — live */}
        <DashboardCard
          title="Review-Inbox"
          status={reviewStatus}
          value={reviewQueue.available ? (reviewQueue.value ?? 0) : "—"}
          description={
            reviewQueue.available
              ? "Vorgänge in der Veröffentlichungs-Review-Inbox."
              : "Noch nicht verbunden."
          }
        />

        {/* 4–8. Placeholders — no safe source yet */}
        <DashboardCard
          title="Aufgaben"
          status="gray"
          value="—"
          description="Noch nicht verbunden (cockpit_tasks fehlt)."
        />
        <DashboardCard
          title="System-Status"
          status="gray"
          value="—"
          description="Noch nicht verbunden (System-Health-Quelle fehlt)."
        />
        <DashboardCard
          title="Portal Guard"
          status="gray"
          value="—"
          description="Noch nicht verbunden (Privacy-Scan-Quelle fehlt)."
        />
        <DashboardCard
          title="GitHub Actions"
          status="gray"
          value="—"
          description="Noch nicht verbunden (Workflow-Monitoring fehlt)."
        />
        <DashboardCard
          title="E-Mail-Entwürfe"
          status="gray"
          value="—"
          description="Noch nicht verbunden (cockpit_email_drafts fehlt)."
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
  value: number;
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
