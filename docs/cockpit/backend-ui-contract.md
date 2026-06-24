# Cockpit Backend ↔ UI Contract

> **Purpose.** Single source of truth for the upcoming Cockpit UI. Every frontend
> module lists the **exact** backend objects (views, RPCs, Edge Functions,
> server actions) it is allowed to use, plus the security rules and the fields
> that must never be exposed. Names here are verified against the live code and
> applied migrations (`swift_v2` schema, project `hqyktreytsjeirlpnnyr`).
>
> **Golden rules (apply to every module):**
> - Frontend talks to the DB only through the `@supabase/ssr` clients
>   (`lib/supabase/client.ts`, `lib/supabase/server.ts`) under the user's RLS.
>   **Never** use `service_role` in any frontend/client/server-action code.
> - All reads go through `v_cockpit_*` views; all writes go through
>   `cockpit_*` SECURITY DEFINER RPCs or the deployed Edge Functions.
> - **No raw source tables** from the frontend. No direct OpenAI/Gemini calls
>   from the browser. No email sending / SMTP / `mailto:`.
> - Never render: `source_snapshot`, the outreach `metadata` jsonb blob, raw
>   announcement text, debtor/deceased private address, birth dates, detection
>   reasoning, or fabricated financial figures.

---

## A. Cockpit Auth & Roles Contract

| Concept | Rule |
|---|---|
| Active profile | A row in `swift_v2.cockpit_user_profiles` with `is_active = true` for `auth.uid()`. All cockpit views/RPCs gate on this. |
| Self-read | `lib/cockpit/profile.ts → getCockpitProfile()` reads the caller's own profile (RLS self-read: `user_id = auth.uid()`). |
| Roles | `role ∈ {viewer, analyst, lead, admin}` (USER-DEFINED enum). Read-only contexts allow any active role (`_cockpit_active_role()`); **writes require analyst/lead/admin** (`_cockpit_writer_role()` → raises `insufficient_role`). |
| Admin | `admin` is the highest writer role. Admin-only management UI is **deferred** (section J). |
| `nachlass_authorized` | Boolean on `cockpit_user_profiles`. Required for ANY Nachlass row/data (watchlist Nachlass rows, Nachlass drafts, Nachlass review views, Nachlass AI snapshot). |
| Auth method | Supabase Auth **Magic Link** only. **No public signup.** Middleware (`middleware.ts`) gates `/cockpit/*`; unauthenticated → `/login`. |
| service_role | **Never** in frontend. Edge Functions use the **caller's JWT + anon key**, not service_role. |
| Missing access UX | If no active profile → show "Kein aktiver Cockpit-Zugang." If not `nachlass_authorized` → Nachlass rows simply do not appear (views return 0 rows); UI shows nothing Nachlass-specific, never an error that leaks existence. Writer-role failures → "Keine Berechtigung." |

---

## B. Dashboard Contract

| Item | Value |
|---|---|
| Allowed views | `v_cockpit_system_health`, `v_cockpit_data_coverage_summary` |
| Query helper | `lib/cockpit/dashboard.queries.ts` |
| Allowed RPCs | none (read-only views) |
| Components | `components/cockpit/dashboard-card.tsx`, `system-health-list.tsx`, `status-badge.tsx` |
| Fields (coverage) | safe aggregates only — counts/rates/timestamps/status labels (e.g. `entities_*`, `announcements_*`, `natural_person_normal_sensitivity`, `company_public_eligible`). |
| Fields (health) | safe operational metrics — dead-letter/pending/running/overdue counts, `age_days`, `last_status`, `source_available`, safe timestamps. `details` jsonb is allowed in the internal UI but **only** the safe label/whitelist fields; never raw SQL errors/API payloads. |
| Readiness | **Ready** for UI PHASE 1 (both views live, helper exists, fail-safe to `available:false`). |
| Known gaps | None blocking. Live numbers depend on ingestion jobs; show empty/zero states gracefully. |

---

## C. Watchlist Contract

