import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/cockpit/glass-card";
import { PageHeader } from "@/components/cockpit/page-header";
import { getCockpitProfile } from "@/lib/cockpit/profile";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // getCockpitProfile is wrapped in React cache(), so this shares the cockpit
  // layout's single auth round-trip + profile query for this request — no extra
  // Supabase Auth call is made here.
  const profile = await getCockpitProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verwaltung"
        title="Einstellungen"
        lead="Benutzer, Rollen und Berechtigungen. Verwaltung folgt in einem späteren PR."
      />

      {/* Hero/side info card → glass surface (Part C). */}
      <GlassCard className="max-w-2xl p-5">
        <h2 className="text-base font-semibold tracking-tight">Mein Konto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only Ansicht aus swift_v2.cockpit_user_profiles.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">
              {profile?.displayName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-Mail</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">
              {profile?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rolle</dt>
            <dd>
              <Badge variant="outline">{profile?.role ?? "—"}</Badge>
            </dd>
          </div>
        </dl>
      </GlassCard>
    </div>
  );
}
