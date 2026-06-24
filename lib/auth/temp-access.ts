/**
 * Safe relative-redirect helper shared by the login flow.
 *
 * (The temporary access-code gate has been retired in favour of Supabase
 * email/password login; only this same-origin redirect guard remains.)
 */

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
