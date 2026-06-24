import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Swift Assets bird mark — the OFFICIAL logo asset (white swift inside a black
 * disc) copied from the website source into /public/brand/logo-bird.png. The
 * disc is self-contained, so it reads on both paper (white) and ink (black)
 * surfaces. No recreated SVG.
 */
export function BirdMark({
  size = 56,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-bird.png"
      alt="Swift Assets"
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Swift Assets wordmark — exact website treatment (Logo.tsx): "SWIFT ASSETS"
 * font-semibold tracking-[0.22em] + "UG (HAFTUNGSBESCHRÄNKT)" font-light
 * tracking-[0.18em] muted subline. `invert` switches to white-on-dark chrome.
 */
export function Wordmark({
  size = "md",
  invert = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  invert?: boolean;
  className?: string;
}) {
  const brand =
    size === "sm" ? "text-[15px]" : size === "lg" ? "text-xl" : "text-lg";
  const sub =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-[12px]" : "text-[11px]";
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span
        className={cn(
          "font-semibold tracking-[0.22em]",
          brand,
          invert ? "text-white" : "text-ink",
        )}
      >
        SWIFT ASSETS
      </span>
      <span
        className={cn(
          "mt-1 font-light tracking-[0.18em]",
          sub,
          invert ? "text-mute-2" : "text-mute",
        )}
      >
        UG (HAFTUNGSBESCHRÄNKT)
      </span>
    </div>
  );
}

/** Combined lockup (bird + wordmark), website Logo.tsx style. */
export function BrandLockup({
  birdSize = 48,
  invert = false,
  className,
}: {
  birdSize?: number;
  invert?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-3 leading-none", className)}>
      <BirdMark size={birdSize} />
      <Wordmark size="sm" invert={invert} />
    </span>
  );
}
