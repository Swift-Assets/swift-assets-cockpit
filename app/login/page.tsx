import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BirdMark } from "@/components/cockpit/brand";
import { safeRedirectPath } from "@/lib/auth/temp-access";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Login is currently a fast access-code gate: the form posts the code to
 * /auth/access (server-only validation against TEMP_COCKPIT_ACCESS_CODE), which
 * sets the httpOnly access cookie and redirects into the cockpit. No email, no
 * Supabase request, no rate limit. The Magic-Link form is preserved in
 * components/cockpit/magic-link-form.tsx for easy re-enable.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectedFrom?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectedFrom = safeRedirectPath(params.redirectedFrom);
  const hasError = params.error === "code";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Brand hero: bird + faded halo */}
      <div className="mb-10 flex flex-col items-center text-center">
        <BirdMark size={84} />
        <h1 className="mt-7 text-2xl font-semibold uppercase tracking-[0.22em] text-foreground">
          Swift Assets
        </h1>
        <p className="mt-2 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          UG (haftungsbeschränkt) · Internal Cockpit
        </p>
        <div className="mt-5 h-px w-12 bg-border" aria-hidden />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Interner Zugang</CardTitle>
          <CardDescription>
            Bitte geben Sie den Zugangscode ein, um das Cockpit zu öffnen. Kein
            öffentlicher Zugang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/access" method="post" className="space-y-4">
            <input type="hidden" name="redirectedFrom" value={redirectedFrom} />
            <div className="space-y-1.5">
              <label htmlFor="code" className="eyebrow">
                Zugangscode
              </label>
              <input
                id="code"
                name="code"
                type="password"
                required
                autoComplete="off"
                autoFocus
                placeholder="••••••••"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" className="w-full">
              Cockpit öffnen
            </Button>
            {hasError ? (
              <p className="text-sm text-status-red">
                Ungültiger Zugangscode. Bitte erneut versuchen.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
