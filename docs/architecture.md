# Cockpit Architecture

## Overview

The Internal Cockpit is a **standalone Next.js (App Router) application** living in
`Swift-Assets/swift-assets-cockpit`. It shares the existing Supabase backend with
the rest of Swift Assets V2:

- Supabase project: `hqyktreytsjeirlpnnyr`
- Postgres schema: `swift_v2`

The Cockpit owns its **frontend**; the **backend is shared** and already mature
(117+ migrations, RLS on every table). This repo does **not** duplicate database
objects and does **not** apply migrations without explicit approval.

## App structure

```
app/
  layout.tsx                 # root layout (noindex, de)
  page.tsx                   # -> redirect to /cockpit/dashboard
  login/page.tsx             # Magic Link sign-in (no public signup)
  auth/callback/route.ts     # OTP code exchange -> session
  auth/sign-out/route.ts     # sign out
  cockpit/
    layout.tsx               # loads profile, renders sidebar + topbar
    page.tsx                 # -> redirect to dashboard
    dashboard/page.tsx       # KPI placeholders
    watchlist/page.tsx       # READ-ONLY v_cockpit_my_watchlist
    operations/page.tsx
    operations/inbox/page.tsx
    portal-guard/page.tsx
    calendar/page.tsx
    email-drafts/page.tsx
    settings/page.tsx        # read-only profile
components/
  ui/                        # shadcn-style primitives (card, badge, button)
  cockpit/                   # sidebar, topbar, module placeholder
lib/
  env.ts                     # lazy public env access
  utils.ts                   # cn()
  supabase/{client,server,middleware}.ts
  cockpit/{profile,nav}.ts
middleware.ts                # /Cockpit -> /cockpit, session refresh, /cockpit/* gate
```

## Auth flow

1. User enters their company email at `/login`.
2. `signInWithOtp({ shouldCreateUser: false })` — only existing cockpit users
   receive a link (no public signup).
3. The magic link returns to `/auth/callback`, which exchanges the code for a
   session cookie.
4. `middleware.ts` refreshes the session on every request and redirects
   unauthenticated users away from `/cockpit/*`.
5. `app/cockpit/layout.tsx` loads the user's profile from
   `swift_v2.cockpit_user_profiles` and renders the chrome. Inactive users see a
   "no active access" notice.

## Data access

- All Supabase clients use the **public anon key** and operate under **RLS**.
- The clients are pinned to the `swift_v2` schema.
- The watchlist page reads `swift_v2.v_cockpit_my_watchlist` (RLS-gated to the
  current user). No writes are performed in this PR.

## Roles

Roles come from `cockpit_user_profiles.role` (`viewer | analyst | lead | admin`)
plus the `nachlass_authorized` flag. This PR reads them for display and basic
gating only; write authorization (RPCs) is a later PR.

## Deferred / out of scope for this PR

- Inspection and reuse of `swift-assets-04-web-portal` and the legacy `/portal/v2`
  path. **The old PortalV2 path is historical/frozen and is not the foundation of
  the new Cockpit.** This is deferred to later PRs.
- Watchlist write actions (watch/unwatch/status/note/follow-up via existing 0023
  RPCs).
- Internal enrichment view (`v_cockpit_watchlist_internal`, proposed migration
  0024), AI summaries, outreach drafts, operations/portal-guard data, tasks and
  calendar — each in its own approved PR.

## Backend objects already present (for reference)

Confirmed via read-only inspection of `swift_v2`:

- Entity layer: `portal_entities`, `entity_source_links`, source tables.
- Watchlist (migration 0023): `cockpit_company_watchlist`,
  `cockpit_nachlass_watchlist`, `cockpit_watchlist_history`,
  view `v_cockpit_my_watchlist`, and write RPCs (`cockpit_watch_company`, etc.).
- `cockpit_user_profiles` with `role`, `is_active`, `nachlass_authorized`.

Not yet present (future, approval-gated migrations): `v_cockpit_watchlist_internal`,
`cockpit_case_ai_summaries`, `cockpit_email_drafts`/`cockpit_email_events`,
`cockpit_system_health_checks`, `cockpit_github_workflow_runs`, portal-guard
tables, `cockpit_tasks`, `cockpit_calendar_events`.
