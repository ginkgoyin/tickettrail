# ISSUE_CHECKLIST

## 1. Completed / Verified / Committed / Pushed

- `SETUP-001`: `AGENTS.md` project rules created
- `DOC-001`: `PROJECT_STATUS.md` created
- `DOC-002`: `TASKS.md` created
- `DOC-003`: `TEST_PLAN.md` created
- `BL-003`: blank workspace after adding ticket fixed and manually verified
- `NAV-001`: sidebar is sticky/persistently visible
- `NAV-002`: sidebar buttons switch local sections
- `NAV-003`: switching sidebar sections scrolls the main workspace/content area back to the top and was manually verified
- `ARCH-001`: initial `HomePage` and `TicketsPage` wrappers extracted and manually verified
- `UX-001`: large overview-style hero/summary is now limited to `Overview` and was manually verified
- `UX-003`: preview panel labels and section-specific preview scope clarified and manually verified
- `UX-005`: Tickets workflow improvements were manually verified for the current desktop-first phase
- `UX-005D`: add ticket opens in a modal/dialog and was manually verified
- `UX-005E`: ticket list rows were compacted and manually verified
- `UX-005F`: edit moved out of list rows and into the detail flow, manually verified
- `UX-005G`: transport icons distinguish flight vs rail rows and were manually verified
- `UX-005J`: add-ticket modal has a visible top-right `X` close button and was manually verified
- `UX-005K`: route summary is near the bottom above save and was manually verified
- `FORM-003`: add-ticket form uses a denser desktop grid and was manually verified
- `FORM-004`: add-ticket modal width was narrowed and manually verified
- `FORM-005`: add-ticket field order and row alignment were manually verified
- `UX-006`: long page descriptions were compacted behind a smaller info affordance and manually verified
- `UX-007`: non-overview page titles are no longer wrapped in large bordered cards and were manually verified
- `UI-001`: redundant decorative eyebrow labels were reduced acceptably and manually verified
- `UI-002`: scrollbar styling now matches the app theme acceptably and was manually verified
- `UX-004`: Journeys no longer duplicate the Tickets selected-ticket detail view and was manually verified
- `JOURNEY-001`: Journeys now default to a `Summary` scaffold instead of selected-ticket detail duplication and was manually verified
- `JOURNEY-002`: Journeys now provide a lightweight `List` scaffold subview and this behavior was manually verified
- `SETTINGS-001`: Settings sidebar entry and Settings scaffold page were manually verified and pushed
- `NAV-004`: sidebar numeric labels were removed from primary navigation and were manually verified
- `SETTINGS-002`: Settings entry now uses a gear icon in the sidebar utility area and was manually verified
- `SETTINGS-003`: Settings is now split into `Appearance`, `Export`, and `About` subviews and was manually verified
- `SETTINGS-004`: backup, storage placeholder, and default export location placeholder now live under `Settings > Export` and were manually verified
- `EXPORT-002`: the standalone Exports page was removed from primary sidebar navigation and was manually verified
- `EXPORT-003`: single-ticket JSON / CSV export buttons were removed from ticket detail and were manually verified
- `EXPORT-004`: single-ticket route map SVG export was removed and was manually verified
- `EXPORT-005`: ticket stub preview remains the only single-ticket export action kept in ticket detail, manually verified
- `TICKET-EDIT-001`: ticket detail Edit now opens a working edit path and was manually verified
- `TICKET-EDIT-002`: edit now uses the same modal/form pattern as Add ticket with selected-ticket prefill, manually verified
- `TICKET-EDIT-003`: saving edited ticket data now refreshes the current detail view and was manually verified
- `TICKET-EDIT-004`: edit modal no longer includes OCR/import and was manually verified
- `TICKET-EDIT-005`: edit mode now locks the existing ticket type and was manually verified
- `TICKET-EDIT-006`: ticket number labels now reflect the selected type and were manually verified
- `FORM-007`: unclear blue helper chips were removed/hidden from forms acceptably and were manually verified
- `FORM-008`: unclear form mode/status pills were removed and manually verified
- `TICKET-DETAIL-001`: ticket detail now shows fuller ticket information, including seat/class/timezone where available, and was manually verified
- `LOCATION-001`: Add/Edit location suggestions are now scoped by ticket type and were manually verified
- `LOCATION-002`: flight mode now suggests only airports and train/rail mode now suggests only stations, manually verified
- `LOCATION-003`: location input placeholders now match the selected ticket type for airport vs station wording and were manually verified
- `FORM-002`: new ticket drafts now default `Cabin / Class` to `Economy` while edit mode preserves existing class values, and this was manually verified
- `DATA-001`: global airport data support now uses a generated OurAirports-based dataset instead of only a small manual starter list, and this was manually verified
- `DATA-004`: airport data generation from a maintained external source with documented filtering/regeneration was implemented and manually verified
- `DATA-005`: Chinese airport aliases now supplement global airport data for better Chinese search, and this was manually verified
- `DATA-006`: generated airport data now preserves latitude/longitude for route-map usage, and this was manually verified
- `MAP-DATA-001`: generated airport suggestion data is now connected to map coordinate resolution and was manually verified
- `MAP-DATA-002`: flight route maps now resolve coordinates by airport code from generated airport data and this was manually verified
- `MAP-001`: map endpoint dots now align with route line endpoints and this was manually verified
- `MAP-002`: overview/summary maps now stay label-free while keeping aligned route endpoints, and this was manually verified

## 2. Implemented / Recorded / Needs Future Verification

