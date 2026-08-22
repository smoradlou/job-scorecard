# Career Compass — Job Offer Scorecard

## Product spec

### 1. Purpose

A personal tool for evaluating job offers/postings against a fixed set of
personal values, so decisions are made against explicit criteria rather than
gut feel or the persuasive framing of any one company's pitch.

Single user (Sara). Not a multi-tenant product. No auth, no backend database
required for the core scorecard — everything lives in component state for a
session.

### 2. Core values / criteria

Six fixed criteria, derived from a personal values exercise (Financial
stability, Security, Control, Courage, Curiosity) plus one practical
constraint (Canada relocation path). These are NOT meant to be user-editable
in the UI — they're intentionally fixed so scoring stays comparable across
offers evaluated months apart. If the underlying values change, edit the
`CRITERIA` constant in code directly.

| key | label | what it measures |
|---|---|---|
| `stability` | Financial stability | Base ≥ €120k (current floor), runway/profitability of employer, meaningful total comp |
| `security` | Security | Track record of team/role stability; not reorg-prone; company health |
| `control` | Control | Real technical/architectural authority; Staff/Lead-level scope vs. pure IC execution |
| `courage` | Courage | Genuinely new technical territory vs. maintenance work |
| `curiosity` | Curiosity | Frontier-adjacent work: LLM evaluation, agentic systems, RAG, research-friendliness |
| `relocation` | Canada path | Dual DE/UK + Canada offices, remote-friendly, eases planned relocation in 1.5–2 years |

The floor for `stability` (€120k base) is a hard constraint in the user's
head, not currently enforced in software — the tool scores it 0-10 but does
not block/flag offers below the floor. This is a candidate feature (see
Roadmap).

### 3. Scoring model

- Each offer gets a 0–10 score per criterion (manual slider, or auto-filled
  by the JD analyzer — see below).
- Each criterion has a weight, 1–5, user-adjustable, defaulting to:
  stability 5, security 5, control 4, curiosity 4, courage 3, relocation 3.
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

Offers, scores, weights, and notes are persisted server-side as a single
JSON file (`server/data/offers.json`, gitignored — this is personal job-
search data, not project source). On load, the app fetches `GET
/api/offers` and hydrates state from it (falling back to defaults if
nothing's saved yet, e.g. first run). Every change debounce-saves via `PUT
/api/offers` (500ms after the last edit) so typing in a notes field doesn't
hammer the disk with a write per keystroke.

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
5. Optional: let weights be saved as named presets ("early career risk
   tolerance" vs. "stability-first") rather than one fixed set.
