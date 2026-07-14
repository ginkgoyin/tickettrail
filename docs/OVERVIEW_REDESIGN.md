# OVERVIEW_REDESIGN

## 1. Purpose

This document records the audit and redesign direction for the `Overview` page.

It records the design checkpoints for `OVERVIEW-REDESIGN-001` and `OVERVIEW-REDESIGN-001A`, plus the runtime Overview rebuild work through `OVERVIEW-REDESIGN-003`.

It does not:

- redesign RouteMap internals
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

## 4. Approved V1 Information Architecture

`OVERVIEW-REDESIGN-001A` records the user-approved V1 direction.

Accepted V1 product direction:

- Overview should feel like a clean personal travel archive home.
- It should not feel like an analytics workbench.
- It should not feel like a route-debug page.
- The page should start with total/archive overview, then map, then focus trip.
- Quick actions are not needed in Overview V1.
- Data health or pending-item reminders should not live on Overview V1.
  - Those can become future filters or reminder surfaces inside Tickets/Journeys list pages.
- Future customization is acceptable as a later idea.
  - For example, users may later choose which Overview modules to show from Settings.
  - This is recorded only as a future idea and should not affect V1 implementation.

### Approved V1 section order

1. Archive Snapshot / Total overview
   - total journeys
   - total tickets
   - travel days
   - total cost if available
   - destinations / places if available
2. Full-width Travel Map
   - one full-width row
   - show the whole travel footprint as much as possible
   - stay visual and clean, not a route-analysis workbench
3. Focus Trip
   - show next journey if available
   - if no upcoming journey, show latest completed or recent journey
   - if no journey, fall back to next upcoming ticket
   - if no ticket, show a clean empty archive state
   - cost should be subtle when available, not dominant
4. Recent Journeys + Upcoming/Recent Tickets
   - Journey is more important
   - Tickets are secondary or fallback
   - ticket module should prefer upcoming tickets, otherwise show recently added tickets
5. This year + Favorite places
   - lightweight memory/highlight row
   - not dense analytics

### What should move out or stay out of V1

- Current ranked carrier/city/region blocks should not dominate Overview V1.
  - They can move into a future dedicated analytics/statistics area or return later in a lighter form.
- Current route collection details should shrink sharply.
  - Top routes and export actions should not remain a primary Overview focus.
- Repeated filter chips and repeated "current scope" framing should be removed from the main Overview experience.
- Generic "Route overview" empty cards should be replaced by cleaner section-level empty states.
- Quick actions should not appear in Overview V1.
- Data-health or pending-review reminders should not appear in Overview V1.

## 5. Approved V1 Section Details

### Archive Snapshot / Total overview

Purpose:
- establish archive scale and current state fast

Likely data:
- total tickets
- total journeys
- travel days
- total cost if available
- destinations / places if available

Existing sources:
- `tickets` in `src/App.tsx`
- journey summary data already used by Journeys runtime

Notes:
- should replace the current long hero + duplicated stat cards

### Full-width Travel Map

Purpose:
- show archive travel footprint early in the page
- support the emotional/archive value of the product rather than route debugging

Likely data:
- existing summary/overview map payload

Existing sources:
- current `Dashboard(mode="overview")` scope-map logic
- current `RouteMap`

Notes:
- full-width row
- should show the whole travel footprint as much as possible
- should stay visual and clean
- should not inherit route-analysis framing, export-first framing, or dense scope chips

### Focus Trip

Purpose:
- make Overview feel alive and useful immediately

Likely data:
- next journey if available
- otherwise latest completed/recent journey
- otherwise next upcoming ticket
- otherwise empty archive state

Existing sources:
- tickets already loaded
- current Journey service/runtime data

Possible new helper:
- a small Overview-focused selector for the focus trip fallback chain

Notes:
- cost should be subtle when available

### Recent Journeys + Upcoming/Recent Tickets

Purpose:
- give quick access to real trip records first, then secondary ticket-level activity

Likely data:
- recent journeys
- upcoming tickets
- recent tickets fallback

Existing sources:
- current Journey service/runtime data
- ticket list already loaded in `App.tsx`

Notes:
- Journey should remain the primary module in this row.
- Tickets should be the secondary/fallback module.

