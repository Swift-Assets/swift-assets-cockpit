import { BirdMark } from "@/components/cockpit/brand";
import { safeRedirectPath } from "@/lib/auth/temp-access";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Login styled as the website Hero (black, centered real bird, large wordmark,
 * thin #2d2d2d divider, outlined uppercase CTA). The form posts the access code
 * to /auth/access (server-only validation). Magic-Link form preserved in
 * components/cockpit/magic-link-form.tsx.
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-16 text-white">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <BirdMark size={132} priority />

        <h1
          className="mt-10 font-semibold leading-none"
          style={{ fontSize: "clamp(2rem, 7vw, 3.25rem)", letterSpacing: "clamp(2px, 1.2vw, 12px)" }}
        >
          SWIFT&nbsp;ASSETS
        </h1>
        <p className="mt-4 text-xs font-light uppercase tracking-[0.3em] text-mute">
          UG (Haftungsbeschränkt) · Internal Cockpit
        </p>

        <div className="my-12 h-px w-24 bg-ink-mid" aria-hidden />

        <form action="/auth/access" method="post" className="w-full space-y-5 text-left">
          <input type="hidden" name="redirectedFrom" value={redirectedFrom} />
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute"
            >
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
              className="flex h-12 w-full border border-ink-mid bg-transparent px-4 text-sm text-white outline-none transition-colors placeholder:text-mute focus:border-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-3 border border-white text-sm uppercase tracking-[0.3em] text-white transition-colors hover:bg-white hover:text-ink"
          >
            Cockpit öffnen
            <span aria-hidden>→</span>
          </button>
          {hasError ? (
            <p className="text-sm text-status-red">
              Ungültiger Zugangscode. Bitte erneut versuchen.
            </p>
          ) : null}
        </form>

        <p className="mt-10 text-[0.7rem] uppercase tracking-[0.22em] text-mute">
          Kein öffentlicher Zugang
        </p>
      </div>
    </main>
  );
}
