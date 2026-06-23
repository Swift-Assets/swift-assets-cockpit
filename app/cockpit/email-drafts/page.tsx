import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OutreachDraftCard } from "@/components/cockpit/outreach-draft-card";
import { getOutreachDrafts } from "@/lib/cockpit/outreach.queries";

export const dynamic = "force-dynamic";

/**
 * Editable outreach drafts (CORE PHASE 2). Lists German draft emails to
 * insolvency administrators from v_cockpit_outreach_drafts; edit / mark-ready /
 * archive go through SECURITY DEFINER RPCs (server actions). NO sending, NO
 * SMTP, NO mailto, NO AI, NO external calls.
 */
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
            Anfrage-Entwürfe an Insolvenzverwalter. Bearbeitbar — kein
            automatischer Versand, kein SMTP, keine KI. Entwürfe entstehen aus der
            Watchlist.
          </p>
        </div>
        <Badge variant={result.available ? "green" : "yellow"}>
          {result.available ? "Core 2 · Entwürfe" : "Core 2 · Quelle fehlt"}
        </Badge>
      </div>

      {!result.available ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Noch nicht verbunden. Erwartete Quelle:
              swift_v2.v_cockpit_outreach_drafts.
            </p>
          </CardContent>
        </Card>
      ) : result.rows.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Noch keine Entwürfe vorhanden. Erstellen Sie einen Entwurf über
              „Anfrage erstellen“ in der Watchlist.
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
              active.map((d) => <OutreachDraftCard key={d.draft_id} draft={d} />)
            )}
          </div>

          {archived.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Archiviert ({archived.length})
              </h2>
              {archived.map((d) => (
                <OutreachDraftCard key={d.draft_id} draft={d} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
