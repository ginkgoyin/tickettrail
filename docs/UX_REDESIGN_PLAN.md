# UX_REDESIGN_PLAN

## 1. Purpose

This document organizes the next product and UX improvement direction for TicketTrail after the BL-003 stabilization work.
The current goal is not to start a large refactor immediately, but to capture the desired user experience, information architecture, and safe implementation phases before UI changes begin.

## 2. Current UX Problems

- The app currently behaves like a single stacked workspace instead of clearly separated product areas.
- The sidebar is mostly static and does not currently switch real sections/pages.
- The sidebar is not persistently visible enough and may require scrolling to reach key options.
- OCR/import is shown as a permanent workspace section instead of being part of the add-ticket flow.
- Current ticket status labels such as `saved`, `used`, and `archived` are unclear from a user perspective.
- Location coverage is incomplete, especially for Chinese airports and high-speed rail / train stations.
- Map marker positioning and route-line rendering do not always align visually, and overview maps can become too cluttered.

## 3. Target Information Architecture

### Home

- Purpose:
  - Provide a clear overview dashboard for the whole archive.
- Main content:
  - Total ticket count
  - Flight and train summary counts
  - Total travel distance / flight distance
  - Overview map
  - High-level travel statistics
- Main actions:
  - Jump to add a ticket
  - Jump to ticket lists
  - Jump to map/statistics/backup areas

### Flight Tickets

- Purpose:
  - Manage flight tickets as a focused list view.
- Main content:
  - Flight ticket list
  - Search
  - Sort by name, airline, date
  - Filters if needed
- Main actions:
  - Add flight ticket
  - Edit flight ticket
  - Open ticket detail

### Train Tickets

- Purpose:
  - Manage high-speed rail / train tickets as a focused list view.
- Main content:
  - Train ticket list
  - Search
  - Sort by name, operator, date
  - Filters if needed
- Main actions:
  - Add train ticket
  - Edit train ticket
  - Open ticket detail

### Map

- Purpose:
  - Show route-map overview without mixing all archive editing tools into the same view.
- Main content:
  - Route overview map
  - Selected route map
  - Visual route summaries
- Main actions:
  - Inspect routes
  - Switch between selected-route and overview context

### Statistics

- Purpose:
  - Show detailed travel analytics separate from routine ticket editing.
- Main content:
  - Aggregate counts
  - Travel patterns
  - Filter-aware summaries
- Main actions:
  - Review travel insights
  - Apply relevant filters if supported later

### Journeys

- Purpose:
  - Represent grouped travel records / trip collections rather than single-ticket detail screens
- Main content:
  - Journey Summary
  - Journey List
  - Journey detail later
  - Journey-level map and statistics later
- Main actions:
  - Open journey summary
  - Browse trip history
  - Open a journey detail record
- Confirmed direction:
  - Journeys should be created manually first
  - The first creation flow should let the user select/check tickets from a list
  - Journey List should use `title` as the main title and `destination` as secondary metadata
  - Secondary metadata should emphasize destination, date range, duration, and ticket count
  - Companions should start as free-text names with later suggestion/autocomplete behavior
  - The default year filter should be `All years`

### Backup / Export

- Purpose:
  - Group all data safety and output actions into one operational area.
- Main content:
  - Backup
  - Restore
  - Archive import/export
  - Ticket stub export
  - CSV/JSON/SVG/PNG export entry points
- Main actions:
  - Create backup
  - Restore backup
  - Export/import archive
  - Export ticket outputs

### Settings (later)

- Purpose:
  - Hold configuration and preferences only if needed after the main flows are stable.
- Main content:
  - Optional future settings such as defaults, appearance, and data-path-related preferences
- Main actions:
  - Adjust application preferences
- Notes:
  - This is lower priority than core usability and does not need to be part of the immediate redesign scope.

## 4. Add Ticket Flow Redesign

- Add-ticket entry should come from `Flight Tickets` and `Train Tickets` rather than from a large permanent main-page form.
- The add flow should open in a focused modal or dedicated side panel.
- The add flow should include:
  - Manual input tab
  - OCR import tab
  - Text import tab if needed
