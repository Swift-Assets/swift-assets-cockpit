import { ModulePlaceholder } from "@/components/cockpit/module-placeholder";

export default function OperationsInboxPage() {
  return (
    <ModulePlaceholder
      title="Operations · Inbox"
      description="Dreigeteilter Posteingang für Betrieb, Deal-Kommunikation und Triage."
      phase="Phase 6"
      planned={[
        "System Operations Inbox (Fehler, Warnungen)",
        "Deal Communication Inbox (Antworten von Insolvenzverwaltern)",
        "Triage Inbox (neue Leads, Review-Bedarf)",
      ]}
    />
  );
}