- `UX-005L`
  - Ticket list pagination after `20` records is implemented.
  - It still needs manual verification with `20+` records.

- `FORM-001`
  - Clear confirm/apply behavior for date/time inputs is deferred for now.
  - Status: `Deferred / not implementing now`

- `FORM-001A`
  - In-picker confirmation inside a date/time popover is deferred for now.
  - Status: `Deferred / not implementing now`

- `FORM-001B`
  - Replacing native `datetime-local` with a lightweight custom popover is deferred for now.
  - Status: `Deferred / not implementing now`

- `FORM-006`
  - The current phase is desktop-first.
  - Do not develop mobile-specific layout work in parallel.
  - Keep only a safe fallback for narrower desktop windows until the desktop workflow is stable.

- `MAP-004`
  - Endpoint dots now use the same color as their corresponding route line.
  - Status: `Implemented / needs manual verification`

- `MAP-005`
  - Current non-Journey-total maps now use one shared route color.
  - Status: `Implemented / needs manual verification`

- `I18N-002`
  - The current phase should finish the English UI first before Chinese localization is implemented.
  - Status: `Recorded / principle`
  - Priority: `Medium`

- `IA-001`
  - The app should follow the three-click principle and Miller's Law / `7+/-2` principle as ongoing design guidance.

## 3. Confirmed Journey Decisions

- `JOURNEY-DECISION-001`
  - Journeys should be manually created first.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-002`
  - Creating a journey should start by selecting/checking tickets from a ticket list.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-003`
  - Journey List uses `title` as the main title.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-004`
  - `destination` is secondary metadata in the journey list.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-005`
  - Companions start as free-text names, with future quick suggestions/autocomplete after names have been used once.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-006`
  - The default year filter should be `All years`.
  - Status: `Confirmed / design accepted`

- `JOURNEY-DECISION-007`
  - Future tables should be `journeys`, `journey_tickets`, and `journey_companions`.
  - Status: `Confirmed / design accepted`

## 4. Journey Work Not Started

- `JOURNEY-003`
  - Journey list items should show compact trip-level information such as title, destination, duration, date range, and optional total distance.
  - Status: `Open / needs design`
  - Priority: `Medium`

- `JOURNEY-004`
  - Journey detail should represent a trip record that can include multiple tickets, multiple segments, companions, notes, total distance, total duration, and a route map.
  - Status: `Open / needs design`
  - Priority: `High`

- `JOURNEY-005`
  - Tickets and journeys should use a many-to-many relationship: one ticket can belong to multiple journeys, and a ticket can also belong to none.
  - Status: `Open / future data model`
  - Priority: `High`

- `JOURNEY-006`
  - Journeys Summary should show trip-level aggregates such as total journeys, destination statistics, companion statistics, total distance/days, and a journey map.
  - Status: `Open / needs design`
  - Priority: `Medium`

- `JOURNEY-007`
  - Journey map rendering should use one distinct color per journey and support all-years / selected-year views.
  - Status: `Open / future map design`
  - Priority: `Medium`

- `MAP-003`
  - Overview map should later support all-years and selected-year filtering, aligned with Journey map year filtering.
  - Status: `Open / future`
  - Priority: `Medium`

## 5. Future Backlog / Not Started

- `UX-002`
  - Overview is still too long and needs a clearer dashboard structure.
  - Status: `Open`
  - Priority: `High`

- `UX-005H`
  - Timeline mode should later use the provided mobile reference only for information density and date-grouped travel history.
  - Status: `Open`
  - Priority: `Medium`

- `OCR-001`
  - OCR should eventually be fully redesigned as part of the add-ticket flow.
  - Status: `Open`
  - Priority: `Medium`

- `DATA-002`
  - High-speed rail / train station data is almost completely missing.
  - Status: `Open`
  - Priority: `Medium`

- `BRAND-001`
  - Airline logo/icon data is missing.
  - Status: `Open`
  - Priority: `Medium`

- `BRAND-002`
  - If airline logo/color data is available later, ticket row/card theme color should use airline branding colors.
  - Status: `Open`
  - Priority: `Medium`

- `EXPORT-001`
  - Export functionality should later be simplified around meaningful user-facing exports.
  - Status: `Open`
  - Priority: `Medium`

- `JOURNEY-MAP-001`
  - Single journey detail maps should show labels for each point.
  - Status: `Open`
  - Priority: `Medium`

- `JOURNEY-MAP-002`
  - Journey summary/total maps should behave like the Overview map and not show point labels by default.
  - Status: `Documented / prepared`
  - Priority: `Medium`

- `JOURNEY-MAP-003`
  - Only the future Journeys total map should use journey-based color grouping.
  - Status: `Open / future journey map task`
  - Priority: `Medium`

- `TICKET-DELETE-001`
  - Ticket detail should provide a delete action.
  - Status: `Open / future task`
  - Priority: `High`

- `TICKET-DELETE-002`
  - Delete action should be a red trash icon beside the edit button.
  - Status: `Open / future task`
  - Priority: `High`

- `TICKET-DELETE-003`
  - After deleting a ticket, return to the list and refresh selected/list state safely.
  - Status: `Open / future task`
  - Priority: `High`

- `STATUS-001`
  - Current statuses `saved` / `used` / `archived` remain unclear and need a later semantic redesign.
  - Status: `Needs decision`
  - Priority: `Medium`

- `THEME-001`
  - Add light/day mode support later.
  - Status: `Open`
  - Priority: `Medium`

- `I18N-001`
  - Settings should later support language switching between English and Chinese.
  - Status: `Open / future`
  - Priority: `Medium`
