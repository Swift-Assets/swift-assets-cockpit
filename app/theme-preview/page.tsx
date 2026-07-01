import { Activity, Clock, Mail, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AcquisitionCaseCard,
  type CaseCardData,
} from "@/components/cockpit/acquisition-case-card";

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

// Realistic LONG Arabic business-activity summary (Firmengegenstand) to prove
// the card grows, wraps, and renders RTL locally without clipping.
const LONG_ACTIVITY_AR =
  "تتمثل أنشطة الشركة في تطوير وتصنيع وتوزيع الحلول التقنية والبرمجية المتقدمة، إضافةً إلى تقديم خدمات الاستشارات الهندسية وإدارة المشاريع الصناعية، واستيراد وتصدير المعدات الكهربائية والإلكترونية، وصيانة الأنظمة والشبكات الصناعية، كما تشمل الاستثمار العقاري وإدارة الممتلكات وتقديم خدمات اللوجستيات والنقل والتخزين داخل ألمانيا وخارجها، مع ممارسة جميع الأعمال التجارية والمالية ذات الصلة بغرض الشركة.";

const TEST_CASE: CaseCardData = {
  key: "preview-long-ar",
  kind: "company",
  source: "lead",
  entityId: "preview-entity",
  watchId: null,
  detectionId: null,
  subjectId: null,
  title: "Rheintal Industrie- und Handelsgesellschaft mbH",
  city: "Düsseldorf",
  bundesland: "Nordrhein-Westfalen",
  court: "Amtsgericht Düsseldorf",
  aktenzeichen: "502 IN 1234/26",
  latestPhase: "eroeffnet",
  latestAnnouncementType: "Eröffnungsbeschluss",
  phasePriority: "high",
  preVerteilung: true,
  latestPublicationDate: "2026-06-12",
  administratorName: "Dr. jur. Katharina Vollmer",
  administratorEmail: "kanzlei@vollmer-insolvenz.de",
  administratorPhone: "+49 211 1234567",
  administratorAddress: "Königsallee 1, 40212 Düsseldorf",
  handelsregisterStatus: "vorhanden",
  bundesanzeigerStatus: null,
  financialDataStatus: "teilweise",
  missingDataFlags: [],
  sourceQualityFlags: [],
  status: "neu",
  companyActivityAr: LONG_ACTIVITY_AR,
  companyActivitySource: "aggregator",
  companyActivityConfidence: "high",
  timeline: [],
  hasDraft: false,
};

const SHORT_CASE: CaseCardData = {
  ...TEST_CASE,
  key: "preview-short-ar",
  title: "Nordwind Solar GmbH",
  city: "Hamburg",
  bundesland: "Hamburg",
  phasePriority: "low",
  preVerteilung: false,
  companyActivityAr: "تجارة وتركيب الألواح الشمسية.",
};

// Coverage is partial (~41%): this card has NO activity → quiet placeholder.
const NULL_CASE: CaseCardData = {
  ...TEST_CASE,
  key: "preview-null-ar",
  title: "Alpenland Logistik GmbH",
  city: "Augsburg",
  bundesland: "Bayern",
  phasePriority: "medium",
  preVerteilung: false,
  companyActivityAr: null,
  companyActivitySource: null,
  companyActivityConfidence: null,
};

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

      {/* Acquisition card — content-safety test (real component). */}
      <SectionCard
        title="Acquisition-Karte · Inhaltstest (Firmengegenstand AR)"
        description="Echte <AcquisitionCaseCard> an realer Kartenbreite. Links: langer arabischer Firmengegenstand (voller Absatz) — muss wachsen, umbrechen und lokal RTL rendern, ohne zu beschneiden. Rechts: kurzer Fall als Höhenvergleich. Gemischt: deutsche Labels + arabischer Fließtext + lateinische Daten/IDs."
      >
        {/* Server-side filter toolbar (static demo of the glass checkbox). */}
        <label className="mb-4 flex w-fit items-center gap-2 text-sm text-foreground">
          <Checkbox defaultChecked />
          <span>Nur Firmen mit arabischer Tätigkeitsbeschreibung</span>
          <span className="tabular-nums text-muted-foreground">(412)</span>
        </label>

        <div id="card-test" className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AcquisitionCaseCard data={TEST_CASE} />
          <AcquisitionCaseCard data={SHORT_CASE} />
          <AcquisitionCaseCard data={NULL_CASE} />
        </div>
      </SectionCard>

      {/* Dense table on the solid panel (Part C) — mirrors the tasks/leads tables. */}
      <SectionCard
        title="Aufgaben · dichte Tabelle (solid panel)"
        description="Mehrspaltige Datentabelle auf der opaken Fläche (kein blur, Part C). Deutsche Labels, de-DE-Datumsformat, Status-/Prioritäts-Pills."
      >
        <div id="table-test" className="cockpit-scroll overflow-x-auto">
          <DataTable>
            <DataTableHead>
              <Th>Aufgabe</Th>
              <Th>Typ</Th>
              <Th>Priorität</Th>
              <Th>Status</Th>
              <Th>Fällig</Th>
              <Th>Zugewiesen</Th>
              <Th align="right">Aktualisiert</Th>
            </DataTableHead>
            <tbody>
              {[
                { t: "Insolvenzverwalter kontaktieren", d: "Erstansprache zu Az. 502 IN 1234/26", ty: "outreach", p: "urgent", pv: "red" as const, s: "offen", due: "Überfällig", dv: "red" as const, a: "H. Jasem", u: "30.06.2026" },
                { t: "Datenqualität prüfen", d: "Handelsregister-Abgleich Rheintal mbH", ty: "data_quality", p: "hoch", pv: "yellow" as const, s: "in Bearbeitung", due: "Heute", dv: "yellow" as const, a: "System", u: "01.07.2026" },
                { t: "Follow-up Nordwind Solar", d: "Zweitkontakt nach 7 Tagen", ty: "manual", p: "mittel", pv: "muted" as const, s: "wartend", due: "Geplant", dv: "muted" as const, a: "H. Jasem", u: "28.06.2026" },
              ].map((r) => (
                <Tr key={r.t} className="align-top">
                  <Td>
                    <div className="font-medium">{r.t}</div>
                    <div className="max-w-[22rem] text-xs text-muted-foreground [overflow-wrap:anywhere]">{r.d}</div>
                  </Td>
                  <Td className="text-muted-foreground">{r.ty}</Td>
                  <Td><Badge variant={r.pv}>{r.p}</Badge></Td>
                  <Td>{r.s}</Td>
                  <Td><Badge variant={r.dv}>{r.due}</Badge></Td>
                  <Td className="text-muted-foreground">{r.a}</Td>
                  <Td align="right" className="tabular-nums text-muted-foreground">{r.u}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </SectionCard>

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
