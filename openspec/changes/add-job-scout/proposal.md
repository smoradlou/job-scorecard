## Why

Once the scorecard has user-defined criteria, the natural next step is automating
the top-of-funnel: instead of manually pasting JDs, a scout agent can search
the web for matching listings, score each one, and add the above-threshold ones
directly to the scorecard — without the Express server needing to be running.

## What changes

- **`agent/scout.js`** (new): a standalone Claude Opus 5 agent that:
  - Reads scoring criteria and weights from `server/data/offers.json` directly
    (no HTTP dependency on the Express server)
  - Reads the candidate profile from `agent/cv.md`
  - Searches for job listings via Anthropic's server-side `web_search_20260209`
    tool (no external search API key required)
  - Fetches and extracts JD text using the same jsdom + Readability logic
    already in `server/index.js`
  - Scores each JD with a separate Anthropic API call (same scoring prompt as
    `/api/analyze`), computing the same weighted total used by the UI
  - Deduplicates via `agent/seen.json` so listings aren't re-evaluated across
    runs
  - Saves above-threshold offers directly to `server/data/offers.json` (same
    atomic write pattern as the server)
  - Uses `@anthropic-ai/sdk` with `client.beta.messages.toolRunner` and
    `betaTool` (raw JSON Schema, no Zod) for the agentic loop; handles
    `pause_turn` from the server-side search tool

- **`package.json`**: adds `@anthropic-ai/sdk` to dependencies; adds
  `"scout": "node agent/scout.js"` script

- **`.gitignore`**: adds `agent/cv.md` and `agent/seen.json` (personal data
  — CV content and seen-URL log)

- **`agent/cv.md`**: template (already created; user fills in their profile)

## No breaking changes

The scout writes to the same `server/data/offers.json` file that the app
reads; the file shape is unchanged. The app picks up saved offers on the next
load or after the next debounced save. The scout can run independently of the
app and the Express server.

## Threshold

Default: `SCOUT_THRESHOLD=70` (env var). Reasoning: current top offer
(Zalando) scores 70, so this finds offers at least as good. Lower to 65 to
also surface near-matches.

## Scoring model

`score_jd` uses `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) — the same
env var as the Express server. The outer scout loop uses `claude-opus-5`
(hardcoded) for its superior agentic reasoning.
