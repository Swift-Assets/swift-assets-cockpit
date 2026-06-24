"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableContainer,
  DataTableHead,
  Td,
  Th,
  Tr,
} from "@/components/cockpit/data-table";
import { EmptyState } from "@/components/cockpit/empty-state";
import { PHASE_LABEL_DE, type PhaseLabel, type PhasePriority } from "@/lib/cockpit/phase";
import { watchCompanyAction } from "@/app/cockpit/watchlist/actions";
import type { AcquisitionLead } from "@/lib/cockpit/acquisition.queries";

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

function priorityVariant(p: PhasePriority): "red" | "yellow" | "muted" {
  if (p === "high") return "red";
  if (p === "low") return "yellow";
  return "muted";
}

function LeadActions({
  lead,
  watched,
}: {
  lead: AcquisitionLead;
  watched: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (watched || added) {
    return (
      <Link
        href="/cockpit/watchlist"
        className="text-xs text-status-green underline underline-offset-2"
      >
        Auf Watchlist · öffnen
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await watchCompanyAction(lead.entity_id, "watching", "", "");
            if (res.ok) setAdded(true);
            else setError(res.error);
          });
        }}
      >
        {pending ? "Wird hinzugefügt…" : "Zur Watchlist hinzufügen"}
      </Button>
      {error ? <span className="text-xs text-status-red">{error}</span> : null}
    </div>
  );
}

export function AcquisitionLeadsTable({
  rows,
  watchedEntityIds,
}: {
  rows: AcquisitionLead[];
  watchedEntityIds: string[];
}) {
  const watched = new Set(watchedEntityIds);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Keine Fälle im aktiven Akquise-Fenster"
        description="Sobald neue Insolvenzbekanntmachungen in einer relevanten Phase (vorläufig bis Verwertung) erfasst werden, erscheinen sie hier."
      />
    );
  }

  return (
    <DataTableContainer>
      <DataTable>
        <DataTableHead>
          <Th>Unternehmen</Th>
          <Th>Gericht / Az.</Th>
          <Th>Phase</Th>
          <Th>Verwalter</Th>
          <Th align="right">Veröffentlicht</Th>
          <Th align="right">Aktion</Th>
        </DataTableHead>
        <tbody>
          {rows.map((lead) => (
            <Tr key={`${lead.entity_id}:${lead.announcement_id ?? ""}`}>
              <Td>
                <div className="font-medium">{lead.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  {lead.city ?? "—"}
                </div>
              </Td>
              <Td>
                <div className="text-muted-foreground">{lead.court ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {lead.case_number ?? "—"}
                </div>
              </Td>
              <Td>
                <Badge variant={priorityVariant(lead.phase_priority)}>
                  {PHASE_LABEL_DE[lead.phase as PhaseLabel] ?? "Unbekannt"}
                </Badge>
              </Td>
              <Td className="text-muted-foreground">
                {lead.insolvency_administrator ?? (
                  <span className="text-status-yellow">unbekannt</span>
                )}
              </Td>
              <Td align="right" className="tabular-nums text-muted-foreground">
                {formatDate(lead.announcement_date)}
              </Td>
              <Td align="right">
                <LeadActions lead={lead} watched={watched.has(lead.entity_id)} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </DataTableContainer>
  );
}
