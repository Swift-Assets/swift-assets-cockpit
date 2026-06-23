import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { DB_SCHEMA, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Route Handlers and Server
 * Actions. Uses the PUBLIC anon key + the user's session cookie, so it always
 * runs under the authenticated user's RLS context. Never use service_role here.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` can be called from a Server Component, where mutating
          // cookies is not allowed. Session refresh is handled in middleware,
          // so this is safe to ignore.
        }
      },
    },
  });
}
