import { ModulePlaceholder } from "@/components/cockpit/module-placeholder";

export default function OperationsPage() {
  return (
    <ModulePlaceholder
      title="Operations"
      description="Überwachung von Datenpipelines, GitHub Actions, Scrapern, Supabase-Jobs, Edge Functions und AI-Anreicherung mit Statusampeln."
      phase="Phase 6B"
      planned={[
        "GitHub Workflow Status (sync-github-actions)",
        "Daten-Ingestion & Scraper-Gesundheit",
        "Supabase Job / Edge Function Status",
        "Fehlgeschlagene & veraltete Läufe",
        "Statusampeln (grün / gelb / rot)",
      ]}
    />
  );
}
