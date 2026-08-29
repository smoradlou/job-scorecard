## Why

The scorecard tracks which offers are worth pursuing but gives no way to track what's actually happening with each application. Once you're actively interviewing, you need to know where each process stands — and when you have several going in parallel, that's context that currently lives only in your head or a separate note. A kanban board with application status closes that gap without requiring a separate tool.

## What Changes

- **Job data shape** — each job object gains three new optional fields: `status` (`"saved" | "applied" | "interviewing" | "closed"`, default `"saved"`), `appliedAt` (ISO date string, set automatically on transition to applied, cleared on move back), and `statusNote` (free-text string for stage details like "Round 2 · take-home due Friday").
- **Existing job tile** — gains a compact status dropdown so status is editable from the current view without switching to the board.
- **View toggle** — a "Ranking / Board" switcher appears below the accordions; it controls which section renders below it.
- **Board view** — four columns (Saved / Applied / Interviewing / Offer–Closed) each showing compact job cards: role, company, score badge (color-coded), and `statusNote` when present. Status is changed via a dropdown on the kanban card. Applied cards show "Applied N days ago" derived from `appliedAt`.
- **Persistence** — the three new fields are written through the existing `PUT /api/offers` endpoint; no server changes required.

## Capabilities

### New Capabilities

- `application-status`: Job status lifecycle (saved → applied → interviewing → closed), the view-toggle between ranking and board, and the compact kanban board rendering with column grouping.

### Modified Capabilities

_(none — no existing spec-level requirements change; this adds new behavior alongside the existing scorecard)_

## Impact

- **`src/JobScorecard.jsx`** — all changes land here: new state (`viewMode`), new `status`/`appliedAt`/`statusNote` fields initialised on job load, status dropdown in existing tile, board view component, view toggle UI.
- **`server/index.js`** — no changes; the new fields pass through the existing `PUT /api/offers` body without validation changes (server accepts any extra job-object fields today).
- **`server/data/offers.json`** — existing jobs gain new fields on first save; reads without the fields fall back gracefully (`status ?? "saved"`).
- No new npm dependencies.
