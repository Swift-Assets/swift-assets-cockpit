import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const HEALTH_CARDS = [
  "Public Portal Health",
  "Privacy Guard",
  "Data Ingestion",
  "GitHub Actions",
  "AI Enrichment",
  "Outreach Drafts",
  "Today Tasks",
  "Tomorrow Tasks",
  "Overdue Follow-ups",
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Executive Übersicht. KPIs und Statusampeln folgen in Phase 6A.
          </p>
        </div>
        <Badge variant="yellow">Phase 6A · geplant</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HEALTH_CARDS.map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {title}
                <Badge variant="muted">—</Badge>
              </CardTitle>
              <CardDescription>Noch nicht verbunden.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Daten folgen in einem späteren PR.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
