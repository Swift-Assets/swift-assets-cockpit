"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PHASE_LABEL_DE, type PhaseLabel } from "@/lib/cockpit/phase";

const PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle Phasen" },
  ...(
    [
      "vorlaeufig",
      "eroeffnung",
      "berichtstermin",
      "pruefungstermin",
      "verwertung",
      "verteilung",
      "schlussverteilung",
      "aufhebung",
      "einstellung_mangels_masse",
      "restschuldbefreiung",
      "verguetungsfestsetzung",
      "unknown",
    ] as PhaseLabel[]
  ).map((p) => ({ value: p, label: PHASE_LABEL_DE[p] })),
];

export interface DashboardSearchDefaults {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  phase?: string;
  activity?: string;
  court?: string;
  city?: string;
}

/**
 * Dashboard advanced-search form. Server-driven: submitting navigates to
 * /cockpit/dashboard with the filters as query params; the page reads them and
 * runs the (RLS-gated, internal) search. No client-side data access.
 */
export function DashboardSearchPanel({ defaults }: { defaults: DashboardSearchDefaults }) {
  const router = useRouter();
  const [q, setQ] = useState(defaults.q ?? "");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(defaults.dateTo ?? "");
  const [phase, setPhase] = useState(defaults.phase ?? "all");
  const [activity, setActivity] = useState(defaults.activity ?? "");
  const [court, setCourt] = useState(defaults.court ?? "");
  const [city, setCity] = useState(defaults.city ?? "");

  function submit() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (phase && phase !== "all") params.set("phase", phase);
    if (activity.trim()) params.set("activity", activity.trim());
    if (court.trim()) params.set("court", court.trim());
    if (city.trim()) params.set("city", city.trim());
    const qs = params.toString();
    router.push(qs ? `/cockpit/dashboard?${qs}#suche` : "/cockpit/dashboard#suche");
  }

  function reset() {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setPhase("all");
    setActivity("");
    setCourt("");
    setCity("");
    router.push("/cockpit/dashboard#suche");
  }

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Firma, Aktenzeichen, Gericht, Ort, Tätigkeit oder Insolvenzverwalter suchen…"
        aria-label="Suche"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Von</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Bis</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Phase / Status</span>
          <Select className="w-full" value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Tätigkeit / Branche</span>
          <Input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="z.B. Bau, Pflege, Gastronomie, Immobilien…"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Gericht</span>
          <Input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Amtsgericht…" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Ort</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stadt…" />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={submit}>
          Suchen
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Zurücksetzen
        </Button>
      </div>
    </div>
  );
}
