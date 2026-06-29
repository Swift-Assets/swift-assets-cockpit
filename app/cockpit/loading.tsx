/**
 * Segment-level loading skeleton for ALL /cockpit/* pages.
 *
 * Why this exists (performance): every cockpit page is dynamically rendered
 * (per-user auth via cookies()). Without a `loading` boundary, a `<Link>`
 * navigation shows the OLD page frozen until the full server render completes,
 * and Next.js cannot usefully prefetch a dynamic route. Adding this file:
 *   1. paints an instant skeleton in the content area on every navigation
 *      (the persistent sidebar/topbar from the layout stay mounted), and
 *   2. gives `<Link>` a prefetchable boundary again, so the skeleton appears
 *      immediately on click while the real RSC payload streams in behind it.
 *
 * Purely presentational — no data, no client JS, no behavior change.
 */
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted/60 ${className}`} />;
}

export default function CockpitLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Wird geladen …</span>

      {/* Page header placeholder */}
      <div className="space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-64" />
        <Bar className="h-4 w-full max-w-xl" />
      </div>

      {/* Card grid placeholder (covers dashboard/operations/watchlist layouts) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <Bar className="h-5 w-16" />
              <Bar className="h-5 w-20" />
            </div>
            <Bar className="h-5 w-3/4" />
            <Bar className="h-4 w-1/2" />
            <div className="flex items-center gap-2 pt-1">
              <Bar className="h-5 w-24" />
              <Bar className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
