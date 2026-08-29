## Why

The job scout (`agent/scout.js`) uses `claude-opus-5` for its outer loop and makes a separate `claude-sonnet-4-6` call per JD scored — both expensive. The full JD text (up to 8 000 chars) currently enters the opus context window twice per listing: once as the result of `fetch_jd` and again as the argument to `score_jd`, paying full token price both times. The server-side chat endpoints (`values-chat`, `values-synthesize`) also re-transmit their large system prompt on every turn without caching. Adding prompt caching to the stable content and merging the two scout tools eliminates the bulk of repeated token spend.

## What Changes

- **`server/index.js`** — `callAnthropic` is extended to accept `system` as a string **or** a pre-built array of content blocks (passthrough). `VALUES_INTERVIEWER_SYSTEM` is wrapped in a single-element array with `cache_control: {type: "ephemeral"}` so both `/api/values-chat` and `/api/values-synthesize` cache the system prompt across turns. The values-chat endpoint also adds `cache_control` to the last message in the incoming `messages` array, so the growing conversation history is cached on each subsequent turn (shared-prefix pattern).

- **`agent/scout.js`** — system prompt (CV + criteria block) is changed from a bare string to an array with `cache_control: {type: "ephemeral"}`, so the large stable block is cached across every turn of the opus agentic loop. The `fetch_jd` and `score_jd` tools are merged into a single `fetch_and_score_jd(url)` tool; opus passes only the URL and receives only the score result — the JD text never enters the opus context. Token usage (cache creation + cache read tokens) is logged at the end of each scout run so caching can be verified.

## Capabilities

### New Capabilities

_(none — this change touches only infrastructure/API-calling code, not user-visible behavior or persisted data shape)_

### Modified Capabilities

_(none — no spec-level behavioral requirements change; caching is an implementation detail invisible to the user, and the tool merge produces identical end-results: the same offers are saved, the same scores computed)_

> This change contains no capability requirement deltas. Setting `skip_specs: true` is appropriate.

## Impact

- **`server/index.js`** — `callAnthropic` signature change (backward-compatible: string `system` still works), `VALUES_INTERVIEWER_SYSTEM` object shape change (string → array), `values-chat` message mutation before forwarding to API.
- **`agent/scout.js`** — `fetch_jd` and `score_jd` tools removed; `fetch_and_score_jd` added. System prompt parameter changed from string to array. Scout prompt updated to reference the combined tool. Token-usage log line added at run end.
- No changes to the frontend, persistence schema, or API contracts.
- No new npm dependencies.
