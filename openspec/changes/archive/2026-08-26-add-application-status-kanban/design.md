## Context

See proposal.md — Why.

All changes land in `src/JobScorecard.jsx`. The existing file uses local `useState` for all state, plain inline styles, and the palette constants from PRODUCT_SPEC.md §6. The job array lives in `jobs` state; each element is `{ id, name, url, scores, rationale, ... }`. The `PUT /api/offers` endpoint writes the whole `{ criteria, weights, jobs }` object and accepts any extra fields on job objects without validation.

## Goals / Non-Goals

**Goals:**
- Three new job fields (`status`, `appliedAt`, `statusNote`) initialised with safe defaults on load
- Status dropdown in the existing tile view
- Ranking / Board toggle below the accordions
- Board view: 4 fixed columns, compact cards, status-change dropdown on each card
- `appliedAt` set/cleared automatically on status transition to/from `"applied"`

**Non-Goals:**
- Drag-and-drop between columns (deferred — dropdown is sufficient for v1)
- Persisting the active view across reloads
- `statusNote` editing from the board card (editable from the tile only in v1 — board card shows it read-only)
- Server validation of new fields

## Decisions

### D1: Status change handler is centralised

A single `updateJobStatus(id, newStatus)` function handles the transition logic: sets `status`, sets/clears `appliedAt`, and calls `setJobs`. Both the tile dropdown and the board card dropdown call this function — no duplicated transition logic.

### D2: Board columns are derived from `jobs` on each render

No separate `columns` state. The board renders by filtering `jobs` into four buckets on each render, sorted by score descending within each bucket. This keeps the data model flat (one `jobs` array) and means the board always reflects the current state without synchronisation.

### D3: `statusNote` is edited in the tile, shown read-only on the card

The board card is intentionally compact. Adding an editable textarea to the card makes the kanban cluttered. The tile (expanded view in ranking mode) already has room for a small text input. Board cards show `statusNote` as a single read-only line — if the user wants to edit it, they switch to ranking view or open the tile.

*Alternative considered*: inline edit on the board card via click-to-edit. Rejected — adds interaction complexity for a field that changes infrequently.

### D4: "Applied N days ago" computed from `appliedAt` at render time

No caching of the days value. `Math.floor((Date.now() - new Date(appliedAt)) / 86400000)` is cheap and always current. Falls back gracefully: if `appliedAt` is absent or unparseable, the line is simply omitted.

### D5: Score badge colour thresholds match existing ranking list

The ranking list already uses colour-coded score numbers. The board card uses the same thresholds (≥80 blue, 65–79 green, <65 yellow) using the same palette constants so the two views feel like one system.

### D6: View toggle state is `useState("ranking")`

Session-only, not persisted. Ranking is the default — it's the primary decision-support view; the board is a tracking overlay. A user returning to the app is most likely to want the current score rankings, not the pipeline board.

## Risks / Trade-offs

**`JobScorecard.jsx` grows further** → The file is already ~700 lines. Adding the board view (another ~80–100 lines) keeps it manageable but moves it closer to a split point. Acceptable for v1; if a future feature adds similar scope, extract a `KanbanBoard.jsx` component then.

**`statusNote` not editable from board** → A user who wants to update their note while looking at the board must switch views. Acceptable given the low frequency of note edits; can be added later with a modal or inline-edit pattern.
