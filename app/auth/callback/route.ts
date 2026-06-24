import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DB_SCHEMA, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Only allow same-origin, absolute-path redirects (e.g. "/cockpit/dashboard").
 * Anything else (external URL, protocol-relative "//evil.com", non-path) falls
 * back to the default — prevents open-redirect via ?redirectedFrom=.
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/cockpit/dashboard";
  }
  return raw;
}

/**
 * Magic-link / OTP callback. Exchanges the PKCE code for a session and
 * redirects into the cockpit.
 *
 * Cookie handling: we build the redirect response FIRST and let Supabase write
 * the session cookies directly onto it via setAll(). A manually-created
 * NextResponse.redirect does not inherit cookies written to the next/headers
 * store on Netlify/Next, which previously dropped the session and bounced the
 * user back to /login. On failure we return to /login with a generic error
 * flag. No tokens, codes, or link URLs are ever logged.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirectedFrom"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Build the final redirect up-front so auth cookies attach to THIS response.
  const response = NextResponse.redirect(`${origin}${redirectTo}`);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Mirror onto the request (for any in-handler reads) and — crucially —
        // onto the redirect response so Set-Cookie reaches the browser.
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return response;
}
