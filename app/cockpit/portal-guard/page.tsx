import { ModulePlaceholder } from "@/components/cockpit/module-placeholder";

export default function PortalGuardPage() {
  return (
    <ModulePlaceholder
      title="Portal Guard"
      description="Regelmäßige Prüfung des öffentlichen Portals auf Erreichbarkeit, defekte Seiten und unzulässige Offenlegung personenbezogener bzw. Nachlass-Daten."
      phase="Phase 6C"
      planned={[
        "Öffentliche Routen-Gesundheit (run-public-portal-health-check)",
        "Privacy-Scan (run-portal-privacy-scan)",
        "Verdachtsfälle & bestätigte Funde",
        "Aufgaben aus Funden generieren",
        "Sichere Befund-Darstellung ohne sensible Volltexte",
      ]}
    />
  );
}
