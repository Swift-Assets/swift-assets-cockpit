import Link from "next/link";
import { Activity, AlertTriangle, Clock, Mail, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/cockpit/metric-card";
import { SectionCard } from "@/components/cockpit/section-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import { StatusBadge } from "@/components/cockpit/status-badge";
import { AcquisitionLeadsTable } from "@/components/cockpit/acquisition-leads-table";
import { getAcquisitionLeads } from "@/lib/cockpit/acquisition.queries";
import { getInternalWatchlist } from "@/lib/cockpit/watchlist-internal.queries";
import { getSystemHealth } from "@/lib/cockpit/operations.queries";
import { followUpBucket } from "@/lib/cockpit/watchlist";
import { PHASE_LABEL_DE, type PhaseLabel } from "@/lib/cockpit/phase";

export const dynamic = "force-dynamic";

/**
 * Acquisition Command Center (Phase 7A).
 *
 * Operationally focused on insolvency acquisition leads — NOT backend/scraper
 * internals (those live on /cockpit/operations). Reads only safe, authenticated
 * cockpit views; no raw announcement text, raw_json, source_snapshot, or PII.
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

export default async function DashboardPage() {
  const [leadsResult, internal, systemHealth] = await Promise.all([
    getAcquisitionLeads(25),
    getInternalWatchlist(),
    getSystemHealth(),
  ]);

  const companyRows = internal.available
    ? internal.rows.filter((r) => r.kind === "company")
    : [];
  const watchedEntityIds = companyRows
    .map((r) => r.subject_id)
    .filter((id): id is string => Boolean(id));
  const watchedSet = new Set(watchedEntityIds);

  const now = new Date();
  const followUpDue = internal.available
    ? internal.rows.filter((r) => {
        const b = followUpBucket(r.next_follow_up_at, now);
        return b === "overdue" || b === "today";
      })
    : [];

  // Overview KPIs (acquisition-centric).
  const newLeads = leadsResult.rows.filter((l) => !watchedSet.has(l.entity_id)).length;
  const highPriority = companyRows.filter((r) => r.phase_priority === "high").length;
  const withContact = companyRows.filter(
    (r) => r.administrator_email || r.outreach_ready,
  ).length;
  const ignored = companyRows.filter((r) => r.status === "passed").length;

  const recentNew = leadsResult.rows.filter((l) => !watchedSet.has(l.entity_id)).slice(0, 8);

  const healthRed = systemHealth.available
    ? systemHealth.checks.filter((c) => c.status === "red").length
    : 0;
  const healthYellow = systemHealth.available
    ? systemHealth.checks.filter((c) => c.status === "yellow").length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Akquise-Cockpit
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Operative Übersicht der Insolvenz-Akquise: neue relevante Fälle,
            Akquise-Fenster, Phasen, Verwalter und fällige Follow-ups.
          </p>
        </div>
        <Badge variant="green">Phase 7A · Akquise</Badge>
      </div>

      {/* 1. Acquisition window overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Neue relevante Fälle"
          value={leadsResult.available ? newLeads : "—"}
          hint="Akquise-Fenster, noch nicht beobachtet"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          label="Hohe Priorität"
          value={internal.available ? highPriority : "—"}
          hint="frühe Verfahrensphase"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Follow-up fällig"
          value={internal.available ? followUpDue.length : "—"}
          hint="heute oder überfällig"
          status={followUpDue.length > 0 ? "yellow" : "green"}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Verwalter vorhanden"
          value={internal.available ? withContact : "—"}
          hint="Kontakt für Outreach"
          icon={<Mail className="h-4 w-4" />}
        />
        <MetricCard
          label="Ignoriert / inaktiv"
          value={internal.available ? ignored : "—"}
          hint="Status „passed“"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {/* 2. Top acquisition leads */}
      <SectionCard
        title="Top Akquise-Leads"
        description="Aktuelle Firmen-Insolvenzen im Akquise-Fenster (vorläufig bis Verwertung). Quelle: v_cockpit_company_announcements (sichere Felder)."
        action={
          <Link
            href="/cockpit/watchlist"
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            Watchlist öffnen
          </Link>
        }
      >
        {leadsResult.available ? (
          <AcquisitionLeadsTable
            rows={leadsResult.rows}
            watchedEntityIds={watchedEntityIds}
          />
        ) : (
          <EmptyState
            title="Lead-Quelle nicht verfügbar"
            description="Die sichere Lead-Ansicht (v_cockpit_company_announcements) ist derzeit nicht erreichbar."
          />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 3. Follow-up due */}
        <SectionCard
          title="Follow-up fällig"
          description="Watchlist-Einträge mit fälligem oder überfälligem Wiedervorlage-Datum."
        >
          {followUpDue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine fälligen Follow-ups. 👍
            </p>
          ) : (
            <ul className="divide-y divide-border/70 text-sm">
              {followUpDue.slice(0, 8).map((r) => (
                <li key={`${r.kind}:${r.watch_id}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {r.kind === "nachlass"
                      ? (r.safe_display_label ?? "Nachlassverfahren")
                      : (r.display_title ?? r.safe_display_label ?? "—")}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDate(r.next_follow_up_at)}
                    </span>
                    <StatusBadge
                      status={
                        followUpBucket(r.next_follow_up_at, now) === "overdue"
                          ? "red"
                          : "yellow"
                      }
                      label={
                        followUpBucket(r.next_follow_up_at, now) === "overdue"
                          ? "überfällig"
                          : "heute"
                      }
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 4. Recently added / newly relevant */}
        <SectionCard
          title="Zuletzt erfasst · noch nicht beobachtet"
          description="Neueste Firmen-Leads im Akquise-Fenster, die noch nicht auf Ihrer Watchlist stehen."
        >
          {recentNew.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine neuen, unbeobachteten Fälle.
            </p>
          ) : (
            <ul className="divide-y divide-border/70 text-sm">
              {recentNew.map((l) => (
                <li key={`${l.entity_id}:${l.announcement_id ?? ""}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.company_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[l.city, l.court].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="muted">
                      {PHASE_LABEL_DE[l.phase as PhaseLabel] ?? "—"}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDate(l.announcement_date)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 5. Compact system status strip (operations lives on its own page) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-card">
        <div className="flex items-center gap-2">
          <StatusBadge
            status={systemHealth.available ? systemHealth.status : "gray"}
            withDot
          />
          <span className="text-muted-foreground">
            {systemHealth.available
              ? `System: ${systemHealth.checks.length} Checks · ${healthRed} rot · ${healthYellow} gelb`
              : "Systemstatus nicht verbunden"}
          </span>
        </div>
        <Link
          href="/cockpit/operations"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          Operations / Systemdetails öffnen
        </Link>
      </div>
    </div>
  );
}
