import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOutreachDrafts, type OutreachDraft } from "@/lib/cockpit/outreach.queries";

export const dynamic = "force-dynamic";

/**
 * Read-only outreach drafts (CORE PHASE 1). Lists German draft emails to
 * insolvency administrators from v_cockpit_outreach_drafts. NO sending, NO SMTP,
 * NO AI. Draft creation/editing/archiving (RPCs from migration 0028) and the
 * watchlist "create draft" button are deferred to a later phase.
 */
function statusVariant(s: string | null): "green" | "yellow" | "muted" {
  if (s === "ready") return "green";
  if (s === "draft") return "yellow";
  return "muted";
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

function DraftCard({ d }: { d: OutreachDraft }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="min-w-0">{d.subject ?? "—"}</span>
          <Badge variant={statusVariant(d.status)}>{d.status ?? "—"}</Badge>
        </CardTitle>
        <CardDescription>
          {d.watch_kind === "nachlass" ? "Nachlass" : "Firma"} ·{" "}
          {d.recipient_name ?? "Kein Empfängername"} ·{" "}
          {d.recipient_email ?? "keine E-Mail"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <details className="text-sm">
          <summary className="cursor-pointer select-none text-muted-foreground">
            Entwurfstext anzeigen
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-sm">
            {d.body ?? "—"}
          </pre>
        </details>
        <p className="text-xs text-muted-foreground">
          Erstellt von {d.created_by_name ?? "—"} · {formatDateTime(d.created_at)} ·
          aktualisiert {formatDateTime(d.updated_at)} · {d.event_count ?? 0} Ereignisse
        </p>
      </CardContent>
    </Card>
  );
}

export default async function EmailDraftsPage() {
  const result = await getOutreachDrafts();
  const active = result.rows.filter((d) => d.status !== "archived");
  const archived = result.rows.filter((d) => d.status === "archived");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">E-Mail-Entwürfe</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Anfrage-Entwürfe an Insolvenzverwalter. Read-only — kein automatischer
            Versand, kein SMTP, keine KI. Erstellung & Bearbeitung folgen.
          </p>
        </div>
        <Badge variant={result.available ? "green" : "yellow"}>
          {result.available ? "Core 1 · Entwürfe" : "Core 1 · Quelle fehlt"}
        </Badge>
      </div>

      {!result.available ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Noch nicht verbunden. Erwartete Quelle:
              swift_v2.v_cockpit_outreach_drafts (Migration 0028 — repo-only, noch
              nicht angewendet).
            </p>
          </CardContent>
        </Card>
      ) : result.rows.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Noch keine Entwürfe vorhanden. Entwürfe werden später aus der
              Watchlist erstellt.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Aktive Entwürfe ({active.length})
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine aktiven Entwürfe.</p>
            ) : (
              active.map((d) => <DraftCard key={d.draft_id} d={d} />)
            )}
          </div>

          {archived.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Archiviert ({archived.length})
              </h2>
              {archived.map((d) => (
                <DraftCard key={d.draft_id} d={d} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
