# ISSUE_CHECKLIST

## 1. Completed / Verified

- `SETUP-001`: `AGENTS.md` project rules created
- `DOC-001`: `PROJECT_STATUS.md` created
- `DOC-002`: `TASKS.md` created
- `DOC-003`: `TEST_PLAN.md` created
- `BL-003`: blank workspace after adding ticket fixed and manually verified
- `NAV-001`: sidebar is sticky/persistently visible
- `NAV-002`: sidebar buttons switch local sections
- `NAV-003`: switching sidebar sections scrolls the main workspace/content area back to the top and was manually verified
- `ARCH-001`: initial `HomePage` and `TicketsPage` wrappers extracted and manually verified
- `UX-003`: preview panel labels and section-specific preview scope clarified and manually verified

## 2. Implemented / Needs Checkpoint

- `ARCH-001`: page wrapper extraction has been manually verified and should be committed as a checkpoint if not already committed

## 3. Open UX / Product Issues

- `UX-001`
  - Large overview-style hero/summary still needs follow-up so that only `Overview` shows the full masthead/summary experience.
  - Status: `Open`
  - Priority: `High`

- `UX-002`
  - Overview is too long and requires scrolling to see all important content.
  - It should become a clearer dashboard with sub-section buttons/cards.
  - Status: `Open`
  - Priority: `High`

- `UX-004`
  - Journeys page only shows information for the currently selected ticket.
  - Selecting a ticket requires going to Tickets and scrolling down past add/import areas to find the list.
  - This user flow is unreasonable and needs redesign.
  - Status: `Open`
  - Priority: `High`

- `UX-005`
  - Tickets page order is not ideal. Users should see list/search/sort/filter and add/edit entry points more easily.
  - Status: `Completed / manually verified`
  - Priority: `High`

- `UX-005A`
  - Default ticket list sorting should be by time/date, newest first.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `UX-005B`
  - Tickets page should provide three list views/tabs:
    - `All tickets`
    - `Flight tickets`
    - `Rail / high-speed train tickets`
  - Default view should be `All tickets`.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `UX-005C`
  - Selecting a ticket should open a dedicated ticket detail view/page inside the Tickets section.
  - The detail view should show all relevant information for the selected ticket, including map and ticket/stub visuals where currently available.
  - The detail view should include a Back button to return to the Tickets list.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `UX-005D`
  - Add ticket should open a modal/dialog instead of expanding a form below the list.
  - OCR import should be available inside the Add ticket modal.
  - Status: `Completed / manually verified`
  - Priority: `High`

- `UX-005E`
  - Ticket list rows/cards are too large and should become compact list items.
  - Each item should show origin, destination, departure time, arrival time, carrier/operator, and flight/train number.
  - Status: `Completed / manually verified`
  - Priority: `High`

- `UX-005F`
  - Ticket list rows should not show edit/delete buttons directly.
  - Edit should be available from the ticket detail view using a pencil icon/button.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `UX-005G`
  - Ticket list items should use transport icons to distinguish flight vs train/rail.
  - Use a plane icon for flight and a train icon for train/rail.
  - Do not implement airline logos in this step.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `UX-005H`
  - Timeline mode should use the provided mobile app screenshot only as a layout reference for information density and date-grouped travel history.
  - Status: `Open`
  - Priority: `Medium`

- `UX-005I`
  - The current Card view / Timeline / saved filter view area is unclear and should be simplified or hidden unless its purpose is clear.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `UX-005J`
  - Add ticket modal close control should be a simple `X` button fixed near the modal top-right.
  - Status: `Completed / manually verified`
  - Priority: `High`

- `UX-005K`
  - Route summary in Add ticket form should be near the bottom, above Save.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `UX-005L`
  - Ticket list should paginate after `20` records per page.
  - Status: `Implemented / needs future verification with 20+ records`
  - Priority: `Medium`

- `UX-006`
  - Page intro text is too large and should be compacted into title + info icon / hover tooltip.
  - Status: `Open`
  - Priority: `Medium`

- `UX-007`
  - Page title/header should not be wrapped in large bordered cards.
  - Titles should sit directly on the page background.
  - Bordered cards should be used for real content modules only.
  - Status: `Open`
  - Priority: `Medium`

- `THEME-001`
  - Add light/day mode support later.
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

- `OCR-001`
  - OCR should be part of the Add Ticket flow, not a permanent main-page section.
  - Status: `Open`
  - Priority: `Medium`

- `SETTINGS-001`
  - Add a Settings entry at the bottom of the sidebar later.
  - It should eventually include theme mode, version/software information, data storage location, default export location, and other preferences.
  - Status: `Open`
  - Priority: `Medium`

- `EXPORT-001`
  - Export functionality should be simplified.
  - Meaningful exports should include:
    - individual flight ticket image
    - individual rail/high-speed train ticket image
    - full data export for backup/migration
    - route collection map
  - Single-record JSON/CSV export shown inside ticket detail is not useful and should be reconsidered later.
  - Status: `Open`
  - Priority: `Medium`

- `IA-001`
  - The app should follow the three-click principle and Miller’s Law / `7±2` principle.
  - Important features should be reachable in about three clicks and navigation groups should not overload users.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-001`
  - Date/time picker has no clear confirm/apply button.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-002`
  - Default travel class should be Economy / `经济舱`.
  - Status: `Open`
  - Priority: `Low`

- `DATA-001`
  - Chinese airport data is incomplete, including missing `CSX` and `XMN`.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-003`
  - Add ticket form field widths are inefficient. Short fields such as airport/station codes should be narrower and form fields should use a denser desktop grid.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `FORM-004`
  - Add ticket modal is too wide and should be narrower.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `FORM-005`
  - Add ticket form field order should explicitly follow:
    - row 1: carrier + flight/train number
    - row 2: departure + departure code + arrival + arrival code
    - row 3: departure timezone + departure time + arrival timezone + arrival time
    - then remaining fields and route summary near save
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `FORM-006`
  - The current phase is desktop-first. Do not develop mobile-specific layouts in parallel.
  - Keep only a safe responsive fallback for narrower desktop windows.
  - Full mobile adaptation should wait until the desktop workflow is stable.
  - Status: `Guiding principle`
  - Priority: `Medium`

- `DATA-002`
  - High-speed rail / train station data is almost completely missing.
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

- `UI-001`
  - Small blue uppercase eyebrow labels are redundant in many places and should be removed where they do not add meaning.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `UI-002`
  - Scrollbar styling should match the app theme instead of showing a bright white track.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `STATUS-001`
  - Current statuses `saved` / `used` / `archived` are unclear.
  - Consider `Upcoming` / `Completed` / `Cancelled`, with Archived as a separate action.
  - Status: `Needs decision`
  - Priority: `Medium`

## 4. Recommended Next Fix Order

1. Commit verified page wrapper extraction checkpoint.
2. Fix `NAV-003` scroll-to-top on sidebar section change.
3. Remove repeated top summary from non-overview pages.
4. Clean Tickets page order so list/search/add flow is easier.
5. Redesign Journeys selection flow.
6. Then handle OCR/form/map/data/status changes in later phases.
