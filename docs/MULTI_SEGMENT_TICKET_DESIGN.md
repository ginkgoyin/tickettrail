# MULTI_SEGMENT_TICKET_DESIGN

## 1. Scope

This document defines the intended semantics and future ticket-detail UI redesign for multi-segment tickets.

It covers:

- the conceptual difference between Ticket, Segment or Leg, and Journey
- the current broken multi-segment detail behavior
- the recommended future ticket-detail layout
- future route-map, stub, and duration rules for multi-segment tickets

This task is **docs-only**.

It does **not**:

- implement runtime behavior
- change current Add or Edit flows
- change current route-map rendering
- change current Ticket detail runtime UI
- implement the Journey data model

## 2. Problem statement

The current multi-segment ticket behavior is conceptually and visually wrong.

A two-segment ticket such as `SYD -> BNE -> AYQ` currently displays too much like a single-leg ticket.

Observed problems:

- Ticket information only has one carrier/operator area and one flight-number area.
- Ticket stub preview only shows one stub.
- Route map can draw incorrect legs such as `SYD -> AYQ` and `BNE -> AYQ` instead of `SYD -> BNE` and `BNE -> AYQ`.
- Route map segment cards stretch the right column and break alignment with Ticket information when Route map sits beside it.
- Duration is ambiguous because it appears to mix flight time and layover time together.

Inspection of the current code suggests the main causes are:

- the data model already supports `segments`, but the current detail summary still prioritizes top-level ticket fields such as one carrier, one flight number, one departure, and one arrival
- the current stub payload is still singular: `TicketDetailPayload.stub`
- the detail view renders segment cards under `Route map`, which makes the map column too tall
- the current ticket detail layout does not yet separate itinerary-level information from segment-level information

## 3. Concept model

Recommended conceptual model:

### Ticket

- One booking, saved ticket record, or itinerary container.
- Can be single-leg or multi-leg.
- Has itinerary-level summary fields.

### Segment or Leg

- One actual transport leg.
- For flights, each segment has its own:
  - carrier/operator
  - flight number
  - departure
  - arrival
  - departure time
  - arrival time
  - terminal
  - seat/class when available
- For rail, each segment can later represent one train leg.

### Journey

- Future trip collection that can link multiple tickets.
- Not implemented here.
- Must not be confused with a multi-segment ticket.

Recommended interpretation for a connecting flight like `SYD -> BNE -> AYQ`:

- `1` Ticket
- `2` flight segments or legs
- `2` boarding-pass-style stub cards
- `1` itinerary summary
- `1` route map with consecutive legs:
  - `SYD -> BNE`
  - `BNE -> AYQ`

This should **not** be converted into two unrelated tickets.

## 4. Recommended UI structure for ticket detail

Recommended future detail layout:

### Top sticky action bar

- Back
- route title or itinerary title
- Edit / Delete

### Main detail layout

### Row 1

- Itinerary summary card
- Route map card

### Row 2

- Segment list or Legs module
- Ticket stub preview module

### Row 3

- Original ticket files or attachments

This is preferred over the current approach because:

- itinerary-level facts and segment-level facts are currently mixed together
- Route map should stay visually compact
- large segment cards under the map create a column-height imbalance
- segment details belong in a dedicated module, not under the map itself

Important direction:

- Route map should **not** include large segment detail cards underneath if that makes the right column too tall.
- Segment details should move to a dedicated `Segment list / Legs` module.

## 5. Itinerary summary card

The current single-leg-oriented `Ticket information` card should evolve into an itinerary summary card for multi-segment tickets.

For multi-segment tickets, the card should show itinerary-level facts such as:

- Overall route: `SYD -> BNE -> AYQ`
- Final destination
- Start time
- Final arrival time
- Total travel duration
- Total flight time
- Total layover time
- Number of segments
- Ticket status
- Cabin/class summary if applicable
- Notes if applicable

Important rule:

- The UI should not pretend that one carrier or one flight number represents the whole itinerary unless every segment truly shares the same value.

Recommended handling:

- if all segments share the same carrier/operator, a summary value can be shown
- if they differ, show a mixed or multi-carrier summary rather than a misleading single carrier
- the same rule applies to flight number at ticket level

