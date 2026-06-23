"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WatchlistAcquisitionRow } from "@/components/cockpit/watchlist-acquisition-row";
import type { InternalWatchlistRow } from "@/lib/cockpit/watchlist-internal.queries";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

type TypeFilter = "all" | "company" | "nachlass";
type StatusFilter = "all" | "watching" | "pursuing" | "passed";
type PriorityFilter = "all" | "high" | "low" | "monitor" | "unknown";
type OutreachFilter =
  | "all"
  | "ready"
  | "incomplete"
  | "draft_exists"
  | "no_email"
  | "no_case";
type FollowUpFilter = "all" | "overdue" | "today" | "next7" | "none";
type HrFilter = "all" | "verified" | "missing" | "not_applicable";
type Preset =
  | "none"
  | "top_leads"
  | "outreach_ready"
  | "no_email"
  | "follow_up_due"
  | "nachlass"
  | "data_gaps";
type SortKey =
  | "updated"
  | "followup"
  | "priority"
  | "outreach"
  | "phase"
  | "name";

const DEFAULT_SORT: SortKey = "updated";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "watching", label: "Beobachten" },
  { value: "pursuing", label: "In Prüfung" },
  { value: "passed", label: "Abgelehnt" },
];

const PRIORITY_FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "high", label: "high" },
  { value: "low", label: "low" },
  { value: "monitor", label: "monitor" },
  { value: "unknown", label: "unknown" },
];

const OUTREACH_FILTERS: { value: OutreachFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "ready", label: "bereit" },
  { value: "incomplete", label: "unvollständig" },
  { value: "draft_exists", label: "Entwurf existiert" },
  { value: "no_email", label: "keine E-Mail" },
  { value: "no_case", label: "fehlende Fallreferenz" },
];

const FOLLOWUP_FILTERS: { value: FollowUpFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "overdue", label: "überfällig" },
  { value: "today", label: "heute" },
  { value: "next7", label: "nächste 7 Tage" },
  { value: "none", label: "kein Follow-up" },
];

const HR_FILTERS: { value: HrFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "verified", label: "verified" },
  { value: "missing", label: "missing" },
  { value: "not_applicable", label: "not_applicable" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Zuletzt aktualisiert" },
  { value: "followup", label: "Follow-up zuerst" },
  { value: "priority", label: "Priorität zuerst" },
  { value: "outreach", label: "Outreach bereit zuerst" },
  { value: "phase", label: "Phase / pre-Verteilung zuerst" },
  { value: "name", label: "Name A–Z" },
];

const PRESETS: { value: Preset; label: string }[] = [
  { value: "top_leads", label: "Top Leads" },
  { value: "outreach_ready", label: "Outreach bereit" },
  { value: "no_email", label: "E-Mail fehlt" },
  { value: "follow_up_due", label: "Follow-up fällig" },
  { value: "nachlass", label: "Nachlass" },
  { value: "data_gaps", label: "Datenlücken" },
];

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  low: 1,
  monitor: 2,
  unknown: 3,
};

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type FollowUpBucket = "overdue" | "today" | "next7" | "later" | "none";

function followUpBucket(value: string | null, now: Date): FollowUpBucket {
  if (!value) return "none";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "none";
  const today = startOfDay(now);
  const day = 86_400_000;
  const target = startOfDay(d);
  if (target < today) return "overdue";
  if (target === today) return "today";
  if (target <= today + 7 * day) return "next7";
  return "later";
}

function hasNoEmail(r: InternalWatchlistRow): boolean {
  return (
    r.outreach_blocked_reason === "missing_recipient_email" ||
    (r.missing_data_flags?.includes("no_administrator_email") ?? false)
  );
}

