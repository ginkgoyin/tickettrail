# JOURNEY_DESIGN

## 1. Purpose

This document defines Journeys as travel records / trip collections rather than a duplicate single-ticket detail screen.
Its goal is to keep the future Journeys section distinct from Tickets before any Journey UI implementation begins.

## 2. Confirmed Decisions

- Journey creation
  - Journeys should be manually created first.
  - The first implementation should let the user create a journey by selecting/checking tickets from a ticket list.
  - Automatic journey inference can be considered later, but not in the first implementation.

- Journey list title
  - Journey List should use `title` as the main title.
  - `destination` should be secondary metadata.
  - Example:
    - Main title: `Jiangzhehu trip 2026`
    - Secondary details: `Shanghai · Hangzhou · 4 days · 3 tickets`

- Companions
  - Companions should start as free-text names.
  - After names have been used once, the app should offer them as quick suggestions/autocomplete options later.
  - A full contacts system is not part of the first implementation.

- Year filter
  - The default year filter should be `All years`.

- Data model direction
  - Future relationship tables should use:
    - `journeys`
    - `journey_tickets`
    - `journey_companions`
  - This confirms the many-to-many direction between tickets and journeys.
  - Schema work is still deferred.

## 3. Product Distinction

- Tickets
  - Single ticket management
  - Search, filter, sort, add, edit, inspect one ticket
  - Owns single-ticket detail, route preview, and ticket/stub-related actions

- Journeys
  - Grouped travel records / trip collections
  - Represents one trip that may include multiple tickets and segments
  - Owns journey summary, journey list, journey detail, and journey-level map/statistics

- Overview
  - Whole archive summary
  - High-level counts, archive-wide map, archive-wide statistics

- Map
  - Route map exploration
  - Focuses on route collections, time filters, and visual map inspection

## 4. Journey Navigation

- Entering `Journeys` should open `Summary` by default.
- `Summary` is the default Journeys subview.
- `List` is the second Journeys subview.
- Future sidebar behavior can support:
  - `Journeys`
    - `Summary`
    - `List`
- Clicking `Journeys` or `Summary` should open the summary view.
- Clicking `List` should open the journey list.

## 5. Journey Data Concept

Core Journey fields should conceptually include:

- `id`
- `title`
- `destination`
- `start_date`
- `end_date`
- `duration`
- `total_distance`
- `companions`
- `notes`
- `created_at`
- `updated_at`

Linked transport should conceptually include:

- linked ticket ids
- segment ordering
- optional per-ticket role or note

Examples of per-ticket role/note:

- trip start
- trip end
- internal transfer
- outbound
- return
- custom note

## 6. Ticket-Journey Relationship

Journeys should use a many-to-many relationship:

- a ticket can belong to multiple journeys
- a ticket can belong to no journey
- a journey can contain multiple tickets

This means Journeys should not be modeled as a single `journeyId` field directly on each ticket.

Confirmed conceptual tables to consider later:

- `journeys`
- `journey_tickets`
- `journey_companions`

Schema work is not part of this document and should not be implemented yet.

## 7. Journeys Summary View

Journeys Summary should eventually show:

- total number of journeys
- total travel days
- total distance
- most visited destination
- most frequent companion
- yearly filter
- journey route map

Possible additional summary blocks:

- destination ranking
- trip frequency by year
- average journey duration

## 8. Journey List View

Each journey list item should remain simple and compact.

Recommended content:

- title
- destination as secondary metadata
- date range
- duration
- ticket count
- total distance
- companion count or names
- simple route summary

The goal is to help the user scan trips quickly, not to repeat the full ticket-detail layout.

## 9. Journey Detail View

Journey detail should show trip-level information, not single-ticket ownership screens.

Recommended detail content:

- title
- date range
- destination
- companions
- linked tickets
- segment list
- total distance
- total duration
- route map
- notes
- edit action

Journey detail should be able to reference multiple linked tickets while keeping the journey itself as the primary object.

## 10. Journey Map Rules

- each journey has one color
- all segments inside a journey use the same color
- if the same route appears multiple times, use the color of the most recent journey containing that route, but make the line thicker
- support:
  - all journeys
  - selected year
- Overview map should later support:
  - all years
  - selected year

These rules should apply both to journey-level map views and to future archive-level overview map filters.

## 11. Implementation Phases

### Phase 0

- Documentation only

### Phase 1

- Replace the current Journeys selected-ticket duplication with a safe placeholder or summary scaffold

### Phase 2

- Add Journey Summary and Journey List UI using existing ticket data if possible, without schema changes
- Create journeys manually first by selecting/checking tickets from a ticket list

### Phase 3

- Design and implement data model for real Journey entities

### Phase 4

- Add many-to-many ticket-journey linking

### Phase 5

- Add companions and companion statistics
- Reuse previously entered companion names as suggestions/autocomplete options

### Phase 6

- Add journey-colored map and yearly filtering

## 12. Risks

- Avoid duplicating Tickets detail inside Journeys
- Avoid premature schema changes
- Avoid breaking existing ticket flows
- Journey map color logic may become complex
- Many-to-many relationship design will need careful migration planning

## 13. Open Questions

- How should a ticket be split across multiple journeys?
- Can a journey include only part of a multi-segment ticket?
- How should journey colors be assigned and persisted?
- When automatic inference is explored later, how should it coexist with manual journey creation?
