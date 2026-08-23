# Career Compass — Job Offer Scorecard

## Product spec

### 1. Purpose

A personal tool for evaluating job offers/postings against a **user-defined**
set of values criteria, so decisions are made against explicit, personally
meaningful criteria rather than gut feel or any one company's pitch.

Single user (Sara). Not a multi-tenant product. No auth, no backend database
required for the core scorecard — everything lives in component state for a
session, persisted to a local JSON file between sessions.

### 2. Values criteria (user-defined)

Criteria are produced by a **chat-style interview** on first run: the app
interviews the user about their priorities, synthesizes 4–7 criteria, and
presents them for review/editing before adoption. The user can rename,
reweight, add, or remove criteria before confirming.

Each criterion has the shape `{ key, label, hint, weight }`:
- `key` — auto-derived slug (e.g. `"financial-stability"`), never directly
  edited — re-derived from label on every change to prevent key collisions
- `label` — short human name shown in the UI (e.g. "Financial stability")
- `hint` — one-sentence description shown under each slider
- `weight` — 1–5, set by the model and user-adjustable at any time

The user can redefine their criteria at any time via "Redefine my values" in
the header. Redefinition does not destroy existing scores mid-process —
the current scorecard is preserved until the new one is confirmed.

### 3. Scoring model

- Each offer gets a 0–10 score per criterion (manual slider, or auto-filled
  by the JD analyzer — see below).
- Each criterion has a weight, 1–5, user-adjustable after initial synthesis.
- **Weighted total** = `Σ(weight × score) / Σ(weight × 10) × 100`, i.e. a
  percentage of the maximum possible weighted score. This normalizes total
  score to 0–100 regardless of how weights are distributed, so totals stay
  comparable even after the user changes weights.
- Offers are ranked by weighted total, descending, whenever 2+ offers exist.

### 4. JD auto-scoring (AI-assisted first pass)

- User either pastes a full job description into a textarea, or pastes a
  URL and clicks "Fetch text" to pull it in automatically (`POST
  /api/fetch-jd` — server-side fetch + Readability extraction, see below).
  The fetched text populates the same textarea, visible and editable, before
  analysis — it's a convenience for filling the box, not a separate flow.
- The app sends the JD + criteria definitions to Claude (via the Anthropic
  Messages API) with a prompt asking for a strict JSON object: scores 0–10
  per criterion, extracted role title/company, and a short rationale.
- Response is parsed and used to create a new offer entry, pre-filled with
  those scores; user is expected to review/adjust manually afterward. This
  is explicitly framed in the UI as "a first pass, not a verdict" — a JD
  cannot reveal things like real team stability or actual decision authority,
  which need to come from conversations, not the posting text.
- **Resolved:** the frontend calls `POST /api/analyze` (proxied by Vite to a
  local Express server, `server/index.js`), which holds the Anthropic API key
  server-side and does the actual model call. See CLAUDE.md for the current
  structure and how to run it (`npm run dev:all`, needs `.env` with
  `ANTHROPIC_API_KEY`).
- **URL-fetch limitation:** `/api/fetch-jd` does a plain server-side fetch —
  it can't execute JavaScript, so job boards that render postings client-side
  (many SPA-style ATSs) or that block non-browser requests will fail with a
  "couldn't extract enough text" error. Pasting the JD text remains the
  reliable fallback in that case.

### 5. Data persistence

Criteria, weights, offers, scores, and notes are persisted server-side as a
single JSON file (`server/data/offers.json`, gitignored — personal job-
search data, not project source). Shape: `{ criteria, weights, jobs }`.
On load, the app fetches `GET /api/offers` and hydrates from it. Missing
or empty `criteria` in the saved file means "not onboarded" — the app
routes to the values interview. Every change debounce-saves via `PUT
/api/offers` (500ms after the last edit), gated on criteria being non-null
so mid-interview state never clobbers a valid save.

This means the API server (`npm run dev:all`, not just `npm run dev`) is
now required for full functionality, not only for the JD analyzer — without
it, offers still work in-session but nothing survives a refresh, and a
small error line appears under the header noting the save failed.

UI-only state (which panels are expanded, in-progress JD text/URL fields)
is intentionally NOT persisted — only the offer data itself.

### 6. Visual design

- Dark theme: ink background (`#161B27`), card surfaces (`#1E2433`), hairline
  borders (`#2C3348`).
- Accent palette per-offer for chart/ranking differentiation: amber
  `#E8B04B`, teal `#4FA89B`, terracotta `#C97064`, indigo `#8A8FD1`, green
  `#6FBF73`.
- Headings in serif (Georgia), UI chrome/labels in system sans-serif — a
  deliberate "field notes / compass" feel rather than a generic SaaS
  dashboard look.
- Radar chart (Recharts) is the signature visual: one axis per criterion,
  one overlaid shape per offer, so shape differences are visible at a
  glance rather than reading a table of numbers.

### 7. Out of scope (for now)

- No login/multi-user support.
- No integration with job boards/ATS.
- No mobile-native app — this is a web artifact/React component only.
- No enforcement of the €120k floor as a hard gate (see Roadmap).

### 8. Roadmap / candidate next features

1. Flag/warn (not block) any offer scoring below the stability floor.
2. ~~Persist offers to `localStorage` or a small backend so history survives
   refresh~~ — done, JSON-file backend (see §5, CLAUDE.md).
3. Export a comparison as PDF/markdown for note-taking or discussion with a
   partner.
4. ~~Proper backend proxy for the JD analyzer so it works outside Claude.ai~~
   — done (see CLAUDE.md).
5. ~~Optional: let weights be saved as named presets~~ — superseded by dynamic
   criteria; each criteria set carries its own weights from synthesis.
