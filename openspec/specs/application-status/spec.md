# application-status Specification

## Purpose

Tracks where each job offer is in the application pipeline. Each job carries a `status` field that drives both a kanban board view and filtering for the radar chart comparison.

## Requirements

### Requirement: Status lifecycle

Each job offer has a `status` field with five allowed values: `saved`, `applied`, `interviewing`, `offer`, `closed`. All jobs default to `saved` when no status is present. Transitions are user-driven with no enforced ordering. The UI presents statuses in the order above to imply a natural progression but does not block backward movement. When status transitions **to** `applied`, the system records the current timestamp as `appliedAt`. When status moves **away from** `applied`, `appliedAt` is cleared. An optional `statusNote` string (free-text) may accompany any status and is not cleared on status change.

`offer` means a formal offer was received. `closed` means the process ended without an offer — either rejected by the company or withdrawn by the user.

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

Four columns in fixed order: Saved, Applied, Interviewing, Offer / Closed. The first three columns each correspond to one status. The fourth column is a combined **Offer / Closed** column that displays both `offer` and `closed` jobs, separated by a labeled divider — offers shown above, closed below. Each column's header shows the total card count across all its sections. Each card shows: role title (truncated at ~50 chars), score badge (≥80 blue / 65–79 green / <65 yellow), `statusNote` if non-empty. Applied cards show "Applied N days ago" from `appliedAt`; omitted if `appliedAt` is absent or unparseable. Status is changeable from the board card; changing status immediately moves the card to the correct column or section.

#### Scenario: status change on board card

Given the board view is active and a job is in the Applied column, when the user changes its status to Interviewing via the card dropdown, then the card moves to the Interviewing column without a page reload.

#### Scenario: offer and closed in combined column

Given a job with `status: "offer"` and a job with `status: "closed"`, when the board view is active, then both appear in the fourth column — the offer job above the divider, the closed job below it.

### Requirement: Scout threshold divider in ranking

The ranking view displays a labeled divider between the last job scoring ≥70 and the first job scoring below 70. The divider reads "Scout threshold · 70" and appears in both the compact ranking table and the job tiles section. Jobs below the threshold are rendered at reduced opacity (visually dimmed) to distinguish strong fits from weaker ones without hiding them.

#### Scenario: threshold divider placement

Given the ranked list contains jobs scoring 81, 75, 70, 69, 68, when the ranking view renders, then the divider appears between the job scored 70 and the job scored 69, and the jobs scored 69 and 68 are visually dimmed.

#### Scenario: all jobs above threshold

Given all active jobs score ≥70, when the ranking view renders, then no divider is shown.

### Requirement: Closed jobs excluded from radar chart

Jobs with `status: "closed"` are excluded from the radar chart comparison. Only active jobs (`status` ≠ `"closed"`) appear as series on the chart. `offer` jobs remain included.

#### Scenario: closed job excluded from radar

Given a job has `status: "closed"`, when the radar chart renders, then that job's series is not present in the chart.

### Requirement: Status control in existing tile view

The existing job tile gains a status `<select>` showing all five statuses. A `statusNote` text input appears below when status is `"applied"` or `"interviewing"`.

#### Scenario: status note input visibility

Given a job tile is expanded and status is `"saved"`, when the user changes status to `"applied"`, then the status note input becomes visible.
