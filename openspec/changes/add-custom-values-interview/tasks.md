## 1. Backend: persistence and validation

- [x] 1.1 Add a `slugify(label)` helper plus a collision-dedupe pass (append `-2`, `-3`, ...) in `server/index.js`.
- [x] 1.2 Extend `PUT /api/offers` to destructure and require `criteria` (non-empty array, every item has a non-empty `key` and `label`), returning `400` on violation.

## 2. Backend: values-interview endpoints

- [x] 2.1 Add `POST /api/values-chat` (body `{ messages }`, injects the interviewer system prompt, returns `{ reply }`).
- [x] 2.2 Add `POST /api/values-synthesize` (body `{ messages }`, returns `{criteria:[{key,label,hint,weight}], summary}`, deduped keys, 502 on parse/shape failure).

## 3. Frontend: ValuesInterview component

- [x] 3.1 Create `src/ValuesInterview.jsx` with the chat phase: message transcript, text input, "Send" calling `POST /api/values-chat`, error state.
- [x] 3.2 Add the "Build my scorecard" action (visible after ≥1 exchange) calling `POST /api/values-synthesize`, and the review phase: editable rows, add/remove, summary, slugify+dedupe on edit, "Confirm" disabled on empty label.
- [x] 3.3 Wire `existingCriteria`/`onComplete`/`onCancel` props for first-run onboarding and "redefine" re-run.

## 4. Frontend: JobScorecard integration

- [x] 4.1 Delete hardcoded `CRITERIA` / `DEFAULT_WEIGHTS`; add `const [criteria, setCriteria] = useState(null)`.
- [x] 4.2 Update hydration effect to set `criteria` from `GET /api/offers` when present.
- [x] 4.3 Module-level `emptyJobFor(criteriaList, n)` helper; `emptyJob` in component body closes over `criteria`.
- [x] 4.4 Add `interviewMode` state and render branch: show `<ValuesInterview>` when `!criteria || interviewMode`, with `onComplete` that sets criteria, replaces weights, backfills job scores.
- [x] 4.5 Debounced save effect gated on `!loaded || !criteria`, `criteria` in deps and PUT body.
- [x] 4.6 Replace every `CRITERIA.*` reference with `criteria.*` + defensive `?? 3` / `?? 5` fallbacks.
- [x] 4.7 Add "Redefine my values" button near header; sets `interviewMode = true` without nulling `criteria`.

## 5. Docs and cleanup

- [x] 5.1 Updated `CLAUDE.md`: values-interview section, repo tree, persistence shape, conventions updated.
- [x] 5.2 Updated `PRODUCT_SPEC.md`: §2 rewritten, §3/§5 updated, §8 item 5 struck through.
- [x] 5.3 Deleted stale `server/data/offers.json` scaffold.

## 6. End-to-end verification

- [x] 6.1 Full manual run-through completed: fresh load → interview → synthesize → review → confirm → scorecard rendered correctly → "Redefine my values" button present and functional.
