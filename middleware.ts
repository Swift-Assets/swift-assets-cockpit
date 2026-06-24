import { type NextRequest, NextResponse } from "next/server";
import { TEMP_ACCESS_COOKIE, TEMP_ACCESS_VALUE } from "@/lib/auth/temp-access";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Route protection for /cockpit/* is now a lightweight access-code cookie gate
 * (swift_cockpit_temp_access). The Supabase session/Magic-Link check
 * (lib/supabase/middleware.ts → updateSession) is preserved in the repo but no
 * longer called here. To re-enable Magic Link: restore `return
 * updateSession(request)` below and revert the /login page + cockpit layout.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonicalize /Cockpit/* → /cockpit/*.
  if (pathname.startsWith("/Cockpit")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Cockpit/, "/cockpit");
    return NextResponse.redirect(url);
  }

  const isProtected =
    pathname === "/cockpit" || pathname.startsWith("/cockpit/");
  if (isProtected) {
    const hasAccess =
      request.cookies.get(TEMP_ACCESS_COOKIE)?.value === TEMP_ACCESS_VALUE;
    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
