import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Minimal subset of swift_v2.v_cockpit_my_watchlist rendered in this first PR.
 * The view is RLS-gated to the current user and returns ONLY their own watched
 * items. To stay within the approved scope, this page intentionally renders
 * only non-sensitive columns and performs NO writes. Nachlass detail fields
 * (estate summary, asset categories, score) are deliberately not shown yet.
 */
interface WatchRow {
  kind: string | null;
  watch_id: string;
  title: string | null;
  city: string | null;
  bundesland: string | null;
  status: string | null;
  next_follow_up_at: string | null;
  updated_at: string | null;
}

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

export default async function WatchlistPage() {
  let rows: WatchRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_my_watchlist")
      .select(
        "kind, watch_id, title, city, bundesland, status, next_follow_up_at, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      loadError = error.message;
    } else {
      rows = (data ?? []) as WatchRow[];
    }
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Watchlist konnte nicht geladen werden.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Interne Akquisitions-Watchlist (Firmen & Nachlass). Read-only in
            diesem PR — Aktionen und Anreicherung folgen.
          </p>
        </div>
        <Badge variant="yellow">Phase 5A · read-only</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meine Watchlist</CardTitle>
          <CardDescription>
            Quelle: swift_v2.v_cockpit_my_watchlist (RLS-geschützt, nur eigene
            Einträge).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-sm text-status-yellow">
              Watchlist konnte nicht geladen werden: {loadError}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge in Ihrer Watchlist.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Typ</th>
                    <th className="py-2 pr-4 font-medium">Name / Fall</th>
                    <th className="py-2 pr-4 font-medium">Ort / Bundesland</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Follow-up</th>
                    <th className="py-2 pr-4 font-medium">Letztes Update</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.watch_id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2 pr-4">
                        <Badge variant="muted">
                          {row.kind === "nachlass" ? "Nachlass" : "Firma"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {row.title ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {[row.city, row.bundesland].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="py-2 pr-4">{row.status ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDate(row.next_follow_up_at)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDate(row.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
