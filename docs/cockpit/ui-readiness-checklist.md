# Cockpit UI Readiness Checklist

Companion to `backend-ui-contract.md`. Defines what the upcoming
**UI PHASE 1 — Cockpit Shell + Dashboard + Watchlist** (and adjacent blocks)
can safely build now, what needs a live session, what can/can't be mocked, and
the hard stop conditions.

---

## A. Ready for UI PHASE 1 (build now)

- [x] **Cockpit shell** — sidebar/topbar, nav (`lib/cockpit/nav.ts`), auth-gated layout.
- [x] **Dashboard cards** — system health + data coverage (`v_cockpit_system_health`, `v_cockpit_data_coverage_summary`).
- [x] **Watchlist table** — `v_cockpit_watchlist_internal` (basic `v_cockpit_my_watchlist` fallback).
- [x] **Watchlist detail panel** — case / phase / administrator / data-quality / outreach / notes sections.
- [x] **Tasks block** — `v_cockpit_my_tasks` + create/update/complete/reopen/archive.
- [x] **Outreach draft block** — list/read/edit/mark-ready/archive (`v_cockpit_outreach_drafts`).
- [x] **AI review block** — display + "KI-Bewertung erstellen" trigger (`ai-review-section.tsx`).
- [x] **AI outreach draft button** — "KI-E-Mail-Entwurf erstellen" (`ai-outreach-create-button.tsx`).
- [x] **Email drafts page** — read / edit / mark-ready / archive.

All have backend views, RPCs/Edge Functions, and server actions already wired
(see contract sections B–G).

---

## B. Requires an authenticated app session (works only when signed in)

- Watch / unwatch (company & nachlass), status/note/follow-up updates.
- Task mutations (create/update/complete/reopen/archive).
- Outreach draft mutations (create/update/mark-ready/archive).
- AI case review generation (`generate-watchlist-ai-review`).
- AI outreach email generation (`generate-outreach-email-draft`).

Reason: every RPC/Edge Function resolves identity from `auth.uid()` / the user
JWT. No authenticated session ⇒ `not_authenticated` / 0 rows.

---

## C. Requires real data / cannot be tested from MCP or `postgres`

- The real AI generation button flow end-to-end (needs JWT + provider key + a target row).
- Non-authorized vs `nachlass_authorized` **row-level** behavior (needs two real JWTs).
- UI session behavior (login redirect, middleware gating).
- Supabase Auth **Magic Link** sign-in flow.

MCP/`postgres` runs with `auth.uid() = null`, so these can only be confirmed
from the live authenticated app.

---

## D. Must NEVER be mocked (always real)

- Role / RLS behavior (active profile, writer role).
- Nachlass authorization behavior (`nachlass_authorized`).
- Public vs private data separation.
- Email sending status (there is none — never fake a "sent" state).
- Financial numbers (Bundesanzeiger retired — never fabricate figures).

---

## E. Can be mocked safely while waiting for real data

- Empty states ("Noch keine Einträge …").
- Loading / pending states.
- Disabled buttons (e.g. when `watch_id` missing or draft exists).
- Explanatory banners (access missing, provider not configured).
- Non-sensitive placeholder cards (`module-placeholder.tsx`).

---

## F. Stop conditions for UI implementation (halt + escalate)

- Any **raw source table** access from the frontend.
- Any `service_role` key in frontend/client/server-action code.
- Any **public exposure of Nachlass** data.
- Any email sending / SMTP / `mailto:`.
- `source_snapshot` exposed in any view or UI.
- Outreach `metadata` jsonb blob exposed in UI.
- Public portal touched.
- Direct AI provider (OpenAI/Gemini) call from the browser.
- Hardcoded API keys anywhere in the repo.
