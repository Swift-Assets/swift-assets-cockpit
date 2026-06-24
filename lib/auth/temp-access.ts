/**
 * TEMPORARY access-code gate shared constants/helpers.
 *
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 * This module backs a lightweight cookie gate that replaces Supabase Magic Link
 * for route protection while the UI is being refined. The access code itself is
 * validated only server-side against process.env.TEMP_COCKPIT_ACCESS_CODE and is
 * NEVER referenced here or sent to the browser.
 */

export const TEMP_ACCESS_COOKIE = "swift_cockpit_temp_access";
export const TEMP_ACCESS_VALUE = "1";
export const TEMP_ACCESS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Only allow same-origin absolute-path redirects (e.g. "/cockpit/dashboard").
 * Anything else (external, protocol-relative, non-path) falls back to the
 * default — prevents open redirects via ?redirectedFrom=.
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/cockpit/dashboard";
  }
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@/?%]*$/.test(raw)) {
    return "/cockpit/dashboard";
  }
  return raw;
}