export function WatchlistAcquisitionFilteredTable({
  rows,
  openTaskKeys = [],
  activeDraftKeys = [],
  aiReviewByKey = {},
}: {
  rows: InternalWatchlistRow[];
  openTaskKeys?: string[];
  activeDraftKeys?: string[];
  aiReviewByKey?: Record<string, AiCaseReviewRow>;
}) {
  const draftKeySet = useMemo(() => new Set(activeDraftKeys), [activeDraftKeys]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("all");
  const [hrFilter, setHrFilter] = useState<HrFilter>("all");
  const [preset, setPreset] = useState<Preset>("none");
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);

  const isDefault =
    search.trim() === "" &&
    typeFilter === "all" &&
    statusFilter === "all" &&
    priorityFilter === "all" &&
    outreachFilter === "all" &&
    followUpFilter === "all" &&
    hrFilter === "all" &&
    preset === "none" &&
    sort === DEFAULT_SORT;

  function reset() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setOutreachFilter("all");
    setFollowUpFilter("all");
    setHrFilter("all");
    setPreset("none");
    setSort(DEFAULT_SORT);
  }

  const now = useMemo(() => new Date(), []);

  const visible = useMemo(() => {
    const needle = normalize(search);
    const hasDraft = (r: InternalWatchlistRow) =>
      draftKeySet.has(`${r.kind}:${r.watch_id}`);

    const matchesPreset = (r: InternalWatchlistRow): boolean => {
      switch (preset) {
        case "top_leads":
          return r.pre_verteilung_relevance === true && r.phase_priority === "high";
        case "outreach_ready":
          return r.outreach_ready === true && !hasDraft(r);
        case "no_email":
          return hasNoEmail(r);
        case "follow_up_due": {
          const b = followUpBucket(r.next_follow_up_at, now);
          return b === "overdue" || b === "today";
        }
        case "nachlass":
          return r.kind === "nachlass";
        case "data_gaps":
          return (r.missing_data_flags?.length ?? 0) > 0;
        default:
          return true;
      }
    };

    const filtered = rows.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (statusFilter !== "all" && (r.status ?? "") !== statusFilter) return false;
      if (priorityFilter !== "all" && (r.phase_priority ?? "unknown") !== priorityFilter)
        return false;

      if (outreachFilter !== "all") {
        if (outreachFilter === "ready" && r.outreach_ready !== true) return false;
        if (outreachFilter === "incomplete" && r.outreach_ready !== false) return false;
        if (outreachFilter === "draft_exists" && !hasDraft(r)) return false;
        if (outreachFilter === "no_email" && !hasNoEmail(r)) return false;
        if (
          outreachFilter === "no_case" &&
          r.outreach_blocked_reason !== "missing_case_reference"
        )
          return false;
      }

      if (followUpFilter !== "all") {
        const b = followUpBucket(r.next_follow_up_at, now);
        if (followUpFilter === "overdue" && b !== "overdue") return false;
        if (followUpFilter === "today" && b !== "today") return false;
        if (followUpFilter === "next7" && !(b === "today" || b === "next7"))
          return false;
        if (followUpFilter === "none" && b !== "none") return false;
      }

      if (hrFilter !== "all" && (r.handelsregister_status ?? "") !== hrFilter)
        return false;

      if (!matchesPreset(r)) return false;

      if (needle) {
        const label =
          r.kind === "company"
            ? (r.display_title ?? r.safe_display_label)
            : r.safe_display_label;
        const haystack = [
          label,
          r.court,
          r.aktenzeichen,
          r.city,
          r.bundesland,
          r.administrator_name,
          r.administrator_email,
          r.latest_phase,
          ...(r.missing_data_flags ?? []),
          ...(r.source_quality_flags ?? []),
        ]
          .map(normalize)
          .join(" ");
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });

    const time = (v: string | null) => {
      if (!v) return null;
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? null : t;
    };

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "updated":
          return (time(b.updated_at) ?? 0) - (time(a.updated_at) ?? 0);
        case "followup": {
          const ta = time(a.next_follow_up_at);
          const tb = time(b.next_follow_up_at);
          if (ta === null && tb === null) return 0;
          if (ta === null) return 1;
          if (tb === null) return -1;
          return ta - tb;
        }
        case "priority":
          return (
            (PRIORITY_RANK[a.phase_priority ?? "unknown"] ?? 3) -
            (PRIORITY_RANK[b.phase_priority ?? "unknown"] ?? 3)
          );
        case "outreach":
          return Number(b.outreach_ready ?? false) - Number(a.outreach_ready ?? false);
        case "phase": {
          const pa = a.pre_verteilung_relevance ? 0 : 1;
          const pb = b.pre_verteilung_relevance ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return (
            (PRIORITY_RANK[a.phase_priority ?? "unknown"] ?? 3) -
            (PRIORITY_RANK[b.phase_priority ?? "unknown"] ?? 3)
          );
        }
        case "name": {
          const na = normalize(
            a.kind === "company" ? (a.display_title ?? a.safe_display_label) : a.safe_display_label,
          );
          const nb = normalize(
            b.kind === "company" ? (b.display_title ?? b.safe_display_label) : b.safe_display_label,
          );
          return na.localeCompare(nb, "de");
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [rows, search, typeFilter, statusFilter, priorityFilter, outreachFilter, followUpFilter, hrFilter, preset, sort, now, draftKeySet]);

  // Counts (over filtered set).
  const counts = useMemo(() => {
    let high = 0;
    let ready = 0;
    let noEmail = 0;
    let due = 0;
    for (const r of visible) {
      if (r.phase_priority === "high") high += 1;
      if (r.outreach_ready === true) ready += 1;
      if (hasNoEmail(r)) noEmail += 1;
      const b = followUpBucket(r.next_follow_up_at, now);
      if (b === "overdue" || b === "today") due += 1;
    }
    return { high, ready, noEmail, due };
  }, [visible, now]);

  return (
    <div className="space-y-4">
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={preset === p.value ? "default" : "outline"}
            onClick={() => setPreset((cur) => (cur === p.value ? "none" : p.value))}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs lg:col-span-2">
          <span className="text-muted-foreground">Suchen</span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, Gericht, Az., Verwalter, Phase…"
            aria-label="Suchen"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Typ</span>
          <Select className="w-full" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">Alle</option>
            <option value="company">Firma</option>
            <option value="nachlass">Nachlass</option>
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <Select className="w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            {STATUS_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Priorität</span>
          <Select className="w-full" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}>
            {PRIORITY_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Outreach</span>
          <Select className="w-full" value={outreachFilter} onChange={(e) => setOutreachFilter(e.target.value as OutreachFilter)}>
            {OUTREACH_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Follow-up</span>
          <Select className="w-full" value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value as FollowUpFilter)}>
            {FOLLOWUP_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Handelsregister</span>
          <Select className="w-full" value={hrFilter} onChange={(e) => setHrFilter(e.target.value as HrFilter)}>
            {HR_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Sortierung</span>
          <Select className="w-full" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
      </div>

      {/* Counts + reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {rows.length} Einträge · {visible.length} gefiltert · {counts.high} high ·{" "}
          {counts.ready} outreach-bereit · {counts.noEmail} ohne E-Mail · {counts.due} fällig
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={isDefault}>
          Filter zurücksetzen
        </Button>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Keine Einträge passen zu den aktuellen Filtern.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={reset}>
            Filter zurücksetzen
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {["", "Typ", "Fall", "Ort", "Gericht / Az.", "Phase", "Verwalter", "Outreach", "Status", "Follow-up", "Aktionen"].map(
                  (h, i) => (
                    <th key={i} className="py-2 pr-3 font-medium">{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <WatchlistAcquisitionRow
                  key={row.watch_id}
                  row={row}
                  openTaskKeys={openTaskKeys}
                  activeDraftKeys={activeDraftKeys}
                  aiReview={aiReviewByKey[`${row.kind}:${row.watch_id}`] ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
