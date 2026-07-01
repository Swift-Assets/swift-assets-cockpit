import { Activity, Clock, Mail, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/cockpit/metric-card";
import { PageHeader } from "@/components/cockpit/page-header";
import { SectionCard } from "@/components/cockpit/section-card";
import { StatusTag } from "@/components/cockpit/status-tag";
import { GradientProgress } from "@/components/cockpit/gradient-progress";
import { Spinner } from "@/components/cockpit/loader";
import { Toast } from "@/components/cockpit/toast";
import {
  DataTable,
  DataTableContainer,
  DataTableHead,
  Td,
  Th,
  Tr,
} from "@/components/cockpit/data-table";

/**
 * TEMPORARY glass-theme preview (no Supabase, no auth) — mirrors the dashboard
 * layout with mock data so the look can be reviewed without live data. Safe to
 * delete; not linked from nav.
 */
export const dynamic = "force-static";

const ROWS = [
  { name: "Müller GmbH", city: "München", phase: "Eröffnet", date: "12.06.2026", tone: "positive" as const },
  { name: "Nordwind AG", city: "Hamburg", phase: "Vorläufig", date: "10.06.2026", tone: "warning" as const },
  { name: "Schäfer & Co. KG", city: "Köln", phase: "Verwertung", date: "08.06.2026", tone: "danger" as const },
  { name: "Bergmann Handels GmbH", city: "Stuttgart", phase: "Eröffnet", date: "05.06.2026", tone: "neutral" as const },
];

export default function ThemePreviewPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-6 p-6 lg:p-10">
      <PageHeader
        eyebrow="Vorschau · Glass Theme"
        title="Operative Akquise-Übersicht"
        lead="Mock-Daten zur Design-Abnahme. Neue relevante Fälle, Akquise-Fenster, Verfahrensphasen und fällige Follow-ups — auf einen Blick."
        action={<Button>Neuer Lead</Button>}
      />

      {/* KPI row — glass cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Neue relevante Fälle" value={42} hint="Akquise-Fenster" icon={<Sparkles className="h-4 w-4" />} />
        <MetricCard label="Hohe Priorität" value={7} hint="frühe Phase" icon={<Activity className="h-4 w-4" />} />
        <MetricCard label="Follow-up fällig" value={3} hint="heute / überfällig" status="yellow" icon={<Clock className="h-4 w-4" />} />
        <MetricCard label="Verwalter vorhanden" value={18} hint="Kontakt für Outreach" icon={<Mail className="h-4 w-4" />} />
        <MetricCard label="Ignoriert / inaktiv" value={5} hint="Status „passed“" icon={<XCircle className="h-4 w-4" />} />
      </div>

      {/* Search + buttons */}
      <SectionCard title="Suche" description="Stichwort + Filter über Firmen-Insolvenzfälle.">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Stichwort, Gericht, Ort …" className="max-w-xs" />
          <Button variant="outline">Filter</Button>
          <Button>Suchen</Button>
          <Button variant="danger">Zurücksetzen</Button>
        </div>
      </SectionCard>

      {/* Table on solid surface */}
      <SectionCard
        title="Top Akquise-Leads"
        description="Aktuelle Firmen-Insolvenzen im Akquise-Fenster."
        action={<StatusTag tone="positive" dot="pulse">Live</StatusTag>}
      >
        <DataTableContainer>
          <DataTable>
            <DataTableHead>
              <Th>Firma</Th>
              <Th>Ort</Th>
              <Th>Phase</Th>
              <Th align="right">Bekanntmachung</Th>
            </DataTableHead>
            <tbody>
              {ROWS.map((r) => (
                <Tr key={r.name}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-muted-foreground">{r.city}</Td>
                  <Td><StatusTag tone={r.tone}>{r.phase}</StatusTag></Td>
                  <Td align="right" className="tabular-nums text-muted-foreground">{r.date}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DataTableContainer>
      </SectionCard>

      {/* Progress + badges + spinner + toast */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Datenqualität" description="Beispiel für GradientProgress.">
          <div className="space-y-4">
            <GradientProgress value={78} label="Verwalter-Kontakte" showValue />
            <GradientProgress value={42} label="Vollständigkeit" showValue />
            <GradientProgress value={95} label="Zustellbarkeit" showValue />
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="green">valid</Badge>
              <Badge variant="yellow">suspect</Badge>
              <Badge variant="red">kritisch</Badge>
              <Badge variant="blue">neu</Badge>
              <Badge variant="muted">Verwalter</Badge>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Zustände" description="Loader, Toasts, Live-Indikator.">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Spinner size={28} />
              <span className="text-sm text-muted-foreground">Wird geladen …</span>
            </div>
            <Toast type="success">Entwurf gespeichert.</Toast>
            <Toast type="error">Verbindung fehlgeschlagen.</Toast>
            <Toast type="info">3 neue Fälle im Akquise-Fenster.</Toast>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