- OCR should not remain visible as a permanent main-page block.
- OCR should be available inside the add-new flow, likely as a modal section or tab.
- Default travel class should be `Economy / 经济舱`.
- Date/time picking should include a clear confirm/apply behavior so the user knows the selection is finalized.
- The add flow should return the user to a usable list/detail state after save, without shifting the whole workspace into an unstable state.

## 5. Location Data Plan

- Expand airport seed data beyond the current limited coverage.
- Add missing Chinese airports called out in feedback first, including:
  - `CSX` Changsha Huanghua International Airport
  - `XMN` Xiamen Gaoqi International Airport
- Add a train/high-speed rail station seed source or seed file, since current rail coverage appears to be largely missing.
- Keep location selection searchable and practical for manual entry and OCR/import correction.
- If a location is unknown:
  - allow manual text entry
  - avoid crashing or blocking the whole flow
  - clearly indicate that the location could not be matched to known seed data

## 6. Map Behavior Plan

### Single selected route mode

- Show only:
  - origin marker
  - destination marker
  - route line
- Avoid extra visual clutter in the focused selected-ticket map.

### Overview mode

- Prefer route lines and small endpoint dots rather than large marker cards for every route.
- Avoid placing large labels/markers everywhere when many routes are visible.
- Keep the overview map readable first, decorative second.

### Marker rules

- Selected route:
  - origin and destination markers only
- Overview route collection:
  - endpoint dots and route lines only unless a route is actively focused

### Endpoint alignment expectations

- Marker coordinates should visually align with the route endpoints.
- If route projection or marker anchoring creates visible mismatch, the line/marker rendering rules should be adjusted.

### Fallback behavior

- If coordinates are missing or invalid:
  - do not crash
  - do not blank the workspace
  - show a safe fallback such as “Route map unavailable for this ticket.”

## 7. Ticket Status Redesign

### Current status labels

- `saved`
- `used`
- `archived`

### Proposed clearer statuses

- `Upcoming`
- `Completed`
- `Cancelled`

### Archived recommendation

Recommendation:
- treat `Archived` as a separate hide/archive action rather than a primary travel status

Reasoning:
- `Upcoming`, `Completed`, and `Cancelled` describe the travel state clearly
- `Archived` describes visibility/organization behavior rather than trip outcome
- separating archive/hide behavior from trip status should make filtering and user understanding clearer

Notes:
- This may require a later data-model and migration decision, so it should be handled after the main UX structure is agreed.

## 8. Implementation Phases

### Phase 1

- Document UX decisions
- Fix sticky/persistent sidebar visibility
- Make sidebar buttons switch visible sections without requiring a full router rewrite if possible

### Phase 2

- Split `Home`, `Flight Tickets`, and `Train Tickets` at the UI level
- Keep the current data model unchanged if possible
- Avoid a large architecture rewrite during this phase
- Short-term Journeys work should only introduce a `Summary + List` scaffold, not a duplicate ticket-detail page
- Short-term Journeys creation should be manual-first and ticket-list-driven

### Phase 3

- Move OCR into the Add Ticket flow
- Improve date/time picker behavior
- Set default class to `Economy / 经济舱`

### Phase 4

- Expand airport and train-station data
- Improve map marker/line rendering
- Reduce overview-map clutter

### Phase 5

- Revisit ticket-status semantics
- Decide whether migration is needed for status/archive behavior

### Long-term Journeys note

- Journeys should eventually use a real many-to-many ticket relationship
- One ticket may belong to multiple journeys
- One ticket may belong to none
- The future table direction is `journeys`, `journey_tickets`, and `journey_companions`
- This should be handled only after the desktop ticket workflow is stable

## 9. Risks

- Avoid redesigning the full UI all at once.
- Avoid breaking the recently stabilized add-record flow while improving UX.
- Status-model changes may require migration or compatibility handling.
- Location seed data may become large and needs a manageable source/update strategy.
- Map-behavior changes require regression testing because map rendering has already been a stability risk area.

## 10. Open Questions

- Should `Flight Tickets` and `Train Tickets` become fully separate pages, or should they remain filtered views over one shared ticket model?
- Should `Archived` remain a status, or become a separate hide/archive action?
- Which Chinese airports and train stations should be prioritized first beyond `CSX` and `XMN`?
- Should OCR support both image-based OCR and pasted text in the same add flow?
- Should the next release prioritize stability first, or begin UX redesign work immediately after the current blocking bugs are resolved?
