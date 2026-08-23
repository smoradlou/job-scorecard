## 1. Setup

- [x] 1.1 Add `@anthropic-ai/sdk` to `package.json` dependencies
- [x] 1.2 Add `"scout": "node agent/scout.js"` to `package.json` scripts
- [x] 1.3 Add `agent/cv.md` and `agent/seen.json` to `.gitignore`
- [x] 1.4 Create `agent/cv.md` template

## 2. Agent implementation (`agent/scout.js`)

- [x] 2.1 Data I/O helpers: `readData` / `writeData` (atomic) / `readSeen`
- [x] 2.2 Scoring helpers: `buildScoringPrompt`, `computeWeightedTotal`
- [x] 2.3 `fetch_jd` tool: jsdom + Readability extraction (same logic as server)
- [x] 2.4 `score_jd` tool: direct Anthropic API call → parsed JSON + weighted total
- [x] 2.5 `is_seen` tool: checks `agent/seen.json`
- [x] 2.6 `save_offer` tool: appends to `server/data/offers.json`, records URL in `agent/seen.json`
- [x] 2.7 Main loop: Tool Runner with `web_search_20260209` + client tools;
      `pause_turn` handled; system prompt with CV + criteria + threshold

## 3. Verification

- [ ] 3.1 `npm install` picks up `@anthropic-ai/sdk`
- [ ] 3.2 `npm run scout` runs without error with a filled-in `cv.md` and
      existing `server/data/offers.json` (criteria present)
- [ ] 3.3 Saved offers appear in the scorecard on next app load
- [ ] 3.4 Re-running scout doesn't re-evaluate already-seen URLs
