# DATA_HEALTH_FILTER_DESIGN

## 1. Purpose

Data-health filtering helps users find records that would benefit from cleanup.

It should live inside concrete list pages such as Tickets and Journeys instead of Overview.

This is a review aid, not a validation blocker.
It should help users return to incomplete or uncertain records without implying that every flagged item is broken.

## 2. Product Language

Preferred label:

- `Needs review`

Avoid:

- `Invalid`
- `Broken`
- `Error`

Reasoning:

- many records are intentionally incomplete
- some records are manually entered on purpose
- optional data should not create noisy false positives

The UI should explain why an item is in `Needs review`.
Examples:

- `Needs review - Missing departure time`
- `Needs review - Missing arrival location`
- `Needs review - Flight number missing`
- `Needs review - Route location unavailable`

## 3. Ticket Needs Review MVP Rules

Tickets should be the first implementation target.

### Recommended review reasons

#### Missing departure location

- Condition:
  - no usable departure location name/code for the ticket or required segment
- Suggested label:
  - `Missing departure location`
- Severity:
  - `review`
- First-pass suitability:
  - yes

#### Missing arrival location

- Condition:
  - no usable arrival location name/code for the ticket or required segment
- Suggested label:
  - `Missing arrival location`
- Severity:
  - `review`
- First-pass suitability:
  - yes

#### Missing departure date/time

- Condition:
  - no usable departure date/time on a single-segment ticket or required first segment
- Suggested label:
  - `Missing departure time`
- Severity:
  - `review`
- First-pass suitability:
  - yes

#### Flight ticket missing flight number

- Condition:
  - flight ticket type with no usable normalized flight number
- Suggested label:
  - `Flight number missing`
- Severity:
  - `review`
- First-pass suitability:
  - yes

#### Rail ticket missing train number

- Condition:
  - rail/train ticket type with no usable train number
- Suggested label:
  - `Train number missing`
- Severity:
  - `review`
- First-pass suitability:
  - yes

#### Route/map location unresolved or unavailable

- Condition:
  - map/location metadata safely indicates that the route cannot resolve usable coordinates for a ticket endpoint
  - only use this reason when the app can detect it deterministically
- Suggested label:
  - `Route location unavailable`
- Severity:
  - `review`
- First-pass suitability:
  - maybe
- Notes:
  - safe only if detection is based on current resolver/output rather than guesswork
  - unresolved rail place fallback is a likely later integration point

#### Multi-segment ticket has incomplete segment route/date fields

- Condition:
  - one or more segments are missing required origin, destination, or departure date/time data
- Suggested label:
  - `Segment data incomplete`
- Severity:
  - `review`
- First-pass suitability:
  - maybe
- Notes:
  - only if the current segment model exposes enough stable fields to detect this cleanly

### Explicitly not review reasons for Tickets

Do not flag a ticket just because it lacks:

- original ticket file / attachment
- ticket stub
- cost
- notes
- seat
- terminal
- class/cabin when the field is optional or has a default

## 4. Journey Needs Review Design

Journey review is designed now but should be implemented later.

### Possible review reasons

#### No destination / no stays

- Condition:
  - journey has no resolved stays and no acceptable legacy destination fallback
- Suggested label:
  - `Destination not confirmed`
- Notes:
  - if legacy destination text still exists and is intentionally allowed, this may remain non-review until Stays become stricter

#### Has unresolved stays

- Condition:
  - one or more stays remain unresolved, grouped, or unconfirmed
- Suggested label:
  - `Stay needs confirmation`

#### Date range missing or inconsistent

- Condition:
  - start/end dates are missing, inverted, or inconsistent with accepted journey rules
- Suggested label:
  - `Journey dates need review`

#### Linked tickets changed and stays may need confirmation

- Condition:
  - the product later gains a safe signal that linked tickets changed after stay derivation/review
- Suggested label:
  - `Stays may be outdated`
- Notes:
  - design only for now; do not assume this signal already exists

#### Journey has no linked tickets

- Condition:
  - zero linked tickets
- Suggested label:
  - optional future label such as `No linked tickets`
- Notes:
  - do not treat this as invalid automatically
  - if surfaced at all, keep it low-pressure review guidance

#### Destination derived only from fallback legacy text

- Condition:
  - destination display still depends on old fallback text instead of reviewed place/stay data
- Suggested label:
  - `Destination uses fallback`
- Notes:
  - useful later if the product wants to encourage migration to reviewed stay/place data

### Explicitly not review reasons for Journeys

Do not flag a journey just because it lacks:

- cost
- notes
- companions
- linked tickets, by default

`0` linked tickets may be allowed and should not be treated as an error.

## 5. UI Direction

### Tickets first

Later UI direction for Tickets:

- add a review filter to the Tickets list
- keep review semantics separate from transport type
- prefer a compact control such as:
  - `Review: All / Needs review`
  - or a review chip near existing filters

Ticket rows should show a concise reason when flagged.
Examples:

- `Needs review - Missing departure time`
- `Needs review - Flight number missing`
- `Needs review - Missing departure time +2`

If multiple reasons exist:

- show a stable primary reason plus count
- full reason expansion can come later in detail view or tooltip
- first implementation does not require tooltip/detail expansion

### Journeys later

Later UI direction for Journeys:

- similar review filter in Journey List
- concise row-level reason later
- no Overview reminder surface

## 6. Implementation Phasing

### `DATA-HEALTH-FILTER-001`

- implement a pure helper for Ticket review reasons
- keep the first pass limited to stable ticket fields only:
  - missing departure location
  - missing arrival location
  - missing departure time
  - flight number missing
  - train number missing
- treat these as later or optional follow-up checks unless the current data model exposes them safely:
  - route/map location unavailable
  - segment data incomplete
- add tests
- no UI yet, or only a hidden/internal helper if needed

### `DATA-HEALTH-FILTER-002`

- add Tickets list filter: `Review: All / Needs review`
- show concise review reason on ticket rows
- keep attachment and cost optional

### `DATA-HEALTH-FILTER-003`

- design/refine Journey review reasons against the current Journey/Stays model
- confirm which Journey review signals are truly detectable

### `DATA-HEALTH-FILTER-004`

- implement Journey list `Needs review` filter
- add concise journey reason display

## 7. Testing Strategy

Expected Ticket helper tests:

- ticket with missing departure time is flagged
- flight without flight number is flagged
- rail without train number is flagged
- ticket without attachment is not flagged
- ticket without cost is not flagged
- complete flight ticket is not flagged
- complete rail ticket is not flagged
- multiple reasons produce stable reason ordering

Later Journey tests should verify:

- unresolved stays can be detected when the model supports it
- optional journey data does not create noisy false positives
- `0`-ticket journeys are not automatically treated as errors

## 8. Boundaries

This design should not:

- block saving records
- create scary error states
- change existing data
- require a DB migration for the first pass
- appear on Overview

## 9. Accepted Product Boundaries

Accepted explicit non-review reasons:

- missing original ticket file / attachment
- missing ticket stub
- missing cost
- missing notes
- missing seat
- missing terminal
- missing companions
- optional class/cabin gaps

Accepted placement rule:

- design both Tickets and Journeys now
- implement Tickets first later
- keep Overview free of data-health reminders

## 10. Recommended Next Task

Recommended next implementation task:

- `DATA-HEALTH-FILTER-001`

Scope:

- add a pure Ticket review-reason helper
- keep the first implementation limited to stable ticket fields only
- leave route/map availability and segment completeness as later checks unless they are proven safely detectable
- add focused tests
- keep runtime UI unchanged in the first pass
