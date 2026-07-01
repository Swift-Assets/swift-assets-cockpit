"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionCard } from "@/components/cockpit/section-card";
import { EmptyState } from "@/components/cockpit/empty-state";
import {
  DataTable,
  DataTableContainer,
  DataTableHead,
  Td,
  Th,
  Tr,
} from "@/components/cockpit/data-table";
import {
  createKeywordAlertRuleAction,
  deleteKeywordAlertRuleAction,
  dismissKeywordAlertMatchAction,
  scanKeywordAlertsAction,
  updateKeywordAlertRuleAction,
} from "@/app/cockpit/keyword-alerts/actions";
import type {
  KeywordAlertMatch,
  KeywordAlertRule,
} from "@/lib/cockpit/keyword-alerts.queries";

const MODE_LABEL: Record<string, string> = {
  any: "Mind. eines",
  all: "Alle",
  phrase: "Wortgruppe",
};

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

export function KeywordAlertManager({
  rules,
  matches,
}: {
  rules: KeywordAlertRule[];
  matches: KeywordAlertMatch[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // create form state
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [mode, setMode] = useState("any");
  const [emailEnabled, setEmailEnabled] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: () => void) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Fehlgeschlagen.");
      else ok?.();
    });
  }

  return (
    <div className="space-y-6">
      {/* Create rule */}
      <SectionCard
        title="Neue Alert-Regel"
        description="Definieren Sie Schlüsselwörter. Treffer gegen neue Insolvenzbekanntmachungen werden gesammelt (sichere Felder: Firmenname, Gericht, Aktenzeichen, Verwalter). E-Mail-Versand folgt in einer späteren Phase."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Maschinenbau NRW"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Schlüsselwörter (Komma-getrennt)</label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="GmbH, Düsseldorf, Maschinen"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Modus</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="any">Mind. eines</option>
              <option value="all">Alle</option>
              <option value="phrase">Wortgruppe</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-[rgba(255,255,255,0.04)] accent-[color:var(--accent)]"
              />
              E-Mail aktivieren (Versand folgt)
            </label>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  createKeywordAlertRuleAction(
                    name,
                    keywords.split(","),
                    mode,
                    emailEnabled,
                  ),
                () => {
                  setName("");
                  setKeywords("");
                  setMode("any");
                  setEmailEnabled(false);
                  setInfo("Regel erstellt.");
                },
              )
            }
          >
            {pending ? "Wird gespeichert…" : "Regel erstellen"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                async () => {
                  const res = await scanKeywordAlertsAction();
                  if (res.ok) setInfo(`${res.count} neue Treffer.`);
                  return res;
                },
              )
            }
          >
            Jetzt scannen
          </Button>
          {info ? <span className="text-xs text-status-green">{info}</span> : null}
          {error ? <span className="text-xs text-status-red">{error}</span> : null}
        </div>
      </SectionCard>

      {/* Rules list */}
      <SectionCard
        title="Alert-Regeln"
        description="Ihre definierten Regeln. Deaktivieren pausiert das Sammeln von Treffern."
      >
        {rules.length === 0 ? (
          <EmptyState
            title="Noch keine Alert-Regeln"
            description="Erstellen Sie oben eine Regel, um relevante neue Insolvenzfälle automatisch zu erfassen."
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {rules.map((r) => (
              <li key={r.rule_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name ?? "—"}</span>
                    <Badge variant={r.is_active ? "green" : "muted"}>
                      {r.is_active ? "aktiv" : "inaktiv"}
                    </Badge>
                    <Badge variant="muted">{MODE_LABEL[r.match_mode ?? "any"]}</Badge>
                    {r.email_enabled ? <Badge variant="blue">E-Mail</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(r.keywords ?? []).map((k) => (
                      <Badge key={k} variant="outline">
                        {k}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.match_count ?? 0} Treffer
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        updateKeywordAlertRuleAction({
                          ruleId: r.rule_id,
                          isActive: !r.is_active,
                        }),
                      )
                    }
                  >
                    {r.is_active ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (
                        typeof window !== "undefined" &&
                        !window.confirm(`Regel „${r.name ?? ""}“ löschen?`)
                      )
                        return;
                      run(() => deleteKeywordAlertRuleAction(r.rule_id));
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Matches */}
      <SectionCard
        title="Aktuelle Treffer"
        description="Gesammelte Übereinstimmungen. Status: neu / in Warteschlange / gesendet / verworfen. Kein automatischer Versand in dieser Phase."
      >
        {matches.length === 0 ? (
          <EmptyState
            title="Noch keine Treffer"
            description="Treffer erscheinen hier, sobald neue Bekanntmachungen zu Ihren Regeln passen (oder nach „Jetzt scannen“)."
          />
        ) : (
          <DataTableContainer>
            <DataTable>
              <DataTableHead>
                <Th>Unternehmen</Th>
                <Th>Gericht / Az.</Th>
                <Th>Schlüsselwörter</Th>
                <Th align="right">Datum</Th>
                <Th align="right">Status</Th>
                <Th align="right">Aktion</Th>
              </DataTableHead>
              <tbody>
                {matches.map((m) => (
                  <Tr key={m.match_id}>
                    <Td>
                      <div className="font-medium">{m.company_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.administrator_name ?? "—"}
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">
                      <div>{m.court ?? "—"}</div>
                      <div className="text-xs">{m.case_number ?? "—"}</div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(m.matched_keywords ?? []).map((k) => (
                          <Badge key={k} variant="yellow">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatDate(m.announcement_date)}
                    </Td>
                    <Td align="right">
                      <Badge variant={m.status === "dismissed" ? "muted" : "blue"}>
                        {m.status ?? "new"}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {m.status !== "dismissed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => run(() => dismissKeywordAlertMatchAction(m.match_id))}
                        >
                          Verwerfen
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </DataTableContainer>
        )}
      </SectionCard>
    </div>
  );
}
