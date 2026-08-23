# CLAUDE.md — instructions for Claude Code

This file is read by Claude Code when working in this repo. Keep it short and
current; update it whenever you change architecture, conventions, or known
issues below.

## What this project is

A single-page React tool ("Career Compass") for scoring job offers against a
**user-defined** set of values criteria, elicited via a chat interview on
first run. Full context is in `PRODUCT_SPEC.md` — read that first for the
"why," this file is the "how."

## Current state of the repo

Scaffolded as a Vite project, with a small Express proxy alongside it:

```
job-scorecard/
├── src/
│   ├── JobScorecard.jsx   ← main scorecard UI
│   ├── ValuesInterview.jsx ← chat interview + criteria review/edit UI
│   ├── App.jsx            ← trivial wrapper, renders <JobScorecard />
│   └── main.jsx           ← Vite/React entry point
├── server/
│   ├── index.js           ← Express proxy: /api/analyze, /api/fetch-jd,
│   │                         /api/offers (persistence), /api/values-chat,
│   │                         /api/values-synthesize
│   └── data/offers.json   ← persisted criteria/weights/jobs (gitignored)
├── public/compass.svg     ← favicon
├── index.html
├── vite.config.js         ← proxies /api/* to Express on :8787 in dev
├── package.json
├── .env.example           ← copy to .env, fill in ANTHROPIC_API_KEY
├── PRODUCT_SPEC.md
└── CLAUDE.md
```

## Values interview

On first load (no saved `criteria`), `JobScorecard` renders `ValuesInterview`
instead of the scorecard. The interview has two phases:

1. **Chat** — calls `POST /api/values-chat` (body `{ messages }`), which
   injects a system prompt for a warm/adaptive career coach and returns
   `{ reply }` (~500 tokens). The "Build my scorecard" button appears after
   ≥1 exchange and is always user-triggered.
2. **Review** — calls `POST /api/values-synthesize` (body `{ messages }`),
   which produces `{ criteria: [{key,label,hint,weight}], summary }` (~1800
   tokens, strict JSON). The user can rename/reweight/add/remove rows before
   confirming. Keys are re-derived from labels via `slugify+dedupe` on every
   edit — never directly user-editable (avoids key-collision footgun).

On confirm, `JobScorecard.completeValuesInterview` sets `criteria`/`weights`,
backfills existing jobs with default scores for new criterion keys, and clears
`interviewMode`. A "Redefine my values" button in the header sets
`interviewMode = true` without nulling criteria — so a reload mid-redefine
restores the previous scorecard intact, not the interview.

## JD analyzer — backend proxy (resolved)

`JobScorecard.jsx`'s `analyzeJD` now calls `fetch("/api/analyze", ...)`,
which Vite's dev server proxies to `server/index.js` (Express, port 8787,
overridable via `PORT` env var). That server holds `ANTHROPIC_API_KEY`
server-side (from `.env`, never committed) and does the actual Anthropic
Messages API call, including the prompt construction and the JSON-extraction/
retry logic that used to live in the frontend. The frontend POSTs
`{ jdText, criteria }` (using the current dynamic criteria, not a fixed
constant) and gets back parsed `{ role_title, company, scores, rationale }`
or `{ error }`.

