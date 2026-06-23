"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WatchlistRow } from "@/components/cockpit/watchlist-row";
import {
  SORT_OPTIONS,
  STATUS_OPTIONS,
  compareWatchlistRows,
  followUpBucket,
  normalizedText,
  type FollowUpBucket,
  type WatchKind,
  type WatchStatus,
  type WatchlistRow as Row,
  type WatchlistSortKey,
} from "@/lib/cockpit/watchlist";

const HEADERS = [
  "Typ",
  "Name / Fall",
  "Ort / Bundesland",
  "Status",
  "Notiz",
  "Follow-up",
  "Letztes Update",
  "Aktionen",
];

type TypeFilter = "all" | WatchKind;
type StatusFilter = "all" | WatchStatus;
type FollowUpFilter = "all" | "overdue" | "today" | "this_week" | "none";

const DEFAULT_SORT: WatchlistSortKey = "updated_desc";

const FOLLOW_UP_FILTERS: { value: FollowUpFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "overdue", label: "Überfällig" },
  { value: "today", label: "Heute" },
  { value: "this_week", label: "Diese Woche" },
  { value: "none", label: "Ohne Follow-up" },
];

/** Whether a row's follow-up bucket matches the selected follow-up filter. */
function matchesFollowUp(bucket: FollowUpBucket, filter: FollowUpFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return bucket === "overdue";
    case "today":
      return bucket === "today";
    case "this_week":
      return bucket === "this_week";
    case "none":
      return bucket === "none";
    default:
      return true;
  }
}

export function WatchlistFilteredTable({
  rows,
  openTaskKeys = [],
}: {
  rows: Row[];
  openTaskKeys?: string[];
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<WatchlistSortKey>(DEFAULT_SORT);

  const isDefault =
    typeFilter === "all" &&
    statusFilter === "all" &&
    followUpFilter === "all" &&
    search.trim() === "" &&
    sort === DEFAULT_SORT;

  const visible = useMemo(() => {
    const now = new Date();
    const needle = normalizedText(search);

    const filtered = rows.filter((row) => {
      if (typeFilter !== "all" && row.kind !== typeFilter) return false;
      if (statusFilter !== "all" && (row.status ?? "") !== statusFilter)
        return false;
      if (
        followUpFilter !== "all" &&
        !matchesFollowUp(followUpBucket(row.next_follow_up_at, now), followUpFilter)
      )
        return false;
      if (needle) {
        const haystack = [row.title, row.city, row.bundesland, row.note]
          .map(normalizedText)
          .join(" ");
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => compareWatchlistRows(a, b, sort));
  }, [rows, typeFilter, statusFilter, followUpFilter, search, sort]);

  function reset() {
    setTypeFilter("all");
    setStatusFilter("all");
    setFollowUpFilter("all");
    setSearch("");
    setSort(DEFAULT_SORT);
  }

  return (
    <div className="space-y-4">
      {/* Filter / sort bar */}
      <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Filter</span>
          <span className="text-xs text-muted-foreground">
            Treffer: {visible.length} / {rows.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Typ</span>
            <Select
              className="w-full"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">Alle</option>
              <option value="company">Firmen</option>
              <option value="nachlass">Nachlass</option>
            </Select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Status</span>
            <Select
              className="w-full"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Alle</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Follow-up</span>
            <Select
              className="w-full"
              value={followUpFilter}
              onChange={(e) =>
                setFollowUpFilter(e.target.value as FollowUpFilter)
              }
            >
              {FOLLOW_UP_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Suche</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, Ort, Notiz…"
              aria-label="Suche"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Sortierung</span>
            <Select
              className="w-full"
              value={sort}
              onChange={(e) => setSort(e.target.value as WatchlistSortKey)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            disabled={isDefault}
          >
            Zurücksetzen
          </Button>
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Einträge passend zu den Filtern
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {HEADERS.map((h) => (
                  <th key={h} className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <WatchlistRow
                  key={row.watch_id}
                  row={row}
                  openTaskKeys={openTaskKeys}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