### This year + Favorite places

Purpose:
- provide memory/highlight modules without returning to dense analytics

Likely data:
- this-year travel highlights
- favorite places / most visited places

Existing sources:
- journey summary helpers
- existing summary helpers where useful

Notes:
- should stay lightweight and memory-oriented
- should not become a ranked analytics wall

## 6. Data Requirements and Loading Behavior

### Existing reusable pieces

- ticket list already loaded in `App.tsx`
- journey runtime data/service already exists
- route-map rendering already exists
- summary/journey helper logic already exists

### Likely new Overview-specific helpers

- derive archive snapshot totals for Overview V1
- derive focus trip fallback chain
- derive recent journeys list
- derive upcoming tickets with recent-ticket fallback
- derive lightweight "this year" and favorite-place highlights
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
- `OVERVIEW-REDESIGN-001A`
  - record the user-approved V1 layout decisions and shared map styling requirements
- `OVERVIEW-REDESIGN-002`
  - implement the new Overview layout shell and remove the old `StatisticsPanel` + `Dashboard(mode="overview")` composition from Overview
  - reuse existing ticket, journey, and map data where it is already available without broad new data plumbing
- `OVERVIEW-REDESIGN-002A`
  - tighten layout density, reduce heading/copy noise, flatten nested mini-card weight, and add a compact `All / Flights / Rail` transport scope toggle
  - keep the approved section order and reuse the existing shell rather than introducing new major modules
- `OVERVIEW-REDESIGN-002B`
  - audit and refine transport-scope behavior so Journey cards match scope by linked transport presence while still rendering as whole journeys
  - keep ticket/map modules transport-scoped by ticket type and avoid pretending scoped Journey views are hard transport splits
- `OVERVIEW-REDESIGN-003`
  - refine section-level data selectors, fallback behavior, and Overview-specific helpers without changing the approved information architecture
  - keep the transport toggle as a scope matcher, not a journey splitter
  - keep scoped journey cards whole while scoping ticket/map/favorite-place modules directly by transport
- `MAP-ROUTE-STYLING-001`
  - shared map route-line styling follow-up for color/thickness/repeated-route behavior
- `OVERVIEW-REDESIGN-004`
  - responsive polish, empty states, loading states, and visual cleanup

## 9. Shared Map Styling Follow-up

These requirements are approved for future implementation but are not part of this docs-only task.

Follow-up task:

- `MAP-ROUTE-STYLING-001`

Approved requirements:

- rail and flight route lines should use different colors
- all route lines should be thinner than the current map line style
- repeated routes should be visibly thicker than one-off routes
- use a simple binary thickness rule:
  - one occurrence = thin line
  - two or more occurrences = thicker line
  - do not keep increasing thickness for 3, 5, 10+ occurrences

Scope note:

- this is a shared map behavior follow-up, not an Overview-only styling tweak
- it should be implemented separately from the first Overview layout rebuild

## 10. Immediate Direction

- The current Overview should be rebuilt from a new layout rather than patched section by section.
- The current rail/place/grouping cleanup line is intentionally paused.
- The active product/design line is now Overview redesign.
- `OVERVIEW-REDESIGN-002A` now refines that shell with denser spacing, simpler headings, and a top transport-scope toggle.
- `OVERVIEW-REDESIGN-003` now refines Overview data wiring and fallback behavior without reintroducing the old analytics-heavy Overview composition.
- The transport toggle remains a scope matcher:
  - `All` uses all journeys and tickets
  - `Flights` uses journeys containing at least one flight ticket plus flight tickets/routes directly
  - `Rail` uses journeys containing at least one rail ticket plus rail tickets/routes directly
- Mixed journeys can appear in both `Flights` and `Rail`, but they continue to render as whole journey cards.
- Snapshot and This year travel-day totals intentionally use full matching journey days in scoped views instead of trying to split mixed journeys into transport-only day fragments.
- Favorite places now follow two paths:
  - `All` can still use Journey/Summary destination rollups
  - `Flights` and `Rail` use ticket-derived places/endpoints so scoped views do not inherit mixed whole-journey rollups
- Scoped empty states should stay concise:
  - `No travel records yet.`
  - `No flight records in this scope.`
  - `No rail records in this scope.`