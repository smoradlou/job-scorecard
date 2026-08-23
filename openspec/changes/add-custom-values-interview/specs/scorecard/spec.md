## Purpose

Lets a user score and compare job offers against a criteria set that is
their own — defined via the values interview and adjustable over time —
rather than against a fixed, one-size set of values baked into the tool.

## ADDED Requirements

### Requirement: Scoring is driven by user-defined criteria
The system SHALL score, weight, rank, and visualize job offers using
whatever criteria set the user has currently adopted, rather than a fixed
built-in set. This applies uniformly to manual scoring, the weighted-total
calculation, the radar chart, and AI-assisted JD scoring.

#### Scenario: No criteria adopted yet
- **WHEN** a user opens the app and has never completed the values
  interview
- **THEN** the system presents the values interview instead of a
  scorecard, rather than falling back to a default built-in criteria set

#### Scenario: Offer scoring reflects the adopted criteria
- **WHEN** a user has adopted a criteria set and adds or edits an offer
- **THEN** every criterion in the adopted set has a score, and the
  weighted total and ranking are computed only from that set

#### Scenario: JD auto-scoring uses the adopted criteria
- **WHEN** a user submits a job description for AI-assisted scoring
- **THEN** the system scores it against the currently adopted criteria
  set, not a fixed one

### Requirement: Criteria, weights, and offers persist together
The system SHALL persist the adopted criteria set alongside offer weights
and scored offers, such that reloading the application restores all three
consistently.

#### Scenario: Reloading after adopting criteria
- **WHEN** a user adopts a criteria set, sets weights, and scores offers,
  then reloads the application
- **THEN** the same criteria, weights, and offers are restored

### Requirement: Redefining values does not destroy the existing scorecard until confirmed
The system SHALL let a user re-enter the values interview to replace their
criteria set at any time, and SHALL NOT discard the currently adopted
criteria, weights, or scored offers unless and until the user completes and
confirms a new criteria set.

#### Scenario: Abandoning a redefinition in progress
- **WHEN** a user starts redefining their values but exits or reloads
  before confirming a new criteria set
- **THEN** their previously adopted criteria, weights, and offers are
  unchanged

#### Scenario: Confirming a redefinition
- **WHEN** a user completes and confirms a new criteria set while
  redefining their values
- **THEN** the new criteria set replaces the old one, and existing scored
  offers gain default scores for any newly introduced criteria