| Item | Value |
|---|---|
| Allowed views | `v_cockpit_watchlist_internal` (enriched acquisition view, primary), `v_cockpit_my_watchlist` (basic fallback) |
| Query helpers | `lib/cockpit/watchlist-internal.queries.ts`, `lib/cockpit/watchlist.queries.ts`; client-safe constants in `lib/cockpit/watchlist.ts` |
| Server actions | `app/cockpit/watchlist/actions.ts`: `watchCompanyAction`, `watchNachlassAction`, `removeFromWatchlistAction`, `updateStatusAction`, `updateNoteAction`, `setFollowUpAction`, `clearFollowUpAction`, `searchCompaniesAction` |
| Underlying RPCs | `cockpit_watch_company`, `cockpit_watch_nachlass`, `cockpit_unwatch_company`, `cockpit_unwatch_nachlass`, `cockpit_watchlist_update` |
| Components | `watchlist-acquisition-filtered-table.tsx`, `watchlist-acquisition-row.tsx`, `watchlist-add-panel.tsx`, `watchlist-filtered-table.tsx`, `watchlist-row.tsx` |
| Row key | `v_cockpit_watchlist_internal.subject_id` = the RPC subject (company `entity_id` / nachlass `detection_id`); `watch_id` keys outreach/draft context. |
| Statuses | `watching`, `pursuing`, `passed` (see `STATUS_OPTIONS`). Plus per-row: note, `next_follow_up_at`. |
| Company behavior | Real `display_title` (company name), city/Bundesland, court/Aktenzeichen, administrator contact, HR status. |
| Nachlass behavior | Only `safe_display_label` ("Nachlass · Az. …"); `display_title` is null. Rows appear **only** for `nachlass_authorized` users. |
| Must NOT expose | raw announcement text, debtor/deceased name *(in the watchlist view itself)*, birth dates, private addresses, Bundesanzeiger figures (status label only: `retired`/`unavailable`). |
| Readiness | **Ready** for UI PHASE 1. |

---

## D. Tasks Contract

| Item | Value |
|---|---|
| Allowed view | `v_cockpit_my_tasks` |
| Query helper | `lib/cockpit/tasks.queries.ts`; client-safe helpers in `lib/cockpit/tasks.ts` (`openTaskContextKeys`, `hasOpenTaskForContext`) |
| Server actions | `app/cockpit/tasks/actions.ts`: `createTaskAction`, `updateTaskAction`, `completeTaskAction`, `reopenTaskAction`, `archiveTaskAction` |
| Underlying RPCs | `cockpit_create_task`, `cockpit_update_task`, `cockpit_complete_task`, `cockpit_reopen_task`, `cockpit_archive_task` |
| Components | `task-create-form.tsx`, `task-row-actions.tsx`, `create-task-from-context-button.tsx` |
| Statuses | `open`, `in_progress`, `waiting`, `done`, `archived`. Types incl. `follow_up`, `review`, `outreach`, … Priority `low/medium/high/urgent`. |
| Context linking | `related_kind` + `related_id` (e.g. `company`/`nachlass`/`watchlist`) link a task to a watchlist subject. UI uses `hasOpenTaskForContext()` to avoid duplicate "Follow-up" tasks (button shows existing instead of creating). |
| Readiness | **Ready** for UI PHASE 1. |

---

## E. Outreach Drafts Contract

| Item | Value |
|---|---|
| Allowed view | `v_cockpit_outreach_drafts` |
| Query helper | `lib/cockpit/outreach.queries.ts` (`getOutreachDrafts`, `activeOutreachDraftKeys`, `outreachDraftKey`) |
| Server actions | `app/cockpit/email-drafts/actions.ts`: `createOutreachDraftFromWatchlistAction`, `updateOutreachDraftAction`, `markOutreachDraftReadyAction`, `archiveOutreachDraftAction`. AI generation: `app/cockpit/outreach-ai/actions.ts → generateAiOutreachDraftAction` (see G). |
| Underlying RPCs | `cockpit_create_outreach_draft_from_watchlist` (manual template), `cockpit_update_outreach_draft`, `cockpit_mark_outreach_draft_ready`, `cockpit_archive_outreach_draft`, `cockpit_store_ai_outreach_draft` (AI; written by the Edge Function). |
| Components | `outreach-create-button.tsx`, `outreach-draft-card.tsx`, `ai-outreach-create-button.tsx` |
| Safe fields | `draft_id, watch_kind, watch_id, entity_id, detection_id, recipient_name, recipient_email, recipient_source, subject, body, language, status, created_by(_name), updated_by(_name), created_at, updated_at, archived_at, event_count, latest_event_at, generation_mode, ai_model_name` |
| Manual vs AI | `generation_mode = 'manual'` (template RPC) vs `'ai'` (Edge Function). `ai_model_name` set for AI drafts (e.g. `gpt-4o-mini`). |
| Statuses | `draft`, `ready`, `archived`, `sent_external_later`. Drafts are **editable and never auto-sent**. |
| Must NOT expose | the `metadata` jsonb blob (view exposes only `generation_mode` + `ai_model_name` derived from it). **No email send, no SMTP, no `mailto:`.** "Ready"/"sent_external_later" are manual status labels only — they do **not** send anything. |
| Readiness | **Ready** for UI PHASE 1 (read/edit/archive/mark-ready). |

---

## F. AI Case Review Contract

