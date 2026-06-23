import { ModulePlaceholder } from "@/components/cockpit/module-placeholder";

export default function CalendarPage() {
  return (
    <ModulePlaceholder
      title="Kalender"
      description="Interner Kalender für Follow-ups, Review-Fristen, Aufgaben und manuelle Termine. Kein Google-Sync im MVP."
      phase="Phase 6D"
      planned={[
        "Follow-ups aus der Watchlist (automatisch)",
        "Fällige Aufgaben (cockpit_tasks.due_at)",
        "Manuelle Termine (cockpit_calendar_events)",
        "Review- und System-Termine",
      ]}
    />
  );
}
