## 1. server/index.js — prompt caching

- [x] 1.1 Extend `callAnthropic` to accept `system` as string or array: when `system` is already an array pass it directly; when a string wrap it in `[{type:"text", text:system}]` as before (no cache_control here — the caller decides). Verify existing `/api/analyze` (no system) and `/api/values-chat` (string system) still work via `npm run server`.

- [x] 1.2 Wrap `VALUES_INTERVIEWER_SYSTEM` in a cached array block: change the constant from a plain string to `[{ type: "text", text: <existing string>, cache_control: { type: "ephemeral" } }]` and pass it directly to both `callAnthropic` calls. Verify both `/api/values-chat` and `/api/values-synthesize` return correct replies — response shape unchanged.

- [x] 1.3 Cache the conversation history in `/api/values-chat`: before forwarding `messages` to `callAnthropic`, deep-clone the array and add `cache_control: { type: "ephemeral" }` to the last content block of the last message. (When `content` is a plain string, convert to `[{type:"text", text, cache_control}]`.) Verify a two-turn conversation still returns correct replies and does not modify the caller's original array.

## 2. agent/scout.js — system prompt caching

- [x] 2.1 Change the scout system prompt from a bare string to a cached array block: replace `system: systemPrompt` with `system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]` in the `params` object passed to `toolRunner`. Verify `npm run scout` still starts without error and picks up criteria correctly.

## 3. agent/scout.js — merge fetch_jd + score_jd

- [x] 3.1 Remove `fetchJdTool` and `scoreJdTool` definitions. Add `fetchAndScoreJdTool` with `name: "fetch_and_score_jd"`, input `{ url: string }`, description "Fetch a job listing and score it against the candidate's criteria in one step. Returns role_title, company, scores, rationale, and total_score (0-100), or { error } if the page can't be fetched." The `run` function inlines the existing fetch logic from `fetchJdTool` followed by the scoring logic from `scoreJdTool` — JD text is a local variable, never returned. Verify the tool definition compiles (Node will throw on import if schema is malformed).

- [x] 3.2 Update the scout system prompt's "Workflow for each listing" to collapse steps 2 + 3 into a single step: "2. Call `fetch_and_score_jd(url)` — fetches and scores in one step. If it returns `{ error }`, skip and try the next listing." Remove the sentence describing `fetch_jd` and `score_jd` as separate tools.

- [x] 3.3 Update the `tools` array in `params` to use `[{ type: "web_search_20260209", ... }, fetchAndScoreJdTool, isSeenTool, saveOfferTool]`. Verify that `npm run scout 2>&1` runs a full scout cycle: at least one listing is found, `fetch_and_score_jd` is called (visible in model's text output or saved offer), and no "unknown tool" errors appear.

## 4. Token-usage logging

- [x] 4.1 After the scout's `for await` loop, extract and log token usage from the runner's final message. Add `let lastUsage = null` before the loop; inside the loop assign `lastUsage = message.usage` on each iteration. After the loop, if `lastUsage` exists, log `cache_creation_input_tokens` and `cache_read_input_tokens`. Verify the fields appear in terminal output after a run (values will be 0 on first run with a cold cache; on a second back-to-back run `cache_read_input_tokens` should be non-zero).

## 5. Verification

- [x] 5.1 Run `npm run scout 2>&1` twice in quick succession (< 5 minutes apart). Confirm the second run logs `cache_read_input_tokens > 0` in the usage output, confirming the system prompt cache warmed on the first run and was read on the second.
