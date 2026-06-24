import { NextResponse, type NextRequest } from "next/server";
import { TEMP_ACCESS_COOKIE } from "@/lib/auth/temp-access";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Clears the temporary access-code cookie and returns to /login. (Supabase
 * sign-out is not called while the access-code gate is active; re-add it when
 * Magic Link is restored.)
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
  response.cookies.set(TEMP_ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
