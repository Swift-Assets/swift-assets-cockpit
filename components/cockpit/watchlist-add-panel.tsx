"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  STATUS_OPTIONS,
  type CompanyCandidate,
  type WatchStatus,
} from "@/lib/cockpit/watchlist";
import type { NachlassCandidate } from "@/lib/cockpit/nachlass-search.queries";
import {
  searchCompaniesAction,
  searchNachlassAction,
  watchCompanyAction,
  watchNachlassAction,
} from "@/app/cockpit/watchlist/actions";

type Mode = "company" | "nachlass";

const AR_SUMMARY_MISSING = "KI-Zusammenfassung noch nicht verfügbar.";

function registryLine(c: CompanyCandidate): string {
  const parts = [
    c.registry_court,
    [c.registry_type, c.registry_number].filter(Boolean).join(" "),
  ].filter((p) => p && p.length > 0);
  return parts.join(" · ");
}

function fmtDate(value: string | null): string {
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

export function WatchlistAddPanel({
  watchedCompanyIds,
}: {
  watchedCompanyIds: string[];
}) {
  const [mode, setMode] = useState<Mode>("company");

  // Shared add parameters.
  const [status, setStatus] = useState<WatchStatus>("watching");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");

  // Company search state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyCandidate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  // Nachlass search state (internal-only).
  const [nQuery, setNQuery] = useState("");
  const [nResults, setNResults] = useState<NachlassCandidate[] | null>(null);
  const [nAvailable, setNAvailable] = useState(true);
  const [nMessage, setNMessage] = useState<string | null>(null);
  const [nAdded, setNAdded] = useState<Set<string>>(new Set());
  const [nSearching, startNSearch] = useTransition();
  const [nAdding, startNAdd] = useTransition();

  const alreadyWatched = new Set([...watchedCompanyIds, ...added]);

  function runSearch() {
    setMessage(null);
    startSearch(async () => {
      const res = await searchCompaniesAction(query);
      if (!res.ok) {
        setResults([]);
        setMessage(res.error);
      } else {
        setResults(res.rows);
      }
    });
  }

  function addCompany(entityId: string) {
    setMessage(null);
    startAdd(async () => {
      const res = await watchCompanyAction(entityId, status, note, followUp);
      if (!res.ok) {
        setMessage(res.error);
      } else {
        setAdded((prev) => new Set(prev).add(entityId));
      }
    });
  }

  function runNachlassSearch() {
    setNMessage(null);
    startNSearch(async () => {
      const res = await searchNachlassAction(nQuery);
      if (!res.ok) {
        setNResults([]);
        setNMessage(res.error);
        return;
      }
      setNAvailable(res.available);
      setNResults(res.rows);
    });
  }

  function addNachlass(detectionId: string) {
    setNMessage(null);
    startNAdd(async () => {
      const res = await watchNachlassAction(detectionId, status, note, followUp);
      if (!res.ok) {
        setNMessage(res.error);
      } else {
        setNAdded((prev) => new Set(prev).add(detectionId));
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Zur Watchlist hinzufügen</h2>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={mode === "company" ? "default" : "outline"}
            onClick={() => setMode("company")}
          >
            Firma
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "nachlass" ? "default" : "outline"}
            onClick={() => setMode("nachlass")}
          >
            Nachlass
          </Button>
        </div>
      </div>

      {/* Shared add parameters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <Select
            className="w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as WatchStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Notiz</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optionale interne Notiz…"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Follow-up</span>
          <Input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </label>
      </div>

      {mode === "company" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder="Firmenname oder Registernummer…"
              aria-label="Firmensuche"
            />
            <Button
              type="button"
              onClick={runSearch}
              disabled={searching || query.trim().length < 2}
            >
              {searching ? "Suche…" : "Suche"}
            </Button>
          </div>

          {message ? <p className="text-sm text-status-red">{message}</p> : null}

          {results !== null && results.length === 0 && !message ? (
            <p className="text-sm text-muted-foreground">Keine Treffer</p>
          ) : null}

          {results && results.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {results.map((c) => {
                const watched = alreadyWatched.has(c.entity_id);
                const reg = registryLine(c);
                return (
                  <li
                    key={c.entity_id}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {c.display_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                        {reg ? ` · ${reg}` : ""}
                      </p>
                    </div>
                    {watched ? (
                      <Badge variant="muted">Bereits in Watchlist</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={adding}
                        onClick={() => addCompany(c.entity_id)}
                      >
                        Hinzufügen
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Internal-only notice */}
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Interne Recherche — keine öffentliche Detailseite. Nur für berechtigte
            Cockpit-Nutzer (nachlass_authorized).
          </p>

          <div className="flex gap-2">
            <Input
              value={nQuery}
              onChange={(e) => setNQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runNachlassSearch();
              }}
              placeholder="Name, Gericht oder Aktenzeichen… (leer = alle Kandidaten)"
              aria-label="Nachlass-Suche"
            />
            <Button type="button" onClick={runNachlassSearch} disabled={nSearching}>
              {nSearching ? "Suche…" : "Suche"}
            </Button>
          </div>

          {nMessage ? <p className="text-sm text-status-red">{nMessage}</p> : null}

          {nResults !== null && !nAvailable ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Nachlass-Suche ist noch nicht freigeschaltet (interne View
              v_cockpit_nachlass_search_internal nicht verfügbar oder keine
              Nachlass-Berechtigung).
            </p>
          ) : null}

          {nResults !== null && nAvailable && nResults.length === 0 && !nMessage ? (
            <p className="text-sm text-muted-foreground">Keine Treffer</p>
          ) : null}

          {nResults && nAvailable && nResults.length > 0 ? (
            <ul className="space-y-3">
              {nResults.map((r) => {
                const watched = nAdded.has(r.detection_id);
                const meta = [
                  r.court,
                  r.aktenzeichen,
                  fmtDate(r.announcement_date),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={r.detection_id}
                    className="space-y-2 rounded-md border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">Nachlass</Badge>
                          {typeof r.signal_score === "number" ? (
                            <Badge variant="muted">
                              Signal {r.signal_score}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 truncate font-medium">
                          {r.display_title ?? "Nachlassverfahren"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {meta || "—"}
                        </p>
                      </div>
                      {watched ? (
                        <Badge variant="muted">In Watchlist</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={nAdding}
                          onClick={() => addNachlass(r.detection_id)}
                        >
                          Hinzufügen
                        </Button>
                      )}
                    </div>

                    {/* Cached Arabic AI summary (backend-generated; read-only). */}
                    <div className="rounded-md bg-muted/40 p-2.5">
                      <p className="eyebrow mb-1">KI-Zusammenfassung (AR)</p>
                      <p
                        dir="rtl"
                        className="text-[13px] leading-relaxed text-foreground"
                      >
                        {r.summary_ar?.trim() ? r.summary_ar : AR_SUMMARY_MISSING}
                      </p>
                      {r.estate_asset_categories &&
                      r.estate_asset_categories.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.estate_asset_categories.map((cat) => (
                            <Badge key={cat} variant="outline">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
