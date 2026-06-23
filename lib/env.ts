/**
 * Centralized, browser-safe environment access for the Cockpit frontend.
 *
 * Only PUBLIC values live here. Secrets (service_role, OpenAI, SMTP, GitHub
 * tokens) are intentionally NOT read by this app — see docs/security.md.
 *
 * Values are read lazily inside functions so that `next build` does not fail
 * when env vars are absent (e.g. in CI). They only need to be present at
 * runtime, when a request actually touches Supabase.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return key;
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** True when the public Supabase env is configured. Used to render setup hints. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * The Postgres schema for all Cockpit/portal data. The shared backend exposes
 * everything under `swift_v2`; the Supabase clients are pinned to it.
 */
export const DB_SCHEMA = "swift_v2";
