# Design review — Glass theme

Artifacts for reviewing the dark "cockpit glass" theme without a live Supabase
session. Screenshots captured from the dev server via headless Chromium.

| File | What it shows |
| --- | --- |
| `theme-preview.html` | **Self-contained** snapshot of `/theme-preview` — all CSS + fonts inlined, zero external requests. Download and open directly in any browser (double-click). |
| `dashboard-glass.png` | Full `/theme-preview` — dashboard layout + every shared glass component with mock data. |
| `acquisition-card-arabic.png` | The real `<AcquisitionCaseCard>` content-safety test: left card holds a full-paragraph Arabic Firmengegenstand (grows, wraps, RTL-local, no clipping); right card is a short control showing independent growth. |
| `tasks-table-glass.png` | Dense multi-column table on the opaque solid panel (Part C) — mirrors the tasks/operations tables: quiet header, hairline rows, status/priority pills, wrap-safe secondary text. |
| `login-glass.png` | `/login` restyled into the glass system (radial-gradient background, translucent GlassCard, gradient button, bird logo kept, German LTR). |

These are review artifacts. This folder — and the temporary `app/theme-preview/`
page — will be removed once every page is restyled and approved.
