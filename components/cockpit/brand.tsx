import { cn } from "@/lib/utils";

/**
 * Swift Assets bird mark — a white swift/swallow silhouette inside a thin ring,
 * wrapped in the faded circular halo brand motif (.brand-halo).
 *
 * NOTE: the official brand SVG is not present in the repo; this is a faithful
 * in-house recreation of the website's bird-in-circle + halo. Drop the official
 * asset into /public and swap the <svg> here when available.
 */
export function BirdMark({
  size = 40,
  halo = true,
  className,
}: {
  size?: number;
  halo?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border border-border/70 bg-background",
        halo && "brand-halo",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        width={size * 0.58}
        height={size * 0.58}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stylized swift in flight — single white shape. */}
        <path
          d="M58 12c-9 1.5-16.5 6-23 13.2C29.6 31 26 36 21.5 39.3c-3 2.2-6.8 3.5-11.5 3.9 4.2 2.6 8.8 3.6 13.4 2.7 6.7-1.3 11.7-5.4 15.8-10.7-1.2 5.2-4 9.6-8.4 13.4 7.2-1.4 12.9-5.2 17.2-11.2C56 25 58.2 18.6 58 12Z"
          fill="currentColor"
          className="text-foreground"
        />
      </svg>
    </span>
  );
}

/**
 * Swift Assets wordmark: "SWIFT ASSETS" + "UG (haftungsbeschränkt)" subline,
 * matching the website's uppercase, wide-tracked treatment.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-semibold uppercase tracking-[0.18em] text-foreground",
          size === "sm" ? "text-[0.82rem]" : "text-sm",
        )}
      >
        Swift Assets
      </span>
      <span className="mt-1 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
        UG · Internal Cockpit
      </span>
    </span>
  );
}

/** Combined lockup (bird + wordmark) used in the sidebar and login. */
export function BrandLockup({
  birdSize = 40,
  className,
}: {
  birdSize?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BirdMark size={birdSize} />
      <Wordmark />
    </span>
  );
}
