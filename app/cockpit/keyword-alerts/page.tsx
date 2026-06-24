import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/cockpit/empty-state";
import { KeywordAlertManager } from "@/components/cockpit/keyword-alert-manager";
import {
  getKeywordAlertMatches,
  getKeywordAlertRules,
} from "@/lib/cockpit/keyword-alerts.queries";

export const dynamic = "force-dynamic";

/**
 * Keyword Alerts (Phase 7A foundation). Define keyword rules and collect
 * matches against new company insolvency announcements. Matching uses safe
 * fields only; no email is sent in this phase (queue only). Fail-safe: if the
 * backend (migration 0033) is not yet applied, a clear placeholder is shown.
 */
export default async function KeywordAlertsPage() {
  const [rules, matches] = await Promise.all([
    getKeywordAlertRules(),
    getKeywordAlertMatches(),
  ]);

  const backendReady = rules.available || matches.available;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Keyword-Alerts</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Eigene Schlüsselwörter definieren und neue Insolvenzbekanntmachungen
            automatisch überwachen. E-Mail-Benachrichtigung folgt in einer
            späteren Phase.
          </p>
        </div>
        <Badge variant="green">Phase 7A · Alerts</Badge>
      </div>

      {backendReady ? (
        <KeywordAlertManager rules={rules.rows} matches={matches.rows} />
      ) : (
        <EmptyState
          title="Keyword-Alerts noch nicht aktiviert"
          description="Das Backend für Keyword-Alerts (Migration 0033) ist noch nicht angewendet. Sobald es freigegeben und angewendet wurde, können hier Regeln erstellt und Treffer verwaltet werden."
        />
      )}
    </div>
  );
}
