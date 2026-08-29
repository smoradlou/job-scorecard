# values-interview Specification

## Purpose
Lets a person discover and articulate their own job-related values,
priorities, and constraints through a short conversation, and turns that
conversation into a candidate scoring-criteria set they can review and
adjust before it becomes their active scorecard.

## Requirements

### Requirement: Conversational values elicitation
The system SHALL let a user have a multi-turn conversation, driven by an AI
interviewer, aimed at surfacing core work values mapped to eight dimensions:
Security, Influence, Mastery, Impact, Belonging, Recognition, Stimulation,
Inquiry. The interviewer SHALL open with a behavioral retrospective question
(a specific time the person felt most alive at work), reflect the underlying
value heard in each answer before asking the next question, and collect
practical constraints (comp floor, location) near the end rather than
leading with them. The interviewer SHALL signal when it has sufficient
signal (typically after 4–5 exchanges), but the user controls when to
proceed to synthesis. See `improve-interview-prompt/design.md` for framework
sourcing.

#### Scenario: User sends a message during the interview
- **WHEN** the user submits a message in the values interview
- **THEN** the system names the value it heard, then replies with a single
  adaptive follow-up grounded in the conversation so far

#### Scenario: Ending the interview is user-controlled
- **WHEN** the assistant indicates it has enough information to proceed
- **THEN** the conversation does not end automatically — the user must
  take an explicit action to move to synthesis

### Requirement: Synthesizing a candidate criteria set
The system SHALL be able to distill an in-progress or completed values
interview into a candidate scoring-criteria set: 4 to 7 criteria, each
with a short label, a one-sentence hint describing what it measures, and a
relative weight (1-5), plus a short plain-English summary of the person's
stated priorities.

#### Scenario: Requesting synthesis after at least one exchange
- **WHEN** the user asks to build their scorecard after at least one
  question-and-answer exchange
- **THEN** the system returns a candidate criteria set (4-7 items with
  label, hint, and weight) and a summary of the person's stated priorities

#### Scenario: Synthesis fails to produce usable output
- **WHEN** the underlying model response cannot be parsed into a valid
  criteria set
- **THEN** the system surfaces a clear error and leaves the conversation
  intact so the user can retry without re-entering their answers

### Requirement: Reviewing and editing before adoption
The system SHALL present the synthesized criteria set for review before it
becomes the active scoring criteria, and SHALL let the user rename a
criterion's label, edit its hint, adjust its weight, remove a criterion, or
add a new one, prior to confirming.

#### Scenario: User adjusts a synthesized criterion
- **WHEN** the user edits a criterion's label, hint, or weight in the
  review step
- **THEN** the edited value is what gets adopted on confirmation, not the
  originally synthesized value

#### Scenario: User adds a criterion not suggested by synthesis
- **WHEN** the user adds a new criterion during review
- **THEN** it is included in the adopted criteria set on confirmation with
  a valid, unique identifier derived from its label

#### Scenario: Confirmation is blocked on invalid state
- **WHEN** the criteria set in review has no criteria, or any criterion has
  an empty label
- **THEN** the system prevents confirmation until the issue is resolved
