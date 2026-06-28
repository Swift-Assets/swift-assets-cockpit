import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCockpitProfile } from "@/lib/cockpit/profile";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCockpitProfile();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Benutzer, Rollen und Berechtigungen. Verwaltung folgt in einem
          späteren PR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mein Konto</CardTitle>
          <CardDescription>
            Read-only Ansicht aus swift_v2.cockpit_user_profiles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{profile?.displayName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">E-Mail</dt>
              <dd className="font-medium">{profile?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rolle</dt>
              <dd>
                <Badge variant="outline">{profile?.role ?? "—"}</Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
