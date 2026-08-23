## Why

The scorecard currently ranks job offers against six criteria hardcoded for
one person's own values (`CRITERIA` in `src/JobScorecard.jsx`), fixed on
purpose for comparability across offers scored months apart. The project now
has two goals beyond Sara's own job search: showcasing it publicly as a
portfolio/interview piece, and prototyping it as a real product where other
people could discover their own values and get a scorecard built around
them — the kind of thing that could pair with paid coaching later. A tool
whose criteria are baked in for one specific person serves neither goal as
well as one where the criteria come from the person using it.

## What Changes

- Replace the fixed `CRITERIA` constant with a criteria set the user
  defines themselves.
- Add a chat-style interview (reusing the Anthropic API already wired up
  for JD analysis) that asks about a person's values, priorities, and
  constraints for evaluating job offers, then synthesizes them into a
  criteria set (label, one-line hint, 1-5 weight) plus a short summary.
- Add a review/edit step after synthesis — the user can rename, reweight,
  add, or remove criteria before they become the active set.
- Add a way to redefine values later, without losing the current scorecard
  if the redefinition is abandoned partway through.
- **BREAKING**: `server/data/offers.json`'s shape gains a required
  `criteria` field; a file saved by the current version (no `criteria`
  field) is treated as "not yet onboarded" and routes to the interview
  rather than being read as a complete scorecard. This only affects the
  single local data file (gitignored, not shipped), not a real migration
  concern.
- Scope stays single-user/single-instance — no accounts, no multi-tenant
  data separation. That is a deliberate non-goal of this change, not an
  oversight.

## Capabilities

### New Capabilities
- `values-interview`: chat-driven interview that elicits a person's job-
  related values/constraints and synthesizes them into a candidate criteria
  set (label, hint, weight, summary) for review before use.
- `scorecard`: scoring job offers against a user-defined (not fixed)
  criteria set — weighted totals, ranking, radar chart, JD auto-scoring,
  and persistence, all driven by whatever criteria the user has set up via
  the values interview.

### Modified Capabilities
_(none — no `openspec/specs/` exist yet in this repo; both capabilities
above are being spec'd for the first time as part of this change, even
though `scorecard`'s underlying code already exists with fixed criteria.)_

## Impact

- `server/index.js`: new `POST /api/values-chat` and
  `POST /api/values-synthesize` endpoints; `PUT /api/offers` validation
  extended to require `criteria`.
- `src/JobScorecard.jsx`: hardcoded `CRITERIA`/`DEFAULT_WEIGHTS` removed;
  criteria becomes hydrated state; every render/computation path that
  iterated the fixed constant now iterates the dynamic one.
- `src/ValuesInterview.jsx` (new): the chat + review UI.
- `server/data/offers.json` (gitignored, local only): shape gains
  `criteria`.
- `CLAUDE.md` / `PRODUCT_SPEC.md`: updated in this same change to reflect
  dynamic criteria, per this repo's own existing convention of keeping
  those docs in sync with the scoring model.
