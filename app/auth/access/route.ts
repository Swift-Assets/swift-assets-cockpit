import { NextResponse, type NextRequest } from "next/server";
import {
  TEMP_ACCESS_COOKIE,
  TEMP_ACCESS_MAX_AGE,
  TEMP_ACCESS_VALUE,
  safeRedirectPath,
} from "@/lib/auth/temp-access";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * Access-code gate. Validates the submitted code against the SERVER-ONLY env var
 * TEMP_COCKPIT_ACCESS_CODE (never exposed to the browser, never logged). On
 * success, sets the httpOnly access cookie on the redirect response and sends
 * the user to a safe relative target. No Supabase request, no email, no rate
 * limit.
 */
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  let code = "";
  let redirectedFrom: string | null = null;
  try {
    const form = await request.formData();
    code = String(form.get("code") ?? "");
    const rf = form.get("redirectedFrom");
    redirectedFrom = rf ? String(rf) : null;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=code`, { status: 303 });
  }

  const expected = process.env.TEMP_COCKPIT_ACCESS_CODE;
  // If the server has no code configured, fail closed (never open the gate).
  if (!expected || code.length === 0 || code !== expected) {
    return NextResponse.redirect(`${origin}/login?error=code`, { status: 303 });
  }

  const target = safeRedirectPath(redirectedFrom);
  const response = NextResponse.redirect(`${origin}${target}`, { status: 303 });
  response.cookies.set(TEMP_ACCESS_COOKIE, TEMP_ACCESS_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEMP_ACCESS_MAX_AGE,
  });
  return response;
}
