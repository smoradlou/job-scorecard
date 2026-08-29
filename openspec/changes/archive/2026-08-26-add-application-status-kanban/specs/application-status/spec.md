# Application Status — Spec

## ADDED Requirements

### Requirement: Status lifecycle

Each job offer has a `status` field with four allowed values: `saved`, `applied`, `interviewing`, `closed`. All jobs default to `saved` when no status is present. Transitions are user-driven with no enforced ordering. The UI presents statuses in the order above to imply a natural progression but does not block backward movement. When status transitions **to** `applied`, the system records the current timestamp as `appliedAt`. When status moves **away from** `applied`, `appliedAt` is cleared. An optional `statusNote` string (free-text) may accompany any status and is not cleared on status change.

#### Scenario: new job defaults to saved

Given a job is added, when the job object is created, then `status` is `"saved"`, `appliedAt` is `null`, and `statusNote` is `""`.

#### Scenario: transition to applied sets appliedAt

Given a job has `status: "saved"`, when the user changes status to `"applied"`, then `appliedAt` is set to the current ISO timestamp.

#### Scenario: transition away from applied clears appliedAt

Given a job has `status: "applied"` with a non-null `appliedAt`, when the user changes status to `"interviewing"`, then `appliedAt` is cleared to `null`.

#### Scenario: statusNote survives status changes

Given a job has `statusNote: "Round 2"`, when the user changes status, then `statusNote` is unchanged.

### Requirement: Persistence of status fields

`status`, `appliedAt`, and `statusNote` are persisted on each job object via the existing `PUT /api/offers` endpoint. Existing jobs without these fields hydrate as `status: "saved"`, `appliedAt: null`, `statusNote: ""`.

#### Scenario: old job loads with defaults

Given `offers.json` contains a job with no `status` field, when the app loads, then that job appears in the Saved column with no console errors.

### Requirement: View toggle between Ranking and Board

The scorecard exposes two views: **Ranking** (existing ordered list) and **Board** (kanban grouped by status). Exactly one is active at a time. The toggle is session-only; ranking is the default on load.

#### Scenario: switching to board view

Given the user clicks the Board toggle, when the view switches, then four kanban columns render and the ranking list and job tiles are hidden.

### Requirement: Board view with four columns

Four columns in fixed order: Saved, Applied, Interviewing, Offer / Closed. Each column contains all jobs with matching status, sorted by score descending. Each card shows: role title (truncated at ~50 chars), score badge (≥80 blue / 65–79 green / <65 yellow), `statusNote` if non-empty. Applied cards show "Applied N days ago" from `appliedAt`; omitted if `appliedAt` is absent or unparseable. Status is changeable from the board card; changing status immediately moves the card to the correct column.

#### Scenario: status change on board card

Given the board view is active and a job is in the Applied column, when the user changes its status to Interviewing via the card dropdown, then the card moves to the Interviewing column without a page reload.

### Requirement: Status control in existing tile view

The existing job tile gains a status `<select>` showing the four statuses. A `statusNote` text input appears below when status is `"applied"` or `"interviewing"`.

#### Scenario: status note input visibility

Given a job tile is expanded and status is `"saved"`, when the user changes status to `"applied"`, then the status note input becomes visible.
