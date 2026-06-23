import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Redirect any capitalized /Cockpit/* path to the canonical lowercase form.
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/Cockpit")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/Cockpit/, "/cockpit");
    return NextResponse.redirect(url);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files, so the session
     * stays fresh app-wide while only /cockpit/* is access-gated.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
