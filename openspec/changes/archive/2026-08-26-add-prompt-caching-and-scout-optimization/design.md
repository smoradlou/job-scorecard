## Context

See proposal.md — Why.

**`server/index.js`**: Uses a hand-rolled `callAnthropic()` wrapper around `fetch`. Its `system` parameter is currently a plain string, passed directly in the request body `{...system ? { system } : {}}`. The `VALUES_INTERVIEWER_SYSTEM` constant (~480 tokens) is the same for every values-chat and values-synthesize call. The values-chat endpoint receives a `messages` array of arbitrary length from the client and forwards it as-is.

**`agent/scout.js`**: Uses the `@anthropic-ai/sdk` Tool Runner (`client.beta.messages.toolRunner`). The system prompt is a template-literal string built once per run from CV text + criteria. `fetch_jd` and `score_jd` are separate tools: opus calls `fetch_jd(url)` → full JD text enters the context → opus then calls `score_jd(jd_text)` with that text → the full text appears again as a tool_use argument in the conversation.

**Token minimums**: Opus 5 = 512 tokens, Sonnet 4.6 = 1024 tokens. A prefix below minimum silently skips caching — no error.

## Goals / Non-Goals

**Goals:**
- Cache `VALUES_INTERVIEWER_SYSTEM` in server-side API calls so repeat values-chat turns reuse the system prompt from cache
- Cache the growing conversation history in values-chat so each new turn only processes the incremental new message at full price
- Cache the scout system prompt (CV + criteria) across every turn of the agentic loop
- Remove JD text from the opus context entirely by merging `fetch_jd` + `score_jd` into `fetch_and_score_jd`
- Log token-usage breakdown at end of scout run for observability

**Non-Goals:**
- Batch API / parallel scoring (changes async flow, separate future concern)
- Streaming responses (server endpoints are synchronous, no change needed here)
- Caching the scoring criteria in the inner `score_jd` API call (the inner call is absorbed into `fetch_and_score_jd`; the criteria + instructions block is ~350 tokens, below sonnet's 1024 minimum — caching that sub-call isn't worth the complexity)

## Decisions

### D1: `callAnthropic` accepts `system` as string or array

`callAnthropic` currently spreads `system` directly into the request body. To pass a pre-built array (with `cache_control` on its blocks), the function needs to forward arrays as-is while keeping the string fallback.

**Decision**: detect `typeof system === "string"` at call time. If string, continue as before. If array, pass directly. This avoids touching every call site and keeps the caching logic in the places that know what to cache (the endpoint handlers), not inside the generic wrapper.

**Alternative considered**: always build the array in `callAnthropic` from a `cacheSystem` flag. Rejected — the generic wrapper shouldn't know which content blocks to cache; that's endpoint-specific knowledge.

### D2: Values-chat caches the last user message block, not the whole array

The conversation history grows turn by turn. Caching the last block of the final turn means each request re-uses the entire prior conversation from cache, paying full price only for the new message. This is the "multi-turn shared prefix" pattern.

**Decision**: before forwarding to `callAnthropic`, clone the messages array and add `cache_control: {type: "ephemeral"}` to the last content block of the last message. The cloned array is never returned to the caller.

**Alternative considered**: cache every message. Rejected — only 4 breakpoints are allowed per request; using them on individual messages would exceed the limit in long conversations. One breakpoint on the "tip" of the prior history is the right pattern.

### D3: Scout system is an array, not a string

The Tool Runner accepts `system` as a string or an array of content objects (same API as the raw Messages endpoint). Switching to an array allows `cache_control` on the block.

**Decision**: build the system as `[{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]` before passing to `toolRunner`.

### D4: Merge `fetch_jd` + `score_jd` into `fetch_and_score_jd`

**Decision**: a single tool that accepts `url`, fetches the JD internally, scores it, and returns the score result. The JD text is an implementation detail inside the tool function — opus never sees it. This is a black box from the model's perspective: URL in, scores out.

**Reasoning**: opus currently sees up to 8 000 chars of JD text twice per listing. With 5–10 listings per run and an opus input price of $15/M tokens, the JD text in context can add $0.03–0.12 per run just for the JD payload. The merged tool eliminates this entirely. The trade-off is that opus can no longer "reason about" the JD text directly — but the scout's prompting never needed that capability; opus's job is to search, deduplicate, and orchestrate, not to read JDs.

**Alternative considered**: keep tools separate but truncate `fetch_jd` result more aggressively. Rejected — any text returned by `fetch_jd` still becomes the `score_jd` input, so both copies persist regardless of how short the text is.

### D5: Token usage logged from the SDK's final message usage object

The Tool Runner's final iterated message has `message.usage` with `cache_creation_input_tokens` and `cache_read_input_tokens`. Log these at the end of the run.

**Limitation**: the Tool Runner runs multiple turns; only the last turn's usage is available from the final message. This is sufficient for a "did caching fire?" check — the first real turn will show `cache_creation_input_tokens > 0`, subsequent turns will show `cache_read_input_tokens > 0`.

## Risks / Trade-offs

**5-minute cache TTL** → A scout run that takes more than 5 minutes between the first and last tool-call turn (unlikely but possible with many web searches + fetches) may miss cache reads on later turns. Mitigation: with `fetch_and_score_jd` merging the expensive pair, per-listing token cost drops substantially even without a cache hit on every turn; this is an acceptable edge case.

**Sonnet 4.6 minimum is 1024 tokens** → `VALUES_INTERVIEWER_SYSTEM` is estimated at ~480 tokens, below the minimum. The cache marker will be silently ignored. This is fine — the code is correct and forward-compatible (if the system prompt grows, or the user switches to a model with a lower minimum, caching activates for free).

**`fetch_and_score_jd` combines two failure modes** → previously, `fetch_jd` could fail (return error) and opus would skip before calling `score_jd`. Now a single tool call can fail at either phase. The tool still returns `{ error }` on fetch failure, so opus's existing error-handling prompt instruction ("if it errors, skip and try the next listing") applies unchanged.

**Scout prompt update** → The system prompt's "Workflow for each listing" section currently lists steps 2 (`fetch_jd`) and 3 (`score_jd`) separately. These must be collapsed to a single step referencing `fetch_and_score_jd`.