| Item | Value |
|---|---|
| Allowed view | `v_cockpit_ai_case_reviews` (EXCLUDES `source_snapshot`) |
| Query helper | `lib/cockpit/ai-reviews.queries.ts` (`getAiCaseReviews`, `activeAiReviewByWatchKey`, `aiReviewKey`) |
| Server action | `app/cockpit/ai-reviews/actions.ts → generateAiCaseReviewAction(kind, watchId)` — invokes the Edge Function only. |
| Edge Function | `generate-watchlist-ai-review` (ACTIVE, `verify_jwt=true`) |
| Lifecycle RPCs (Edge-only) | `cockpit_create_ai_case_review_request`, `cockpit_get_ai_case_review_source_snapshot`, `cockpit_store_ai_case_review_result`, `cockpit_fail_ai_case_review`, `cockpit_archive_ai_case_review`. **Frontend never calls these directly** — only the Edge Function does, under the user JWT. |
| Component | `ai-review-section.tsx` |
| Statuses | `pending`, `generated`, `failed`, `archived` |
| Fields | `acquisition_score` (0–100), `priority` (low/medium/high/urgent), `confidence` (low/medium/high), `summary_de`, `summary_ar`, `reasoning_ar`, `risk_flags[]`, `recommended_next_action`, `model_provider`, `model_name`, timestamps. |
| Must NOT expose | `source_snapshot` (not in the view at all), raw provider response, prompt internals. |
| Readiness | UI **Ready** to display + trigger; real generation requires an authenticated session + watchlist row + provider key. |

---

## G. AI Outreach Email Draft Contract

| Item | Value |
|---|---|
| Edge Function | `generate-outreach-email-draft` (ACTIVE, `verify_jwt=true`) |
| Server action | `app/cockpit/outreach-ai/actions.ts → generateAiOutreachDraftAction(kind, watchId, replaceExisting?)` |
| RPCs (Edge-only) | `cockpit_get_outreach_ai_snapshot`, `cockpit_has_active_outreach_draft` (preflight), `cockpit_store_ai_outreach_draft` |
| Component | `ai-outreach-create-button.tsx` ("KI-E-Mail-Entwurf erstellen") |
| Company behavior | Company name (`display_title`) + Aktenzeichen permitted in the email. |
| Nachlass behavior | **Internal only; `nachlass_authorized` required.** Deceased **name** permitted for case identification (structured `debtor_name`). Deceased **birth date currently unavailable → always null** (no source column exists). **No private address, no city, no raw announcement text, no excerpt, no detection reasoning.** |
| Preflight guard | If an active (non-archived) draft exists and `replace_existing` is not true, the function returns `active_draft_exists` **before** any AI call (token-saving). The store RPC keeps the authoritative duplicate guard. |
| Overwrite | **No overwrite by default.** Replacement only with explicit `replace_existing = true` (archives prior active drafts, audited). |
| Output | Saved as a normal `draft` (`generation_mode='ai'`); recipient derived server-side from the authoritative view (AI's recipient is **not** trusted). |
| Must NOT expose | `source_snapshot`, `metadata` blob, provider key. **No email send.** |
| Readiness | UI **Ready** to trigger; real generation gated on authenticated session + provider key. |

---

## H. Nachlass Security Contract

| Item | Value |
|---|---|
| Views | `v_cockpit_nachlass_review_full`, `v_cockpit_nachlass_review_queue` (locked down in migration `0031`). |
| Visibility | Rows visible **only** to active cockpit users with `nachlass_authorized = true` (WHERE EXISTS gate; anon/non-authorized = 0 rows). |
| Sensitivity warning | `v_cockpit_nachlass_review_full` contains `deceased_name`, `deceased_city`, `source_excerpt`, `detection_reasoning_ar`, `announcement_text`, `source_url`, administrator contact — **internal review only**. |
| Public portal | **Must never** use these views or any Nachlass natural-person data. |
| UI PHASE 1 | These review views are **not** part of UI PHASE 1; a Nachlass review screen is a later, `nachlass_authorized`-gated phase. |

---

## I. System Operations / Data Coverage Contract

| Item | Value |
|---|---|
| Query helpers | `lib/cockpit/operations.queries.ts`, `lib/cockpit/dashboard.queries.ts` |
| Views in use | `v_cockpit_system_health`, `v_cockpit_data_coverage_summary`, `v_cockpit_enrichment_jobs`, `v_cockpit_review_inbox`, `v_daily_run_log`, `v_cockpit_companies`, `v_public_insolvency_statistics` |
| Readiness | System-health + data-coverage cards **Ready** for the dashboard. |
| UI PHASE 1 should show | Dashboard summary cards (coverage + health), read-only. |
| Deferred | Full System Operations Inbox / review-inbox triage UI, daily-run-log drill-down → later phase (read views exist but UI is out of scope for PHASE 1). |

---

## J. Deferred Modules (explicitly NOT in scope yet)

- Controlled email **sending** and SMTP / actual outbound email.
- Deal Communication Inbox.
- System Operations Inbox (full triage implementation).
- Calendar integration.
- Broader audit-log viewer.
- Admin role-management UI (assign roles / `nachlass_authorized`).
- Public portal launch / legal review (separate legacy app — never touched here).
- Nachlass review-screen UI (gated; later phase).
