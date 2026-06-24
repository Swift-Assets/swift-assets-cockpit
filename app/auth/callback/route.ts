import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DB_SCHEMA, getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Only allow same-origin, absolute-path targets (e.g. "/cockpit/dashboard").
 * A conservative charset allowlist additionally rejects any HTML/JS-significant
 * characters (quotes, angle brackets, whitespace), so the value is safe to
 * embed in the completion HTML below. Anything else falls back to the default —
 * this also closes open-redirect via ?redirectedFrom=.
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/cockpit/dashboard";
  }
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/?%]*$/.test(raw)) {
    return "/cockpit/dashboard";
  }
  return raw;
}

/**
 * Minimal interstitial page. Carries the session cookies on a 200 response and
 * navigates client-side once the browser has stored them. Contains NO token,
 * code, session, cookie value, or link URL — only the sanitized target path.
 */
function completionHtml(redirectTo: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Anmeldung…</title>
</head>
<body style="font-family:ui-sans-serif,system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#0f172a;background:#f8fafc;">
<main style="text-align:center;">
<p style="font-size:14px;">Anmeldung wird abgeschlossen…</p>
<noscript><p style="font-size:14px;">Bitte fortfahren: <a href="${redirectTo}">Weiter zum Cockpit</a></p></noscript>
</main>
<script>window.location.replace(${JSON.stringify(redirectTo)});</script>
</body>
</html>`;
}

/**
 * Magic-link / OTP callback. Exchanges the PKCE code for a session, sets the
 * Supabase auth cookies on a normal 200 HTML response, and lets that page
 * redirect the browser client-side. This avoids returning an immediate
 * 3xx redirect whose Set-Cookie headers were being dropped on the
 * Netlify/Next handoff (the session row was created but the browser never
 * stored/sent the cookies, looping back to /login).
 *
 * On any failure we redirect to /login?error=auth. No tokens, codes, cookie
 * values, or link URLs are ever logged or embedded in the HTML.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = safeRedirectPath(searchParams.get("redirectedFrom"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // 200 HTML response that the auth cookies attach to (not a 3xx redirect).
  const response = new NextResponse(completionHtml(redirectTo), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
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
