import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  /** Planned capabilities for this module (shown as a checklist preview). */
  planned: string[];
  /** Implementation phase label, e.g. "Phase 6A". */
  phase?: string;
  children?: ReactNode;
}

/**
 * Shared shell for the not-yet-implemented Cockpit modules. Renders the module
 * intent and the planned feature list without exposing any data.
 */
export function ModulePlaceholder({
  title,
  description,
  planned,
  phase,
  children,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Badge variant="yellow">{phase ? `${phase} · geplant` : "geplant"}</Badge>
      </div>

      {children}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geplante Funktionen</CardTitle>
          <CardDescription>
            Dieses Modul ist ein Platzhalter. Funktionen folgen in späteren PRs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {planned.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  aria-hidden
                />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