## 6. Segment list / Legs module

The future detail view should include one card per segment.

Each segment card should show:

- Segment number
- Carrier / Operator
- Flight No.
- Departure airport + code
- Arrival airport + code
- Departure time + timezone
- Arrival time + timezone
- Departure terminal
- Arrival terminal
- Seat if available
- Cabin / class
- Flight duration for this segment

Layover information should appear between adjacent segment cards, for example:

- `Transfer at BNE: 1h 25m`

This keeps:

- itinerary-level facts in one place
- per-leg operational details in another
- transfer semantics visible instead of buried inside one ambiguous total duration

## 7. Ticket stub preview behavior

Recommended future behavior:

### Single-segment ticket

- show one stub

### Multi-segment flight ticket

- show one boarding-pass-style stub per segment
- each stub should use that segment's:
  - carrier
  - flight number
  - origin
  - destination
  - times
  - terminal
  - seat/class

Presentation options can be:

- horizontal scroll
- tabs
- stacked compact cards

The exact presentation can be decided later, but the key rule is:

- multi-segment flight tickets should not collapse all legs into a single boarding-pass-style stub

This task does not implement that behavior.

## 8. Route map behavior

Correct future rule:

For multi-segment tickets, route-map legs must be built from consecutive segment origin/destination pairs.

For the example:

- `SYD -> BNE`
- `BNE -> AYQ`

The map must **not** derive all legs from ticket-level origin and final destination in a way that creates false direct routes such as:

- `SYD -> AYQ`
- `BNE -> AYQ`

The route map should remain visually compact and should not render large segment detail cards under the map.

Segment details belong in the `Segment list / Legs` module.

## 9. Duration rules

Future duration semantics should be explicit.

### Total travel duration

- `final arrival time - first departure time`

### Total flight time

- sum of each segment's `arrival time - departure time`

### Layover or transfer duration

- `next segment departure time - previous segment arrival time`

UI guidance:

- multi-segment tickets should display these values separately
- single-segment tickets can hide layover or show `None`

This avoids the current ambiguity where one duration value can silently include both flying and transfer time.

## 10. Future implementation task split

Recommended follow-up tasks:

### SEGMENT-MAP-001

- Fix multi-segment route map leg construction to use consecutive segment origin/destination pairs.

### SEGMENT-STUB-001

- Render one ticket stub or boarding-pass-style card per segment.

### SEGMENT-DETAIL-001

- Redesign ticket detail into itinerary summary + segment list + route map + stubs + attachments.

### SEGMENT-DURATION-001

- Compute and display total travel duration, total flight time, and layover time separately.

### SEGMENT-FORM-001

- Later review Add/Edit multi-segment input UX, but do not modify it yet.

Recommended implementation order after design acceptance:

1. `SEGMENT-MAP-001` first if the immediate priority is to stop false route lines
2. `SEGMENT-DETAIL-001` first if the priority is broader detail redesign
3. `SEGMENT-STUB-001`
4. `SEGMENT-DURATION-001`
5. `SEGMENT-FORM-001`

## 11. Open questions

Questions that still need product/user decisions later:

- Should a multi-segment ticket appear as one row in the Ticket list or become expandable into legs?
- Should each segment support separate seat and terminal values?
- Should ticket-stub export export all segment stubs together or only one selected segment?
- Should carrier/operator and flight number at the ticket level be deprecated in favor of segment-level fields for multi-leg tickets?
- Should rail multi-segment behavior reuse the same leg model?

## 12. Acceptance criteria

This docs-only task is complete when:

- `docs/MULTI_SEGMENT_TICKET_DESIGN.md` exists
- the document clearly defines Ticket vs Segment/Leg vs Journey
- the current `SYD-BNE-AYQ` bug is documented
- the correct route-map rule is documented
- the future ticket-detail UI structure is documented
- the future stub behavior is documented
- the future duration rules are documented
- `docs/ISSUE_CHECKLIST.md` contains `SEGMENT-DESIGN-001` and the follow-up segment tasks
- `docs/TASKS.md` points the next recommended task to `SEGMENT-MAP-001` or `SEGMENT-DETAIL-001` after design acceptance
- no runtime code changed
- no commits were made as part of this task
- no pushes were made as part of this task
