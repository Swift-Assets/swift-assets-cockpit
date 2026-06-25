# Acquisition Inbox — Backend View (Phase 0035B, proposal)

Proposes `swift_v2.v_cockpit_acquisition_inbox` as the single backend source for
the card-first Acquisition Inbox UI. **Migration `0034` is repo-only and NOT
applied to production** — apply only after human review.

## Purpose
Unify, in one normalized safe row shape, everything the inbox needs:

| source | meaning | inbox_status |
|---|---|---|
| `new_company` | company insolvency, recent announcement, not yet watched | `neu` |
| `new_nachlass` | Nachlass insolvency candidate, recent, not yet watched | `neu` |
| `watchlist` | watched company/Nachlass case | `watching` / `pursuing` / `passed` |

## Company handling
- **New** company cases: driven from `v_cockpit_companies` + the same lateral
  joins used by `v_cockpit_watchlist_internal` (latest announcement, administrator,
  Handelsregister) over `source_neu_insolvenz_announcements` /
  `source_handelsregister_records`, excluding entities already on the caller's
  `cockpit_company_watchlist`.
- **Watched** company cases: reused directly from `v_cockpit_watchlist_internal`.

## Nachlass handling (internal Cockpit only)
- **Watched** Nachlass cases: reused from `v_cockpit_watchlist_internal`, with
  `person_name` added via the approved internal source.
- **New** Nachlass cases: from `nachlass_detection_results` (`is_nachlass_candidate`)
  joined to `raw_insolvency_announcements` for court / Aktenzeichen / date /
  administrator / `person_name` (= `debtor_name`).
- **Why person_name is allowed internally:** the Cockpit is a protected,
  authenticated-only internal tool used by Swift Assets staff for legitimate
  acquisition/asset-evaluation. Nachlass announcements are public insolvency
  matters; the deceased person's name is operationally necessary to identify the
  case and to address the responsible administrator. It is exposed **only** to
  authenticated internal users with `nachlass_authorized`.
- **Why it is not public:** the view is `security_invoker = false`, granted to
  `authenticated` only (never `anon`/public), Nachlass branches require
  `nachlass_authorized`, and it is never used by the public portal. Existing
  natural-person protections for anon/public are unchanged.
- **birth_date:** `null::date` — no birth-date column exists anywhere in the
  schema (verified). It can be added later if a source becomes available.

## Acquisition window
A non-watched case is included if `latest_publication_date >= current_date - 180`.
Watched cases are always included regardless of date, so ignored (`passed`) cases
remain visible for ongoing triage. Nothing is deleted or permanently hidden.

## Access / security
- `security_invoker = false` + active-cockpit-user gate in every branch;
  Nachlass branches additionally require `nachlass_authorized`.
- `revoke all from public, anon; grant select to authenticated;` (mirrors the
  other internal cockpit views).
- **Never selected:** `announcement_text`, `raw_json`, `source_excerpt`,
  `detection_reasoning_ar`, `source_url`, `source_snapshot`.

## Limitations
- `birth_date` always null (no source).
- New Nachlass `city`/`bundesland` are null (the source announcement's
  `debtor_city` is a private natural-person residence and intentionally not
  surfaced); company city/Bundesland come from `v_cockpit_companies`.
- No detailed Bekanntmachung timeline (only the latest publication date).
- The 180-day window is an MVP heuristic; adjust if the project later defines a
  formal acquisition window.

## Next UI wiring step
After review + apply, point `app/cockpit/watchlist/page.tsx` at
`getAcquisitionInbox()` (`lib/cockpit/acquisition-inbox.queries.ts`) and map
`AcquisitionInboxRow` → the existing `CaseCardData` (one source instead of
merging `getAcquisitionLeads()` + `getInternalWatchlist()` client-side), which
also brings true new **Nachlass** cards into the inbox.
