import { EmptyState } from "@/components/cockpit/empty-state";
import { PageHeader } from "@/components/cockpit/page-header";
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
      <PageHeader
        eyebrow="Überwachung"
        title="Keyword-Alerts"
        lead="Eigene Schlüsselwörter definieren und neue Insolvenzbekanntmachungen automatisch überwachen. E-Mail-Benachrichtigung folgt in einer späteren Phase."
      />

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