**Do not** move the API key or the `fetch("https://api.anthropic.com/...")`
call back into frontend code — that was the original bug (key-less browser
call, works only inside Claude.ai's artifact sandbox).

If `ANTHROPIC_API_KEY` is unset, the server returns a clean 500 with an
explanatory message rather than crashing — the frontend surfaces it via the
existing `analyzeError` state.

The model id is `ANTHROPIC_MODEL` (env var, defaults to
`claude-sonnet-4-5-20250929` in `server/index.js`) — bump this in `.env` if a
newer model should be used; don't hardcode a different default without
checking current model ids first.

## JD from URL

`POST /api/fetch-jd` (also in `server/index.js`) takes `{ url }`, fetches it
server-side (avoids CORS, keeps this out of the browser), and runs it through
`jsdom` + `@mozilla/readability` to extract article-style text — same
approach as Firefox Reader View. Returns `{ title, text }` or `{ error }`.

The frontend's "Fetch text" button (next to the JD textarea) calls this and
just sets `jdText` to the result — the fetched text is shown in the same
textarea the user would otherwise paste into, so it's visible/editable
before hitting "Analyze." No separate preview component by design.

Known failure mode: JS-rendered job boards (many ATS SPAs) return near-empty
`textContent` since Readability only sees the initial server-rendered HTML.
The endpoint detects this (< 200 chars) and returns a clear error suggesting
paste-instead, rather than silently returning garbage. Don't try to fix this
with a headless-browser dependency (Puppeteer/Playwright) without checking
with the user first — that's a meaningfully heavier dependency for a
single-user tool.

## Persistence (resolved)

`GET/PUT /api/offers` in `server/index.js` reads/writes a single JSON file,
`server/data/offers.json` (dir created on first write; gitignored — personal
data, not source). Shape: `{ criteria, weights, jobs }`. Writes go to a
`.tmp` file then get renamed, so a crash mid-write leaves no corrupt file.

`JobScorecard.jsx` loads once on mount (`useEffect`); hydrates `criteria`,
`weights`, and `jobs` if `criteria` is a non-empty array (missing `criteria`
— including the old pre-interview schema — means "not onboarded," routes to
the interview). Debounce-saves 500ms after any change, **gated on `!loaded ||
!criteria`** so mid-interview state never clobbers a valid save. `PUT`
requires non-empty `criteria` — the server returns 400 without it.

Deliberately NOT persisted: which panels are expanded, in-progress JD
text/URL input fields — only the offer data itself. If the save fails (e.g.
API server not running), a small error line appears under the header;
the frontend doesn't retry automatically, the next successful edit will.

This makes the API server required for full functionality now, not just the
JD analyzer — see Commands below, always run `dev:all` for real use.

## Conventions to preserve

- **Styling:** plain inline `style={{ ... }}` objects, no CSS framework, no
  Tailwind. This was a deliberate choice to keep it a single portable file.
  If the project grows, migrating to CSS modules or Tailwind is reasonable,
  but don't introduce a styling library half-way without converting
  everything — mixed styling approaches make this file harder to reason
  about, not easier.
- **Colors:** reuse the existing palette constants rather than inventing new
  hex values ad hoc (see `PRODUCT_SPEC.md` §6 for the palette and rationale).
- **Component split:** the app is now two files — `JobScorecard.jsx` (main
  scorecard) and `ValuesInterview.jsx` (interview flow). Don't fold them back
  into one without checking — the split is deliberate (see design.md in the
  OpenSpec change).
- **State:** everything is local component state (`useState`), no Redux/
  Zustand/context needed at this scale. Don't introduce state management
  libraries unless the feature genuinely requires cross-tree sharing.
- **Criteria are user-defined, not fixed.** `criteria` is `useState(null)` in
  `JobScorecard`; null means "not onboarded yet," which routes to the
  interview. Never re-introduce a hardcoded `CRITERIA` constant — dynamic
  criteria are now the foundation of the whole scoring/persistence model.

## Commands

```bash
npm install                # once
cp .env.example .env       # then fill in ANTHROPIC_API_KEY
npm run dev:all            # runs Vite (5173) + Express API (8787) together — use this
npm run dev                # Vite only — JD analyzer and persistence won't work
npm run server              # Express API only
npm run build               # production build (frontend only; server ships separately)
```

No test suite exists yet. If adding one, Vitest is the natural fit for a
Vite project.

## When making changes

- This is a personal tool for one user, not a product with external users —
  favor simplicity and directness over generalization/configurability.
- Check `PRODUCT_SPEC.md`'s Roadmap section before proposing new features;
  it may already be scoped there.
- If you change the scoring formula, weighting defaults, or criteria list,
  update `PRODUCT_SPEC.md` in the same change so the spec doesn't drift from
  the code.
