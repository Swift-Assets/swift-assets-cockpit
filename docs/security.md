# Cockpit Security & Privacy Boundaries

This document is normative. When in doubt, choose the more restrictive option and
ask before proceeding.

## 1. Secrets

The Cockpit frontend uses **only public, browser-safe** values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

The following **must never** appear in this repository or in any frontend bundle:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (and any AI provider key)
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`
- `GITHUB_TOKEN`

These belong exclusively in **Supabase Edge Function secrets / backend runtime**.
`.env.local` is git-ignored; only `.env.example` (placeholders) is tracked.

## 2. Authentication & authorization

- Supabase Auth **Magic Link** only. **No public signup**
  (`signInWithOtp({ shouldCreateUser: false })`).
- `middleware.ts` gates all `/cockpit/*` routes (first line of defense).
- **Supabase RLS on `swift_v2` is the authoritative access control.** The UI
  never bypasses it: all clients use the anon key + user session.
- Roles: `viewer | analyst | lead | admin` from `cockpit_user_profiles`, plus the
  `nachlass_authorized` flag. Inactive accounts get no cockpit access.

## 3. Natural-person & Nachlass data

- The public portal is **company-only** and must never expose natural-person or
  Nachlass detail. **This repo does not touch the public portal.**
- Inside the Cockpit, Nachlass / natural-person data may be shown **only** to
  active users with `nachlass_authorized = true` and an appropriate role, under
  RLS — and only in later, explicitly-approved PRs.
- **This first PR does not render any Nachlass/person detail.** The watchlist page
  reads `v_cockpit_my_watchlist` but displays only non-sensitive columns
  (type, title, location, status, follow-up, updated-at). Estate summaries, asset
  categories, and scores are intentionally omitted for now.
- Watchlist tables stay lean (IDs/status/note/follow-up). Personal data is joined
  via internal RLS-gated views, never copied into watchlist tables.
- **Watchlist writes (status, note, follow-up, remove) go exclusively through the
  existing SECURITY DEFINER RPCs from migration 0023** — `cockpit_watchlist_update`,
  `cockpit_unwatch_company`, `cockpit_unwatch_nachlass`. The frontend performs **no
  direct INSERT/UPDATE/DELETE** on watchlist tables. Ownership is always derived
  server-side from `auth.uid()`; the RPCs enforce role and `nachlass_authorized`
  checks. RPC errors are mapped to generic German messages and never leak SQL
  internals to the UI.

## 4. Email

- **No automatic email sending — ever — without explicit manual approval.**
- Outreach drafts are generated and stored only; sending is a separate,
  human-approved action handled by a backend Edge Function using SMTP secrets that
  live only in the backend.

## 5. Database changes

- **No migrations are applied without explicit approval.** This PR applies none.
- The shared `swift_v2` backend is the single source of truth; this repo does not
  duplicate database objects.

## 6. Hard stop conditions

Stop and ask before proceeding if any change could:

- expose natural-person / Nachlass data publicly;
- cause public routes to read raw source tables;
- require a production schema change or a destructive migration;
- require a secret that is not available;
- need `service_role` in the frontend;
- expose OpenAI / SMTP / GitHub tokens to the frontend;
- send email automatically;
- modify the public portal; or
- delete legacy PortalV2 before replacement features exist.
