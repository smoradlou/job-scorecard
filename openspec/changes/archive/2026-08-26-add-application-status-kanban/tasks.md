## 1. Data model & state initialisation

- [x] 1.1 In the `GET /api/offers` hydration effect in `JobScorecard.jsx`, map loaded jobs to add default values for the three new fields: `status: j.status ?? "saved"`, `appliedAt: j.appliedAt ?? null`, `statusNote: j.statusNote ?? ""`. Verify that reloading the app with existing `offers.json` (which lacks these fields) shows all jobs in the Saved column with no console errors.

- [x] 1.2 Add `viewMode` state (`useState("ranking")`) to `JobScorecard`. Verify toggling it in the browser console changes the value without affecting jobs state.

## 2. Status transition logic

- [x] 2.1 Add `updateJobStatus(id, newStatus)` function: sets `status` on the matching job; sets `appliedAt: new Date().toISOString()` when `newStatus === "applied"`, clears it (`null`) when moving away from applied; leaves `statusNote` unchanged. Verify via browser console that calling it updates the job correctly and that `appliedAt` is set/cleared as expected.

## 3. Status control in existing tile view

- [x] 3.1 In the existing job tile render, add a `<select>` (or equivalent inline control) showing the four statuses (Saved / Applied / Interviewing / Offer–Closed) with the current `job.status` selected. On change, call `updateJobStatus`. Style with existing inline-style conventions (small, muted, no border radius jarring against the card). Verify changing status in the tile updates the job and persists on next debounce save.

- [x] 3.2 Add a `statusNote` text input to the tile (below the status select, only visible when `job.status` is `"applied"` or `"interviewing"`). On change, update `job.statusNote` in jobs state. Verify it saves and reloads correctly.

## 4. View toggle UI

- [x] 4.1 Add the Ranking / Board toggle below the accordions and above the ranked list / board. Two buttons, `viewMode === "ranking"` activates the first. Style to match the app's muted/surface palette — no heavy borders, a subtle background on the active pill. Verify clicking switches `viewMode` and the correct section renders below.

## 5. Board view

- [x] 5.1 Add a `scoreColor(score)` helper that returns the appropriate palette colour: blue for ≥80, green for 65–79, yellow below 65 (using existing palette constants). Verify it returns the correct colour for boundary values 80, 79, 65, 64.

- [x] 5.2 Add a `daysAgo(isoString)` helper: returns whole days since the date string, or `null` if the string is absent/unparseable. Verify it returns `0` for today, `1` for yesterday, and `null` for `null` input.

- [x] 5.3 Render the Board view when `viewMode === "board"`. It should show four column containers (Saved / Applied / Interviewing / Offer–Closed) laid out horizontally, each with a column header (label + job count). Style columns with `surface` background, `card` background for cards, matching the mockup palette. Verify all four columns render with correct headers and the job count in each header matches the number of cards.

- [x] 5.4 Within each column, render one compact card per job with matching status, sorted by score descending. Each card shows: role title (capped at ~50 chars with ellipsis), company, score badge (coloured via `scoreColor`), and `statusNote` if non-empty. For `applied` jobs, show "Applied N days ago" using `daysAgo(job.appliedAt)` — omit the line if `daysAgo` returns null. Verify all six existing mock jobs appear in the correct columns.

- [x] 5.5 Add a status `<select>` to each board card, same four options, calling `updateJobStatus`. Verify changing status on the board card immediately moves the card to the correct column without a page reload.

## 6. End-to-end verification

- [x] 6.1 Add a job via the JD analyzer, confirm it appears in Saved. Change its status to Applied via the tile dropdown, switch to Board view, confirm it's in the Applied column with "Applied 0 days ago". Change status to Interviewing, add a note in the tile, switch to Board — confirm the note appears on the card. Reload the page — confirm status, note, and appliedAt all survived the round-trip through `offers.json`.
