# OVERVIEW_REDESIGN

## 1. Purpose

This document records the audit and redesign direction for the `Overview` page.

It is a design-only checkpoint for `OVERVIEW-REDESIGN-001`.

It does not:

- implement the new Overview UI
- change runtime behavior
- add dependencies
- redesign RouteMap itself
- change database schema

## 2. Current Overview Audit

### Current entry point

- `src/App.tsx`
  - `activeSection === "overview"` renders `HomePage`
- `src/pages/HomePage.tsx`
  - renders `StatisticsPanel` and `Dashboard`
- `src/components/Dashboard.tsx`
  - `mode="overview"` shows scope-summary and scope-map content

### Current data sources

- `src/App.tsx`
  - `tickets`
  - `visibleOverviewTickets`
  - `overviewFilters`
  - `selectedId` / selected ticket handoff into Tickets page
- `src/components/StatisticsPanel.tsx`
  - derives counts and ranked lists directly from `tickets`
- `src/components/Dashboard.tsx`
  - loads extra detail payloads with `getTicketDetail(...)`
  - builds overview scope summary from ticket details and route segments
  - builds overview route collection map from route/map payloads

### Current layout sections

The current Overview is split across multiple layers:

1. App-level hero in `src/App.tsx`
2. `StatisticsPanel`
   - travel insights heading
   - archive scope chips
   - transport toggle
   - year scope picker
   - ranked carriers / cities / regions
   - recent months chart
3. `Dashboard(mode="overview")`
   - current filtered scope summary
   - repeated filter/context chips
   - top carriers in scope
   - top routes
   - route collection map
   - route overview empty state

### Main clutter sources

- The page has no single clear job:
  - archive summary
  - analytics tool
  - map browser
  - filtered ticket scope inspector
  are mixed together.
- Overview content is split between `StatisticsPanel`, `Dashboard`, and the App hero, so hierarchy is weak.
- The same archive/filter context appears multiple times:
  - hero totals
  - statistics scope summary
  - dashboard scope summary
  - map context chips
- `Dashboard` still carries ticket/journey/detail DNA even when used for Overview.
- The current Overview is route-heavy:
  - top routes
  - route collection map
  - route export action
  but the product goal is broader than route inspection.
- Overview duplicates parts of other areas:
  - archive analytics overlap with Summary behavior
  - route browsing overlaps with Tickets detail and map-related flows
  - scope filtering behaves more like a data-inspection tool than a clean dashboard

## 3. New Overview Purpose

The new Overview should answer these questions within 5 seconds:

1. What is happening next in my travel archive?
2. What are my most relevant recent or upcoming journeys?
3. What does my archive look like at a glance?
4. Where should I go next in the app?

The new Overview should not try to be:

- a full analytics workbench
- a ticket-detail substitute
- a route export workspace
- a dense filter-debug surface

## 4. Proposed Information Architecture

### Recommended structure

1. Snapshot header
   - concise archive totals
   - one-sentence archive state
2. Upcoming focus
   - next journey if available
   - otherwise next upcoming ticket
3. Recent journeys
   - a compact list of recent or recently updated journeys
4. Map section
   - a compact archive travel map teaser, not a full route-analysis workbench
5. Stats strip
   - a small number of high-value metrics
6. Quick actions
   - create ticket
   - create journey
   - open tickets
   - open journeys
7. Optional subtle health panel
   - only if it helps, e.g. unresolved rail map locations or archive items needing review

### What should move out or shrink

- Current ranked carrier/city/region blocks should not dominate Overview.
  - They can move into a future dedicated analytics/statistics area or become much smaller.
- Current route collection details should shrink.
  - Top routes and export actions should not remain a primary Overview focus.
- Repeated filter chips and repeated "current scope" framing should be removed from the main Overview experience.
- Generic "Route overview" empty cards should be replaced by cleaner section-level empty states.

## 5. Proposed Section Details

### Snapshot header

Purpose:
- establish archive scale and current state fast

Likely data:
- total tickets
- total journeys
- upcoming journeys or upcoming tickets count
- completed journeys or travel days

Existing sources:
- `tickets` in `src/App.tsx`
- journey summary data already used by Journeys runtime

Notes:
- should replace the current long hero + duplicated stat cards

### Upcoming focus

Purpose:
- make Overview feel alive and useful immediately

Likely data:
- nearest upcoming journey by date
- fallback to nearest upcoming ticket if no journey exists

Existing sources:
- tickets already loaded
- journey data/service already exists

Possible new helper:
- a small Overview-focused selector for "next upcoming item"

### Recent journeys

Purpose:
- give quick access to actual trip records instead of only ticket fragments

Likely data:
- latest updated or latest dated journeys

Existing sources:
- current Journey service/runtime data

Possible new helper:
- a compact "recent journeys" selector

### Map section

Purpose:
- show archive travel footprint without turning Overview into a route-debug page

Likely data:
- existing summary/overview map payload

Existing sources:
- current `Dashboard(mode="overview")` scope-map logic
- current `RouteMap`

Notes:
- keep this compact
- remove export-first framing
- avoid overloading it with extra scope chips and route lists

### Stats strip

Purpose:
- keep only the most valuable numbers on Overview

Likely data:
- tickets
- journeys
- countries/regions visited
- travel days or segments

Existing sources:
- `StatisticsPanel`
- journey summary helpers

Notes:
- likely a much smaller replacement for the current analytics panel

### Quick actions

Purpose:
- make the page actionable, not just informational

Likely actions:
- Add ticket
- Create journey
- Browse tickets
- Browse journeys

Existing sources:
- current section navigation and modal flows

## 6. Data Requirements and Loading Behavior

### Existing reusable pieces

- ticket list already loaded in `App.tsx`
- journey runtime data/service already exists
- route-map rendering already exists
- summary/journey helper logic already exists

### Likely new Overview-specific helpers

- derive next upcoming journey
- derive next upcoming ticket fallback
- derive recent journeys list
- derive compact overview metrics from tickets + journeys
- derive a compact overview map payload instead of reusing the current route-analysis framing directly

### Empty/loading/error expectations

- Loading:
  - show one calm page-level loading shell, not multiple unrelated loaders
- Empty archive:
  - encourage adding the first ticket
- No journeys yet:
  - Overview can still show tickets and a prompt to create the first journey
- Map unavailable:
  - keep a compact fallback, not a large warning-heavy module

## 7. Risks and Boundaries

Do not touch in the first implementation pass:

- Ticket detail behavior
- Journey detail layout
- RouteMap rendering internals
- database schema
- flight lookup
- rail/place/grouping data model

Manual testing will be especially important for:

- desktop layout hierarchy
- empty states
- Overview to Tickets/Journeys navigation
- map section sizing and readability
- whether the page still feels fast with real archive data

## 8. Recommended Implementation Breakdown

- `OVERVIEW-REDESIGN-001`
  - audit and design only
- `OVERVIEW-REDESIGN-002`
  - build a new Overview layout shell with static placeholders and section structure
- `OVERVIEW-REDESIGN-003`
  - connect real ticket/journey data to the new sections
- `OVERVIEW-REDESIGN-004`
  - responsive polish, empty states, loading states, and visual cleanup
- `OVERVIEW-REDESIGN-005`
  - optional follow-up for analytics extraction or a dedicated statistics surface if still needed

## 9. Immediate Direction

- The current Overview should be rebuilt from a new layout rather than patched section by section.
- The current rail/place/grouping cleanup line is intentionally paused.
- The active product/design line is now Overview redesign.
