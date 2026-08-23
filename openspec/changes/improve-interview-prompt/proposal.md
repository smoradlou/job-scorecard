## Why

The initial interview prompt covered job *conditions* as its primary topics
(comp floor, remote preference, culture) and produced condition-level output
("remote-first, good pay, thoughtful team") rather than stable underlying
values. A condition changes offer to offer; a value is what the condition
serves. This was identified after observing synthesized criteria from the
first version and confirmed by research into occupational psychology and
values-elicitation methodology.

## What Changes

- **`server/index.js` — `VALUES_INTERVIEWER_SYSTEM`**: Rewritten to open
  with a behavioral retrospective question, add reflective naming after each
  answer (naming the value heard before the next question), map toward an
  explicit 8-dimension framework (Security, Influence, Mastery, Impact,
  Belonging, Recognition, Stimulation, Inquiry), collect constraints at the
  end rather than leading with them, and signal closure after 4–5 exchanges.

- **`server/index.js` — `buildSynthesizePrompt`**: Updated to reference the
  same framework and to request hints specific to what the person said, not
  generic dimension labels.

- **`src/ValuesInterview.jsx` — hardcoded opener**: Changed from
  "what's pulling you to look for something new" (conditions framing) to
  the behavioral retrospective opener ("tell me about a time at work when
  you felt most fully yourself") aligned with the new system prompt.

- **`openspec/changes/improve-interview-prompt/design.md`**: Documents the
  full 8-dimension framework with sources for every dimension and the
  decisions behind each change.

## No Breaking Changes

Prompt-only change. No API shape changes, no schema changes, no new
endpoints. Existing saved criteria/weights/jobs are unaffected.

## Sources

See `design.md` in this change directory. Primary: Schwartz (1992) Basic
Human Values; Schein (2006) Career Anchors; Deci & Ryan SDT; Reynolds &
Gutman (1988) laddering; Miller & Rollnick (2012) Motivational Interviewing;
Savickas (2011) Career Construction Interview; Fadhil et al. (2021) on
reflective naming in chatbot MI.
