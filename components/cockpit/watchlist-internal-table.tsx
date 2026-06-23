import { Badge } from "@/components/ui/badge";
import { OutreachCreateButton } from "@/components/cockpit/outreach-create-button";
import type { InternalWatchlistRow } from "@/lib/cockpit/watchlist-internal.queries";
import { outreachDraftKey } from "@/lib/cockpit/outreach.queries";

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

function priorityVariant(p: string | null): "red" | "yellow" | "muted" | "green" {
  if (p === "high") return "red";
  if (p === "low") return "yellow";
  if (p === "monitor") return "muted";
  return "muted";
}

const PHASE_LABEL: Record<string, string> = {
  vorlaeufig: "Vorläufig",
  eroeffnung: "Eröffnung",
  berichtstermin: "Berichtstermin",
  pruefungstermin: "Prüfungstermin",
  verwertung: "Verwertung",
  verteilung: "Verteilung",
  schlussverteilung: "Schlussverteilung",
  aufhebung: "Aufhebung",
  einstellung_mangels_masse: "Einstellung (Masse)",
  unknown: "Unbekannt",
};

const HEADERS = [
  "Typ",
  "Fall",
  "Ort",
  "Gericht / Az.",
  "Phase",
  "Verwalter",
  "HR",
  "Finanzdaten",
  "Outreach",
  "Follow-up",
  "Aktion",
];

export function WatchlistInternalTable({
  rows,
  activeDraftKeys = [],
}: {
  rows: InternalWatchlistRow[];
  activeDraftKeys?: string[];
}) {
  const draftKeySet = new Set(activeDraftKeys);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {HEADERS.map((h) => (
              <th key={h} className="py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isNachlass = r.kind === "nachlass";
            const label = isNachlass
              ? (r.safe_display_label ?? "Nachlassverfahren")
              : (r.display_title ?? r.safe_display_label ?? "—");
            const hasExistingDraft = draftKeySet.has(
              outreachDraftKey(r.kind, r.watch_id),
            );
            return (
              <tr
                key={r.watch_id}
                className="border-b border-border/60 align-top last:border-0"
              >
                <td className="py-3 pr-3">
                  <Badge variant="muted">{isNachlass ? "Nachlass" : "Firma"}</Badge>
                </td>
                <td className="py-3 pr-3">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {r.status ?? "—"}
                  </div>
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {[r.city, r.bundesland].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  <div>{r.court ?? "—"}</div>
                  <div className="text-xs">{r.aktenzeichen ?? "—"}</div>
                </td>
                <td className="py-3 pr-3">
                  <Badge variant={priorityVariant(r.phase_priority)}>
                    {PHASE_LABEL[r.latest_phase ?? "unknown"] ?? "Unbekannt"}
                  </Badge>
                  {r.pre_verteilung_relevance ? (
                    <div className="text-xs text-status-green">pre-Verteilung</div>
                  ) : null}
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  <div>{r.administrator_name ?? "—"}</div>
                  {r.administrator_email ? (
                    <div className="text-xs">{r.administrator_email}</div>
                  ) : (
                    <div className="text-xs text-status-yellow">keine E-Mail</div>
                  )}
                  {r.administrator_phone ? (
                    <div className="text-xs">{r.administrator_phone}</div>
                  ) : null}
                </td>
                <td className="py-3 pr-3">
                  <Badge
                    variant={
                      r.handelsregister_verified
                        ? "green"
                        : r.handelsregister_status === "not_applicable"
                          ? "muted"
                          : "yellow"
                    }
                  >
                    {r.handelsregister_status ?? "—"}
                  </Badge>
                </td>
                <td className="py-3 pr-3">
                  <Badge variant="muted">{r.bundesanzeiger_status ?? "—"}</Badge>
                  <div className="text-xs text-muted-foreground">
                    {r.financial_data_status ?? "—"}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <Badge variant={r.outreach_ready ? "green" : "yellow"}>
                    {r.outreach_ready ? "bereit" : "unvollständig"}
                  </Badge>
                  {r.missing_data_flags && r.missing_data_flags.length > 0 ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.missing_data_flags.join(", ")}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 pr-3 text-muted-foreground">
                  {formatDate(r.next_follow_up_at)}
                </td>
                <td className="py-3 pr-3">
                  <OutreachCreateButton
                    kind={r.kind}
                    watchId={r.watch_id}
                    outreachReady={r.outreach_ready}
                    blockedReason={r.outreach_blocked_reason}
                    hasExistingDraft={hasExistingDraft}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
