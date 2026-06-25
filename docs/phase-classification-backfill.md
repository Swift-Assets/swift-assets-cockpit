# Phase Classification — Residual "Unbekannt" Backfill Plan (Phase 0037, proposal)

**STATUS: PROPOSAL ONLY. No UPDATE/INSERT/DELETE was run against production.**
This document describes a backfill plan for human review; it is *not* executed by
migration `0035` (which only fixes the classifier functions).

## Background — two root causes of Phase = "Unbekannt"

Read-only diagnostics (SELECT only) over `swift_v2.source_neu_insolvenz_announcements`
(22,966 rows) and over the latest-announcement-per-case set that drives the inbox:

| Root cause | What it is | Cases (latest-per-entity) | Fixed by |
|---|---|---|---|
| **B. Classifier gap** | `announcement_type_hint` is populated but had no mapping: `Restschuldbefreiung`, `Vergütungsfestsetzung` | ~6,127 + ~884 = **~7,011** | Migration `0035` classifier (this phase) |
| **A. NULL hint** | `announcement_type_hint IS NULL` upstream | **~10,249** | Backfill below (proposed, not done) |

Migration `0035` removes cause **B**. This document addresses the remaining cause
**A** — the dominant residual "Unbekannt".

## Why cause A cannot be fixed in the classifier

The classifier can only map *values it receives*. For the ~10,926 NULL-hint source
rows there is no type value to map. Diagnostics show the type signal is largely
**absent from the database**, not merely unmapped:

- `raw_json->>'announcement_type_hint'`: populated in **0** of 10,926 rows.
- `announcement_text` present (non-empty): **1,060** of 10,926 (~9.7%); the other
  ~90% have no text either.
- Within those 1,060 texts: ~145 mention `Vergütung`; **0** mention
  `Restschuldbefreiung`, `Eröffnung`, `Anordnung`, or `Schluss`.
- `raw_json->'external_raw'`: absent. `opening_date`: 0 populated. `claims_deadline`:
  10 populated.
- All NULL-hint rows share a single `source_name` (one scraper actor/run family).

**Conclusion:** NULL-hint is a genuine **upstream ingestion gap** — the scraper did
not capture/persist the announcement type (and for ~90% not the text). No reliable
in-database signal exists to recover the type for the bulk of these rows.

## Proposed backfill — staged, conservative, reversible

The proposal is to add a derived, auditable column rather than overwrite source
data, then re-ingest for the true fix.

### Stage 0 — Schema (separate repo-only migration, after approval)
- Add `announcement_type_hint_derived text` and `announcement_type_hint_source text`
  (`'scraped' | 'text_regex' | 'reingest'`) to `source_neu_insolvenz_announcements`.
- The classifier-facing views switch to
  `coalesce(announcement_type_hint, announcement_type_hint_derived)` so the original
  scraped column is never mutated and the change is fully reversible.

### Stage 1 — Text regex backfill (recovers a small, high-confidence slice)
For the ~1,060 NULL-hint rows that *do* have `announcement_text`, derive the type by
applying the same ordered patterns the classifier uses, e.g.:

```sql
-- PROPOSAL — DO NOT RUN until approved. Writes announcement_type_hint_derived only.
update swift_v2.source_neu_insolvenz_announcements
set announcement_type_hint_derived = case
      when announcement_text ~* '(vorläufig|vorlaeufig|anordnung|sicherungsma)' then 'Anordnung'
      when announcement_text ~* '(eröffnung|eroeffnung)'                        then 'Eröffnung'
      when announcement_text ~* 'berichtstermin'                                then 'Berichtstermin'
      when announcement_text ~* '(prüfungstermin|pruefungstermin)'             then 'Prüfungstermin'
      when announcement_text ~* '(verwertung|masseverwertung)'                  then 'Verwertung'
      when announcement_text ~* '(schlussverteilung|schlusstermin)'            then 'Schlussverteilung'
      when announcement_text ~* 'verteilung'                                    then 'Verteilung'
      when announcement_text ~* 'aufhebung'                                     then 'Aufhebung'
      when announcement_text ~* '(einstellung|mangels masse|masseunzul)'        then 'Einstellung'
      when announcement_text ~* 'restschuldbefreiung'                           then 'Restschuldbefreiung'
      when announcement_text ~* '(vergütung|verguetung)'                        then 'Vergütungsfestsetzung'
      else null end,
    announcement_type_hint_source = 'text_regex'
where announcement_type_hint is null
  and announcement_text is not null and length(trim(announcement_text)) > 0;
```
Expected yield: small (≈145 via `Vergütung`, plus whatever else the texts contain).
This does **not** resolve the ~9,866 rows that have neither hint nor text.

### Stage 2 — Re-ingestion (the real fix for cause A)
The only correct fix for the ~9,866 type-less, text-less rows is **upstream**:
re-run the Bekanntmachungen ingestion so `announcement_type_hint` (and
`announcement_text`) are captured at scrape time, keyed by `content_hash` /
`source_url` / `case_number` for idempotent upsert. This is an ingestion-pipeline
task, out of scope for the cockpit repo; tracked here for visibility.

### Stage 3 — Validation
Re-run the read-only diagnostics; confirm the share of latest-per-case rows with
`fn_cockpit_phase_label(...) = 'unknown'` drops, and that no high-priority
(acquisition-window) case is mislabeled by the regex backfill (spot-check a sample).

## Non-goals / guardrails
- No overwrite of the scraped `announcement_type_hint` column.
- No AI calls, no fabricated types — regex only, on text already present.
- No RLS / grant changes. No new public exposure of `announcement_text`.
- Nothing in this plan is executed by migration `0035`.
