## Context

See `proposal.md` - Why. Current implementation: `src/JobScorecard.jsx`
hardcodes a `CRITERIA` array and `DEFAULT_WEIGHTS`; every scoring/rendering
path (weighted total, radar chart, weights panel, job sliders, JD analyzer
request body) iterates that fixed constant. `server/index.js` already
treats `criteria` as request-body data for `/api/analyze` — it isn't
hardcoded server-side, only the frontend's constant feeds it. Persistence
is `server/data/offers.json` (gitignored), `{ weights, jobs }` today,
written via `PUT /api/offers` and read via `GET /api/offers`.

## Goals / Non-Goals

**Goals:**
- Replace the fixed criteria constant with a criteria set produced by a
  chat interview and confirmed by the user, reusing the existing
  Anthropic-call infrastructure (`callAnthropic()`, the JSON-extraction
  pattern already used by `/api/analyze`).
- Keep the existing app's data-persistence and JD-scoring behavior intact,
  just parameterized by dynamic criteria instead of a fixed constant.

**Non-Goals:**
- Multi-user/account support or any per-user data separation — explicitly
  deferred; this remains one local instance with one active criteria set.
- Building the paid/coaching layer itself — this change only produces the
  values-elicitation flow that such a layer could later sit behind.
- Migrating or reconciling historical scores across different criteria
  sets beyond simple key backfill (see Decisions) — no versioning/history
  of past criteria sets is introduced.

## Decisions

**New criteria object shape: `{ key, label, hint, weight }`.**
Mirrors the existing hardcoded criteria shape (`key`, `label`, `hint`) plus
a per-criterion `weight`, folding what was a separate `DEFAULT_WEIGHTS`
object into the criteria set itself — there's no longer a fixed set of keys
to key a separate weights object off of by convention, so weights travel
with their criterion.

**Keys are server-generated (slugified from label + deduped), never
model-trusted or directly user-edited.** The synthesis endpoint's model
output is regenerated through a `slugify()` + collision-dedupe helper
server-side before it reaches the client; the review UI re-derives a
criterion's key from its label client-side too (using the same slugify
logic) whenever the user edits or adds a row. Alternative considered:
let the model's suggested `key` pass through as-is — rejected because nothing
constrains a model to produce unique, JS-object-safe keys, and because a
raw editable key field in the review UI is a footgun (silently colliding
with another criterion, or breaking on rename).

**Two separate endpoints (`/api/values-chat`, `/api/values-synthesize`)
rather than one endpoint with a mode flag.** They have different response
shapes (plain text vs. structured JSON), different prompts, and different
`max_tokens` budgets (~500 vs ~1800) — keeping them separate mirrors how
`/api/analyze` and `/api/fetch-jd` are already separate single-purpose
endpoints rather than parameterized ones.

**Ending the interview and moving to synthesis is a UI action, not
model-driven.** The chat model may say it has enough signal, but the
"Build my scorecard" button is what actually triggers synthesis. Rejected
alternative: have the model emit a sentinel/JSON marker when done and
auto-transition — more brittle (depends on the model reliably emitting a
marker inside free-form conversational text) for no real benefit, since a
user-visible button is already the natural affordance.

**Redefining values flips a transient `interviewMode` flag rather than
nulling the current `criteria` state up front.** This means the debounced
save effect keeps writing the still-valid previous criteria/weights/jobs
to disk the entire time a redefinition is in progress; only the
`onComplete` handler at the end actually replaces state. Alternative
considered: null out `criteria` immediately on "Redefine my values" to
mirror first-run onboarding exactly — rejected because it would mean a
reload mid-redefine loses the user's entire existing scorecard for no
benefit, which directly contradicts the spec requirement that redefinition
not destroy the existing scorecard until confirmed.

**Backfill, not reset, when adopting a new/changed criteria set.**
On confirmation, every existing job's `scores` object is backfilled with a
default (5) for any criterion key it doesn't already have, while old
now-unused keys are left in place harmlessly (nothing reads a job's score
object by enumerating its own keys — every read site iterates the active
`criteria` list and looks up by key). Defensive `?? 5` / `?? 3` fallbacks
are added at the actual arithmetic/slider read sites regardless, since a
missing key at any of those sites (e.g. from a future bug in the backfill
path) would otherwise turn the whole weighted-total calculation into `NaN`
for every offer, not just the one missing a value — cheap insurance against
that failure mode, not a substitute for the backfill itself.

**No explicit migration for the legacy on-disk shape.** A saved file
without a `criteria` field (including the current local scaffold file) is
read as "not onboarded" by the hydration effect's own
`Array.isArray(data.criteria) && data.criteria.length > 0` check — this
falls out of the existing hydration logic's shape rather than requiring
new migration code, and is why `PUT /api/offers` can safely *require*
`criteria`: the only state that ever reaches a `PUT` call is post-onboarding
state, where criteria is guaranteed non-empty by the review step's own
confirm-blocking validation.

**`ValuesInterview.jsx` is a new file, not folded into
`JobScorecard.jsx`.** At an estimated 150-250 lines for the chat + review
UI, inlining would push `JobScorecard.jsx` past 700 lines mixing two
concerns. `CLAUDE.md`'s existing "keep it one file" note was written so the
whole app could be re-uploaded as a single Claude.ai artifact; that
constraint is less load-bearing now that the project is also meant to live
publicly as a real, demoable app (confirmed with the user rather than
assumed).

## Risks / Trade-offs

- **Conversation state is not persisted mid-interview** (only the final
  adopted criteria set is saved) → a page reload mid-conversation loses the
  transcript. Mitigated by scope: acceptable for a single-user tool where a
  restarted interview costs a few minutes, not a data-loss concern.
- **Model-synthesized weights may not reflect true relative importance**
  the way a fixed, hand-tuned default set did → mitigated by the mandatory
  review/edit step before adoption (spec requirement), so a bad initial
  weight is never silently adopted.
- **Two new server-side AI calls increase surface area for the existing
  `502`-on-malformed-JSON failure mode** → mitigated by reusing the exact
  extraction/error-surfacing pattern already proven in `/api/analyze`,
  rather than inventing a new one.

## Migration Plan

Not applicable in the deployment sense (single local instance, no shared
data store to migrate). The one local artifact affected,
`server/data/offers.json`, is gitignored and can be deleted for a clean
first run of the new onboarding flow rather than migrated — as noted in
proposal.md's Impact section, its current contents are scaffold data from
smoke-testing, not real job-search data worth preserving.
