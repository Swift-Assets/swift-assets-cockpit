# Design review — Glass theme

Screenshots captured from the running dev server (headless Chromium, 1440×
viewport, 2× DPI) for reviewing the dark "cockpit glass" theme without needing
a live Supabase session.

| File | What it shows |
| --- | --- |
| `dashboard-glass.png` | `/theme-preview` — dashboard layout + all new shared glass components (KPI cards, gradient buttons, soft tinted badges, solid-surface table, gradient progress, pulsing "Live" tag, spinner, toasts) rendered with mock data. |
| `login-glass.png` | `/login` on the new dark canvas (not yet restyled — pending the page-by-page pass). |

These images are review artifacts. This whole folder — and the temporary
`app/theme-preview/` page — will be removed once every page is restyled and
approved.
