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

## 2. Implemented / Recorded / Needs Future Verification

- `NAV-004`
  - Sidebar numeric labels were removed from primary navigation.
  - Status: `Implemented / needs manual verification`

- `SETTINGS-002`
  - Settings entry now uses a gear icon in the sidebar utility area.
  - Status: `Implemented / needs manual verification`

- `SETTINGS-003`
  - Settings is now split into `Appearance`, `Export`, and `About` subviews.
  - Status: `Implemented / needs manual verification`

- `SETTINGS-004`
  - Backup, storage placeholder, and default export location placeholder now live under `Settings > Export`.
  - Status: `Implemented / needs manual verification`

- `EXPORT-002`
  - The standalone Exports page was removed from primary sidebar navigation.
  - Status: `Implemented / needs manual verification`

- `EXPORT-003`
  - Single-ticket JSON / CSV export buttons were removed from ticket detail.
  - Status: `Implemented / needs manual verification`

- `EXPORT-004`
  - Single-ticket route map SVG export was removed.
  - Status: `Implemented / needs manual verification`

- `EXPORT-005`
  - Ticket stub preview remains the only single-ticket export action kept in ticket detail.
  - Status: `Implemented / needs manual verification`

- `UX-005L`
  - Ticket list pagination after `20` records is implemented.
  - It still needs manual verification with `20+` records.

- `FORM-006`
  - The current phase is desktop-first.
  - Do not develop mobile-specific layout work in parallel.
  - Keep only a safe fallback for narrower desktop windows until the desktop workflow is stable.

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

- `FORM-001`
  - Date/time picker still needs a clear confirm/apply behavior.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-002`
  - Default travel class should become `Economy / economy class`.
  - Status: `Open`
  - Priority: `Low`

- `DATA-001`
  - Chinese airport data is incomplete, including missing `CSX` and `XMN`.
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

- `MAP-001`
  - Map marker points do not visually align well with route line endpoints.
  - Status: `Open`
  - Priority: `Medium`

- `MAP-002`
  - Overview map should avoid large markers for every route and prefer endpoint dots plus route lines.
  - Status: `Open`
  - Priority: `Medium`

- `STATUS-001`
  - Current statuses `saved` / `used` / `archived` remain unclear and need a later semantic redesign.
  - Status: `Needs decision`
  - Priority: `Medium`

- `TICKET-EDIT-001`
  - Ticket detail Edit currently does not properly edit information.
  - Status: `Open / future task`
  - Priority: `High`

- `TICKET-EDIT-002`
  - Edit should open the same modal/form pattern as Add ticket, prefilled with current ticket data.
  - Status: `Open / future task`
  - Priority: `High`

- `TICKET-EDIT-003`
  - After saving edited ticket data, the current detail page should refresh and show updated information.
  - Status: `Open / future task`
  - Priority: `High`

- `THEME-001`
  - Add light/day mode support later.
  - Status: `Open`
  - Priority: `Medium`
