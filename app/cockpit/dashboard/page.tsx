import Link from "next/link";
import { Activity, AlertTriangle, Clock, Mail, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/cockpit/metric-card";
import { PageHeader } from "@/components/cockpit/page-header";
import { SectionCard } from "@/components/cockpit/section-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import { StatusBadge } from "@/components/cockpit/status-badge";
import { StatusTag } from "@/components/cockpit/status-tag";
import { AcquisitionLeadsTable } from "@/components/cockpit/acquisition-leads-table";
import { getAcquisitionLeads } from "@/lib/cockpit/acquisition.queries";
import { getInternalWatchlist } from "@/lib/cockpit/watchlist-internal.queries";
import { getSystemHealth } from "@/lib/cockpit/operations.queries";
import { followUpBucket } from "@/lib/cockpit/watchlist";
import { PHASE_LABEL_DE, type PhaseLabel } from "@/lib/cockpit/phase";
import { searchDashboard } from "@/lib/cockpit/dashboard-search.queries";
import { getInsolvencyAdministrators } from "@/lib/cockpit/insolvency-administrators.queries";
import { DashboardSearchPanel } from "@/components/cockpit/dashboard-search-panel";
import { InsolvencyAdminSearch } from "@/components/cockpit/insolvency-admin-search";

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

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const searchFilters = {
    q: str(sp.q),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    phase: str(sp.phase),
    activity: str(sp.activity),
    court: str(sp.court),
    city: str(sp.city),
  };
  const adminQuery = str(sp.admin_q);

  const [leadsResult, internal, systemHealth, search, admins] = await Promise.all([
    getAcquisitionLeads(25),
    getInternalWatchlist(),
    getSystemHealth(),
    searchDashboard(searchFilters),
    getInsolvencyAdministrators(adminQuery),
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
      <PageHeader
        eyebrow="Akquise-Cockpit"
        title="Operative Akquise-Übersicht"
        lead="Neue relevante Fälle, Akquise-Fenster, Verfahrensphasen, Insolvenzverwalter und fällige Follow-ups — auf einen Blick."
      />

      {/* 0. Advanced search */}
      <SectionCard
        title="Suche"
        description="Stichwort + Filter (Datum, Phase, Tätigkeit, Gericht, Ort) über Firmen-Insolvenzfälle. Nur sichere interne Felder; kein Bekanntmachungs-Rohtext."
      >
        <div id="suche" className="space-y-4">
          <DashboardSearchPanel defaults={searchFilters} />

          {!search.available ? (
            <EmptyState
              title="Suche noch nicht verfügbar"
              description="Die interne Such-View (v_cockpit_dashboard_search_internal) ist noch nicht aktiviert."
            />
          ) : !search.active ? (
            <p className="text-sm text-muted-foreground">
              Geben Sie ein Stichwort ein oder setzen Sie Filter, um Fälle zu finden.
            </p>
          ) : search.rows.length === 0 ? (
            <EmptyState
              title="Keine Treffer"
              description="Keine Fälle für diese Suche. Bitte Stichwort/Filter anpassen."
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs tabular-nums text-muted-foreground">
                {search.count !== null
                  ? `${Math.min(search.rows.length, search.limit)} von ${search.count} Treffern`
                  : `${search.rows.length} Treffer`}
              </p>
              <ul className="divide-y divide-border/70 text-sm">
                {search.rows.map((r) => (
                  <li key={r.entity_id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.display_title ?? "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.city, r.bundesland, r.court, r.aktenzeichen]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.has_administrator ? <Badge variant="muted">Verwalter</Badge> : null}
                      <Badge variant="muted">
                        {PHASE_LABEL_DE[(r.latest_phase as PhaseLabel) ?? "unknown"] ?? "—"}
                      </Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(r.latest_publication_date)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

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
            Acquisition Gate öffnen
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
                    {r.display_title ?? r.safe_display_label ?? "—"}
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

      {/* 4b. Insolvenzverwalter-Datenbank */}
      <SectionCard
        title="Insolvenzverwalter-Datenbank"
        description="Interne Sammlung der in Insolvenzbekanntmachungen genannten Insolvenzverwalter (nur strukturierte Kontaktfelder)."
      >
        <div id="verwalter" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs tabular-nums text-muted-foreground">
              {admins.available && admins.total !== null
                ? `Insolvenzverwalter gesamt: ${admins.total.toLocaleString("de-DE")}`
                : "Insolvenzverwalter gesamt: —"}
            </p>
          </div>
          <InsolvencyAdminSearch defaultValue={adminQuery} />

          {!admins.available ? (
            <EmptyState
              title="Verwalter-Datenbank noch nicht verfügbar"
              description="Die interne View (v_cockpit_insolvency_administrators_internal) ist noch nicht aktiviert."
            />
          ) : admins.rows.length === 0 ? (
            <EmptyState
              title="Keine sichtbaren Insolvenzverwalter gefunden."
              description="Noch keine Daten, keine Treffer, oder alle Treffer sind als ungültig markiert."
            />
          ) : (
            <div className="cockpit-scroll overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Kanzlei</th>
                    <th className="py-2 pr-3 font-medium">E-Mail</th>
                    <th className="py-2 pr-3 font-medium">Telefon</th>
                    <th className="py-2 pr-3 font-medium">Ort</th>
                    <th className="py-2 pr-3 font-medium">Qualität</th>
                    <th className="py-2 pr-3 text-right font-medium">Fälle</th>
                    <th className="py-2 text-right font-medium">Zuletzt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {admins.rows.map((a) => (
                    <tr key={a.administrator_id}>
                      <td className="py-2 pr-3 font-medium">{a.display_name ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{a.firm ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {a.email ? (
                          <a href={`mailto:${a.email}`} className="underline underline-offset-2">
                            {a.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {a.phone ? (
                          <a
                            href={`tel:${a.phone.replace(/\s+/g, "")}`}
                            className="underline underline-offset-2"
                          >
                            {a.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {[a.postal_code, a.city].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {a.quality_status ? (
                          <Badge
                            variant={
                              a.quality_status === "valid"
                                ? "green"
                                : a.quality_status === "suspect"
                                  ? "yellow"
                                  : "muted"
                            }
                          >
                            {a.quality_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{a.source_count ?? 0}</td>
                      <td className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {formatDate(a.last_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      {/* 5. Compact system status strip (operations lives on its own page) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel-solid px-4 py-3 text-sm shadow-card">
        <div className="flex items-center gap-2">
          {systemHealth.available && systemHealth.status === "green" ? (
            <StatusTag tone="positive" dot="pulse">
              Live
            </StatusTag>
          ) : (
            <StatusBadge
              status={systemHealth.available ? systemHealth.status : "gray"}
              withDot
            />
          )}
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
