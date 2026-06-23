# Swift Assets V2 — Internal Cockpit

Standalone **Next.js + Supabase** application that is the source of truth for the
Swift Assets V2 **Internal Cockpit** frontend.

> Internal use only. Confidential. Not a public website.

## What this is

The Cockpit is the internal command center for Swift Assets V2. It is a separate
application from the public portal (`swift-assets-04-web-portal`) and shares the
same Supabase backend (project `hqyktreytsjeirlpnnyr`, schema `swift_v2`).

Planned modules (routes under `/cockpit`):

| Route | Module | Status |
|---|---|---|
| `/cockpit/dashboard` | Executive dashboard & KPIs | placeholder |
| `/cockpit/watchlist` | Acquisition watchlist (companies & Nachlass) | add (company) + status/note/follow-up/remove via RPC |
| `/cockpit/operations` | Pipeline / jobs / system health | placeholder |
| `/cockpit/operations/inbox` | System / deal / triage inboxes | placeholder |
| `/cockpit/portal-guard` | Public portal health & privacy scans | placeholder |
| `/cockpit/calendar` | Follow-ups, deadlines & events | placeholder |
| `/cockpit/email-drafts` | Outreach email drafts | placeholder |
| `/cockpit/settings` | Users, roles & authorizations | read-only |

This first PR is a **thin shell**: scaffold, auth, guarded routes, and a
read-only watchlist. No migrations, no AI, no email/SMTP, no secrets. See
[`docs/architecture.md`](docs/architecture.md) and
[`docs/security.md`](docs/security.md).

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style components
- Supabase Auth (Magic Link) via `@supabase/ssr`
- RLS-enforced access to the shared `swift_v2` schema

## Local development

```bash
npm install
cp .env.example .env.local   # fill in PUBLIC Supabase values only
npm run dev                  # http://localhost:3000
```

Useful scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
```

## Environment

Only **public, browser-safe** values are used by this app (see `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Service-role keys, OpenAI keys, SMTP credentials, and GitHub tokens **must never**
live in this frontend. They belong exclusively in Supabase Edge Function secrets
/ backend runtime.

## Relationship to other repos

- `swift-assets-04-web-portal` — public portal. **Not** modified by this repo. Its
  legacy `/portal/v2` path is historical/frozen and is **not** the foundation of
  the new Cockpit. Inspection/reuse of web-portal is deferred to later PRs.
- The shared Supabase backend (`swift_v2`) is mature; this repo does not duplicate
  database objects and does not apply migrations without explicit approval.
