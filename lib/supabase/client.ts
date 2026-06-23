import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Browser Supabase client. Uses the PUBLIC anon key only and operates strictly
 * under RLS. Never import a service-role key here.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: { schema: DB_SCHEMA },
  });
}
