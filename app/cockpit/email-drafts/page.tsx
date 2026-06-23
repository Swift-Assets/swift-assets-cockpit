import { ModulePlaceholder } from "@/components/cockpit/module-placeholder";

export default function EmailDraftsPage() {
  return (
    <ModulePlaceholder
      title="E-Mail-Entwürfe"
      description="Professionelle, diskrete deutsche Anfrage-Entwürfe an Insolvenzverwalter. Erstellung über Edge Function. Kein automatischer Versand."
      phase="Phase 5B"
      planned={[
        "Entwurfserstellung (cockpit_email_drafts)",
        "Deutsche Vorlage, höflich & unverbindlich",
        "Manuelle Prüfung vor jedem Versand",
        "Ereignisprotokoll (cockpit_email_events)",
        "Kein Auto-Versand · SMTP erst nach expliziter Freigabe",
      ]}
    />
  );
}
