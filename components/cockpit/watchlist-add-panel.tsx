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
import {
  searchCompaniesAction,
  watchCompanyAction,
} from "@/app/cockpit/watchlist/actions";

function registryLine(c: CompanyCandidate): string {
  const parts = [
    c.registry_court,
    [c.registry_type, c.registry_number].filter(Boolean).join(" "),
  ].filter((p) => p && p.length > 0);
  return parts.join(" · ");
}

export function WatchlistAddPanel({
  watchedCompanyIds,
}: {
  watchedCompanyIds: string[];
}) {
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

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Firma zur Watchlist hinzufügen</h2>

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
                    <p className="truncate font-medium">{c.display_name ?? "—"}</p>
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
    </div>
  );
}
