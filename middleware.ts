import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection for /cockpit/* via the real Supabase session
 * (lib/supabase/middleware.ts → updateSession), so RLS/auth.uid() works for all
 * cockpit data and RPCs. The temporary access-code bypass has been retired.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonicalize /Cockpit/* → /cockpit/*.
  if (pathname.startsWith("/Cockpit")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Cockpit/, "/cockpit");
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
