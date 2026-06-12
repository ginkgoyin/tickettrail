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
- `AIRPORT-DATA-007`
  - Generated airport data now preserves municipality/place metadata for the unified location directory direction and future Journey place normalization.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `MAP-DATA-001`: generated airport suggestion data is now connected to map coordinate resolution and was manually verified
- `MAP-DATA-002`: flight route maps now resolve coordinates by airport code from generated airport data and this was manually verified
- `MAP-001`: map endpoint dots now align with route line endpoints and this was manually verified
- `MAP-002`: overview/summary maps now stay label-free while keeping aligned route endpoints, and this was manually verified
- `BL-004`: workspace render error after the latest map zoom/world-boundary attempt was fixed by restoring the last stable RouteMap behavior, and this rollback was manually verified
- `TICKET-DATA-001`: flight tickets now support optional `departureTerminal` / `arrivalTerminal` fields without breaking existing tickets, and this was manually verified
- `TICKET-DATA-001A`: optional departure/arrival terminal fields were added to the ticket data model and manually verified
- `TICKET-DATA-001B`: Add/Edit forms now support flight terminal fields while keeping train/rail forms unchanged, manually verified
- `TICKET-DATA-001C`: Ticket detail now displays flight terminal information compactly and this was manually verified
  - Current inline display should normalize flight terminals to a `T n` style such as `T 2`.

- `FLIGHT-LOOKUP-001`
  - Add/Edit flight tickets should support a lightweight flight-number-plus-date lookup scaffold that returns candidate flight details for manual apply.
  - Status: `Completed / manually verified`
  - Priority: `Medium`

- `FLIGHT-LOOKUP-002`
  - Real provider integration requires provider selection, adapter architecture, and a secure backend/Tauri boundary before any live API is connected.
  - Status: `Documented / future provider integration`
  - Priority: `High`

- `FLIGHT-LOOKUP-003`
  - Real flight lookup credentials must not be exposed in the frontend bundle; provider secrets belong in a safer backend or desktop-only boundary.
  - Status: `Open / safety rule`
  - Priority: `High`

- `FLIGHT-LOOKUP-004`
  - Provider-specific responses should be normalized into a common `FlightLookupCandidate` format before the UI consumes them.
  - Status: `Documented / future architecture`
  - Priority: `High`

- `DATA-SOURCE-001`
  - Settings should show a lightweight future placeholder for flight lookup provider/API configuration without storing or using a real key in this phase.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `DATA-SOURCE-002`
  - Settings should later support secure provider/API key configuration through a safer desktop-side boundary rather than frontend-only storage.
  - Status: `Open / future settings architecture`
  - Priority: `High`

- `FLIGHT-LOOKUP-005`
  - Provider review should compare real flight-data candidates and recommend a first provider before any live integration begins.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `FLIGHT-LOOKUP-006`
  - Define the first Tauri command contract for real provider lookup, including normalized request, response, and error payloads.
  - Status: `Implemented / needs review`
  - Priority: `High`

- `FLIGHT-LOOKUP-007`
  - Add a backend/Tauri mock command boundary before any live provider API is connected.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `FLIGHT-LOOKUP-008`
  - Refactor flight lookup into provider adapter skeleton modules, use saved provider config when present, and keep AeroDataBox as a non-network backend skeleton until live integration is approved.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `DATA-SOURCE-003`
  - Design secure local provider configuration and API key storage for future flight lookup providers.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Phase 1 now includes local provider selection plus local API-key scaffold in Settings.
    - This is still MVP local storage, not final secure secret storage.
  - Priority: `High`

- `DATA-SOURCE-004`
  - Replace local MVP API-key storage with more secure storage before any public-release security claim is made.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `DATA-SOURCE-005`
  - Before public release, evaluate OS keychain or stronger secure storage instead of stopping at app-data secret-file storage.
  - Status: `Open / release-blocking review`
  - Priority: `High`

- `FLIGHT-LOOKUP-009`
  - Validate the AeroDataBox single-day flight-status endpoint, response schema, and normalized mapping before implementing the real adapter.
  - Status: `Completed / reviewed`
  - Priority: `High`

- `FLIGHT-LOOKUP-010`
  - Implement the first real AeroDataBox adapter against the validated single-day endpoint/schema while keeping the user-facing mock flow safe until the real provider path is explicitly wired.
  - Status: `Implemented / needs manual verification`
  - Follow-up notes:
    - Normalize provider-local times to a `datetime-local` compatible shape before filling the current form fields.
    - Remove stale mock-only lookup copy from the live-provider UI path.
    - Keep a short-lived cache for repeated identical live lookups so users do not have to wait on the provider every time.
    - Extend the same lookup/apply flow to onward flight segments without changing the current segment data model.
  - Priority: `High`

- `FLIGHT-LOOKUP-011`
  - Add a provider test-connection flow later so users can verify AeroDataBox credentials and gateway setup separately from the normal flight lookup flow.
  - Status: `Open / future enhancement`
  - Priority: `Medium`

- `FLIGHT-LOOKUP-012`
  - Add better live rate-limit and marketplace-specific AeroDataBox error handling after real-world testing clarifies the actual provider failure shapes.
  - Status: `Open / future hardening`
  - Priority: `High`

- `SEGMENT-DESIGN-001`
  - Redesign multi-segment ticket semantics and detail UI.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `SEGMENT-MAP-001`
  - Fix multi-segment route map leg construction to use consecutive segment origin/destination pairs.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `SEGMENT-STUB-001`
  - Render one ticket stub / boarding-pass-style card per segment.
  - Status: `Implemented / needs manual verification`
  - Multi-segment flight detail now allows previewing one stub-style card per segment while keeping export scoped to the currently selected stub.
  - Priority: `High`

- `SEGMENT-STUB-002`
  - Multi-segment stub export can stay limited to the currently selected segment stub for now instead of exporting every segment stub at once.
  - Status: `Open / future export refinement`
  - Priority: `High`

- `SEGMENT-STUB-003`
  - Export all segment PNGs from the current multi-segment ticket.
  - Status: `Deferred / not doing now`
  - Priority: `Low`

- `SEGMENT-DETAIL-001`
  - Redesign ticket detail into itinerary summary, segment list, route map, stubs, and attachments.
  - Status: `Open / future implementation`
  - Priority: `High`

- `SEGMENT-DETAIL-001A`
  - Move visible segment details out of Route map into a dedicated Flight segments / Route legs module.
  - Follow-up `SEGMENT-DETAIL-001B` fixes the first-leg display bug found during manual verification.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `SEGMENT-DETAIL-001B`
  - Fix the first displayed segment in multi-segment ticket detail so it uses the next segment departure as the inferred first-leg arrival when needed.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `SEGMENT-DATA-001`
  - Audit and fix multi-segment segment-level data persistence, mapping, and display.
  - Earlier `SEGMENT-DETAIL-001B` fixed first-leg route-label reconstruction; this task fixes the deeper segment data chain.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `SEGMENT-DURATION-001`
  - Separate total travel duration, total flight time, and layover/transfer duration.
  - Status: `Open / future implementation`
  - Priority: `Medium`

- `SEGMENT-FORM-001`
  - Review Add/Edit multi-segment input UX after detail display semantics are accepted.
  - Status: `Open / future design`
  - Priority: `Medium`

- `IA-DETAIL-001`
  - Single-ticket detail modules should only render inside Ticket detail, not Overview or the deprecated Map page.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `MAP-PAGE-001`
  - Remove the redundant Map page from primary navigation because it overlaps with Overview and Ticket detail route maps.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `OVERVIEW-REDESIGN-001`
  - Redesign Overview content and layout around global dashboard information rather than selected-ticket detail.
  - Status: `Open / future design`
  - Priority: `High`

- `EXPORT-PATH-001`
  - Settings should show the current export/download folder and provide a button to open that folder.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `EXPORT-PATH-002`
  - Let users choose and persist a custom default export folder.
  - Status: `Open / future enhancement`
  - Priority: `Medium`

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

- `MAP-006`
  - Endpoint dots now scale down at low zoom so they do not block route lines as aggressively.
  - Status: `Implemented / needs manual verification`

- `MAP-007`
  - Repeated world copies are now disabled at the MapLibre runtime level for current route maps.
  - Status: `Implemented / needs manual verification`

- `MAP-008`
  - A dedicated endless-horizontal-dragging fix is deferred for the current phase.
  - After `MAP-007` disabled repeated world copies, manual verification no longer reproduced the problematic endless horizontal dragging behavior.
  - Revisit only if the issue returns.
  - Status: `Deferred / not needed for current phase`

- `TICKET-DETAIL-002`
  - Ticket detail should stop repeating large route titles once the local detail header already provides the context.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-003`
  - The older overlapping ticket-detail summary module should not keep rendering for the current ticket-detail flow.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-004`
  - Ticket information should stay compact and prioritize the main trip facts, including a computed duration.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-005`
  - Original ticket files and ticket stub preview should sit side-by-side on wider desktop layouts.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-006`
  - Low-value detail fields such as duplicated timezones, notes in the main grid, and raw coordinate cards should be removed from the main ticket-information layout.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-007`
  - Ticket information should use an explicit row order instead of a loose auto-grid so the desktop detail layout stays predictable.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-008`
  - Ticket detail should use a lightweight sticky action bar with Back, a centered title block, and Edit/Delete actions in one row.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-009`
  - The top `Tickets` page title and info icon should not stay visible while viewing ticket detail.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-010`
  - Ticket detail should use a simplified route title plus a subtler code subtitle in the sticky action bar.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-011`
  - `Route legs` explanation via an info icon is deferred for the current phase.
  - Status: `Deferred / not needed for current phase`

- `TICKET-DETAIL-012`
  - Unnecessary outer bordered/background wrappers around Ticket information, Route map, and Ticket stub preview should be removed so the detail page feels lighter.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-013`
  - Remove the Route legs info icon/helper and keep the field visually clean.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-014`
  - Remove only the extra outer wrapper around detail modules while keeping the modules themselves intact.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-015`
  - Ticket-detail module titles should use one consistent Route-map-style title treatment across Ticket information, Route map, Ticket stub preview, and Original ticket files.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-016`
  - The earlier single-row desktop layout idea for Ticket information plus Ticket stub preview was replaced by a clearer two-row ticket-detail layout.
  - Status: `Superseded by TICKET-DETAIL-016A / TICKET-DETAIL-016B`

- `TICKET-DETAIL-016A`
  - The first desktop detail row should place Ticket information on the left and Route map on the right.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-016B`
  - The second desktop detail row should place Ticket stub preview on the left and Original ticket files on the right.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-017`
  - Keep a subtle divider between the first detail row (Ticket information + Route map) and the second detail row (Ticket stub preview + Original ticket files) without reintroducing a large bordered wrapper.
  - Status: `Implemented / needs manual verification`

- `TICKET-DETAIL-018`
  - When notes exist, they should appear as the final row inside `Ticket information` instead of as a separate standalone card above the modules.
  - Status: `Implemented / needs manual verification`

- `STATUS-001`
  - Ticket detail should allow inline status updates from the Ticket information card.
  - Status: `Implemented / needs manual verification`

- `STATUS-002`
  - Current ticket-detail status labels should use clearer wording such as `Upcoming`, `Completed`, and `Archived` for the existing persisted states.
  - Status: `Implemented / needs manual verification`

- `STATUS-004`
  - Ticket detail status explanation via an info icon is deferred for the current phase.
  - Status: `Deferred / not needed for current phase`

- `STATUS-005`
  - When the ticket still uses the default auto status, the displayed status should derive from the current time as `Upcoming` or `Completed`.
  - Status: `Implemented / needs manual verification`

- `STATUS-006`
  - Ticket detail status dropdown should still allow manual override of the current persisted status model.
  - Status: `Implemented / needs manual verification`

- `STATUS-007`
  - Automatic/default status should continue to update over time based on current time when the ticket remains in auto mode.
  - Status: `Implemented / needs manual verification`
  - Display the derived status label directly without showing an `Auto:` prefix in the current detail UI.

- `STATUS-008`
  - Remove the Status info icon/helper and keep the Ticket information layout visually clean.
  - Status: `Implemented / needs manual verification`

- `STATUS-009`
  - Ticket status should not show duplicate Completed entries from separate auto-derived and manual status concepts.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Upcoming / Completed are now treated as time-derived display statuses for active tickets.
    - Archived remains the main manual status action.
    - Legacy used/completed records remain loadable but are not offered as a duplicate manual Completed option.
  - Priority: `Medium`

- `ROUTE-MAP-001`
  - Ticket detail route map should avoid repeating the route title once the header already provides the context.
  - Status: `Implemented / needs manual verification`

- `ROUTE-MAP-002`
  - Route map footer should use clearer field labels for origin coordinate, duration, and distance.
  - Status: `Implemented / needs manual verification`

- `ROUTE-MAP-003`
  - Route map footer spacing should stay compact but more readable, without adding extra endpoint arrows or time/timezone labels.
  - Status: `Implemented / needs manual verification`

- `ROUTE-MAP-006`
  - Route map header and distance badge should have more breathing room before the map container.
  - Status: `Implemented / needs manual verification`

- `ROUTE-MAP-007`
  - Route map title and distance badge should align cleanly in one header row, with a slightly larger title.
  - Status: `Implemented / needs manual verification`

- `TICKET-STUB-001`
  - Redundant ticket number text under the Ticket stub preview title should be removed.
  - Status: `Implemented / needs manual verification`

- `TICKET-STUB-002`
  - Unnecessary transport type tags such as `FLIGHT` should be removed from the Ticket stub preview header.
  - Status: `Implemented / needs manual verification`

- `ROUTE-MAP-004`
  - Do not reintroduce endpoint time/timezone labels on ticket detail maps unless a separate map-UX task proves they improve readability.
  - Status: `Open / future route-map design`

- `ROUTE-MAP-005`
  - Any future richer ticket-detail route-map labeling should be handled as a dedicated redesign task instead of mixed into routine detail cleanup.
  - Status: `Open / future route-map design`

- `TICKET-DATA-002`
  - Supporting a true `Cancelled` ticket status would require a separate data/semantics decision beyond the current `saved` / `used` / `archived` persistence model.
  - Status: `Open / future data decision`

- `UI-ENCODING-001`
  - Garbled or mojibake button/tab text in Ticket stub preview and Original ticket files should be replaced with clear English labels.
  - Status: `Implemented / needs manual verification`

- `UI-LANGUAGE-001`
  - The current detail refinement phase remains English-first; do not add Chinese localization yet.
  - Status: `Recorded / principle`

- `I18N-001`
  - Settings now include a language switch between English and Chinese for the current desktop phase.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `I18N-002`
  - The current phase should finish the English UI first before Chinese localization is implemented.
  - Status: `Recorded / principle`
  - Priority: `Medium`

- `I18N-003`
  - Core UI labels now support English / Chinese switching through the language setting.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `I18N-004`
  - User-entered ticket data and airport/station names should not be automatically translated.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `I18N-005`
  - Remaining long-tail UI strings should continue migrating to the i18n dictionary over time instead of blocking the current language-switch rollout.
  - Status: `Open / future cleanup`
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

- `JOURNEY-DESIGN-002`
  - Expand `docs/JOURNEY_DESIGN.md` into an implementation-ready Journey MVP design covering create/edit/delete flows, linked tickets, companions, notes, destination/currency/date derivation, Summary direction, and phased implementation order.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `JOURNEY-DATA-001`
  - Add the real Journey persistence model, schema direction, migration plan, and linked-ticket / companion storage.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-DATA-002`
  - Deleting a ticket removes related `journey_tickets` links without deleting the Journey itself.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-SERVICE-001`
  - Add Journey CRUD service and Tauri command boundaries after the Journey data model is accepted.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Current service boundary now provides `list/get/create/update/delete` commands plus a frontend `journeyService` wrapper.
    - `dateMode = auto` should derive `startDate` / `endDate` from linked tickets instead of trusting manual input.
  - Priority: `High`

- `JOURNEY-LIST-001`
  - Replace the current Journey List scaffold with stored Journey rows, filters, sorting, and compact trip cards.
  - Status: `Implemented / needs manual verification with JOURNEY-CREATE-001`
  - Priority: `High`

- `JOURNEY-CREATE-001`
  - Implement manual Journey creation with metadata fields, ticket selector search, and linked-ticket save flow.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-CREATE-002`
  - Polish Create Journey modal layout and add live auto date/currency preview after ticket selection.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-LIST-002`
  - Make Journey cards more compact by removing Auto dates tag and using inline title/date plus fit-content metadata tags.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-DETAIL-001`
  - Implement Journey Detail with trip summary, linked tickets, route summary, companions, notes, and a mini calendar.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Journey List cards now open a read-only Journey Detail view.
    - Detail loads the selected Journey through the existing Journey service boundary.
    - Edit and Delete controls remain disabled placeholders for future scoped tasks.
  - Priority: `High`

- `JOURNEY-DETAIL-002`
  - Linked ticket rows in Journey Detail open the existing Ticket Detail flow.
  - Status: `Implemented / needs manual verification`
  - Note: `JOURNEY-NAV-001` fixes the Back return context from Ticket Detail to Journey Detail.
  - Priority: `High`

- `JOURNEY-DETAIL-003`
  - Hide the outer Journeys page title/header while viewing Journey Detail.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-NAV-001`
  - Preserve Journey Detail return context when opening Ticket Detail from a linked ticket.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-EDIT-001`
  - Implement Journey edit flow for metadata, linked tickets, companions, and notes.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `JOURNEY-DELETE-001`
  - Implement Journey delete using a centered app-themed confirm dialog that removes only the Journey and links, not the original tickets.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-DESIGN-001`
  - Design Journeys Summary layout and statistics rules, including Travel calendar, all-time totals, top destinations, companion podium, cost by currency, and CNY exchange-rate comparison rules.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `JOURNEY-COST-001`
  - Add optional `costExchangeRateToCny` to Journey schema/model/service/Create/Edit form for Summary cross-currency cost comparison.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-COMPANION-001`
  - Save Journey companions as parsed free-text names in MVP.
  - Status: `Open / future implementation`
  - Priority: `Medium`

- `JOURNEY-COMPANION-002`
  - Later suggest previously used companion names while keeping manual free-text entry.
  - Status: `Open / future enhancement`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-001`
  - Implement real Journeys Summary runtime after Summary design is accepted and `costExchangeRateToCny` support is available or explicitly deferred.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-002`
  - Polish Journeys Summary information hierarchy by moving all-time totals into an inline Summary strip and clarifying calendar/highlight wording.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-004`
  - Extract Journeys Summary helper logic, add focused tests, and harden date/destination/cost edge-case calculations without redesigning the Summary UI.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `JOURNEY-STOPS-DESIGN-001`
  - Document the Journey Stops / Stays model, auto-derivation rules, place-normalization dependency, and future implementation order before runtime code begins.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `JOURNEY-DESTINATION-001`
  - Derive visited Summary destinations from linked ticket endpoints while excluding internal transfer cities inside multi-segment tickets.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-ROUTE-001`
  - Build Journey route summaries from ticket-level endpoints while excluding internal transfer cities inside multi-segment tickets.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-PLACE-001`
  - Normalize airport/station endpoints into Journey-level place labels so Stops and destination summaries reflect real visited places instead of raw transport endpoints.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Journey Summary and Journey Detail now normalize route/destination place labels from airport and rail metadata when available.
    - Saved ticket endpoint data remains unchanged; persisted Journey Stops are still a separate future phase.
  - Priority: `High`

- `JOURNEY-PLACE-002`
  - Remove unwanted parenthetical municipality/suburb place display and fix Journey destination autofill so auto-filled values update safely when selected tickets change.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Journey display keeps metadata-based normalization but does not add served-city overrides such as `NRT -> Tokyo`.
    - Create/Edit Journey now distinguishes auto-filled destination values from manual user edits.
  - Priority: `High`

- `TRAIN-STATION-GEO-001`
  - Add city/place metadata and coordinates for train/rail stations so rail endpoints can normalize into Journey-level Stops and future Journey mapping safely.
  - Status: `Open / future rail metadata task`
  - Priority: `High`

- `TRAIN-STATION-GEO-SPIKE-001`
  - Investigate the current rail station data pipeline, coordinate resolution gaps, and safe MVP options before implementing rail geo metadata.
  - Status: `Documented / investigation`
  - Priority: `High`

- `JOURNEY-PLACE-SPIKE-001`
  - Investigate current airport/station data and map-resolution behavior so `JOURNEY-PLACE-001` can be designed on real repository constraints instead of assumptions.
  - Status: `Documented / investigation`
  - Priority: `High`

- `LOCATION-DIRECTORY-DESIGN-001`
  - Define the unified location-directory and coordinate-resolver architecture before Journey place normalization, rail geo work, or broader map changes continue.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `LOCATION-DIRECTORY-001`
  - Unify frontend suggestion data and backend coordinate resolution around the same shared location-directory path, starting with richer airport municipality/city/place metadata and reducing dependence on the tiny backend-only seed.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `RAIL-STATION-PLACE-001`
  - Add a station-to-place metadata layer for rail endpoints so Journey place normalization can use real city/place identities before exact rail coordinates are attempted.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `TRAIN-STATION-GEO-DESIGN-001`
  - Define the future rail station geo/place metadata layer shape, source boundary, and how it should connect to Journey normalization and map resolution.
  - Status: `Open / future design task`
  - Priority: `High`

- `PLACE-CATALOG-AND-RAIL-GEO-DESIGN-001`
  - Design the next Place Catalog + transport-endpoint mapping architecture so city/place identity, exact endpoint coordinates, and city-level map fallback are clearly separated before further implementation.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `PLACE-CATALOG-001`
  - Add the first generated/curated Place Catalog data model and initial seed/generation path for standard city/place labels and city-level coordinates.
  - Status: `Open / future implementation`
  - Priority: `High`

- `TRANSPORT-PLACE-MAPPING-001`
  - Map airport and rail endpoint catalogs to a stable `defaultJourneyPlaceKey` so Journey display and Stops can consume standard place identities instead of endpoint aliases.
  - Status: `Open / future implementation`
  - Priority: `High`

- `MAP-CITY-FALLBACK-001`
  - Allow map coordinate resolution to use Place Catalog city-level coordinates when exact endpoint coordinates are unavailable, while keeping the lower precision explicit.
  - Status: `Open / future implementation`
  - Priority: `High`

- `JOURNEY-STOPS-DATA-001`
  - Add the future `journey_stops` persistence model and migration path after Stop semantics and place normalization are accepted.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-STOPS-AUTO-001`
  - Auto-derive Journey Stops from linked ticket-level endpoints while excluding internal transfer cities and preserving user-edited Stops.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `JOURNEY-STOPS-UI-001`
  - Add future Journey Stop editing/review UI, including manual add/edit/delete and stale-stop review after linked-ticket changes.
  - Status: `Open / future implementation`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-STOPS-001`
  - Move Journey Summary destination aggregation from raw Journey destination/route inference toward persisted Journey Stops when Stop data is available.
  - Status: `Open / future summary follow-up`
  - Priority: `High`

- `JOURNEY-MAP-004`
  - Add later Journey-colored map and yearly filtering only after the non-map Journey CRUD flow is stable.
  - Status: `Open / future enhancement`
  - Priority: `Medium`

- `TICKET-LIST-SEGMENT-CODE-001`
  - Ticket List and Journey linked-ticket rows should show multi-segment code summaries such as `HO1230 / HO1669` instead of only one flight/train code.
  - Status: `Open / future implementation`
  - Notes:
    - Journey Create linked-ticket selector now shows multi-segment code summaries.
    - The main Ticket List still needs its own follow-up.
  - Priority: `Medium`

- `UI-DIALOG-001`
  - Destructive confirm dialogs should use centered app-themed dialogs instead of browser/system confirms, starting with Delete Journey.
  - Status: `Implemented for Delete Journey / future cleanup for other destructive actions`
  - Priority: `Medium`

- `JOURNEY-003`
  - Journey list items should show compact trip-level information such as title, destination, duration, date range, and optional total distance.
  - Status: `Superseded by JOURNEY-DESIGN-002 and the JOURNEY-DATA/LIST/CREATE/DETAIL/SUMMARY task split`
  - Priority: `Medium`

- `JOURNEY-004`
  - Journey detail should represent a trip record that can include multiple tickets, multiple segments, companions, notes, total distance, total duration, and a route map.
  - Status: `Superseded by JOURNEY-DESIGN-002 and the JOURNEY-DATA/LIST/CREATE/DETAIL/SUMMARY task split`
  - Priority: `High`

- `JOURNEY-005`
  - Tickets and journeys should use a many-to-many relationship: one ticket can belong to multiple journeys, and a ticket can also belong to none.
  - Status: `Superseded by JOURNEY-DESIGN-002 and the JOURNEY-DATA/LIST/CREATE/DETAIL/SUMMARY task split`
  - Priority: `High`

- `JOURNEY-006`
  - Journeys Summary should show trip-level aggregates such as total journeys, destination statistics, companion statistics, total distance/days, and a journey map.
  - Status: `Superseded by JOURNEY-DESIGN-002 and the JOURNEY-DATA/LIST/CREATE/DETAIL/SUMMARY task split`
  - Priority: `Medium`

- `JOURNEY-007`
  - Journey map rendering should use one distinct color per journey and support all-years / selected-year views.
  - Status: `Superseded by JOURNEY-DESIGN-002 and the JOURNEY-DATA/LIST/CREATE/DETAIL/SUMMARY task split`
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
  - Train/rail suggestions now use generated nationwide 12306 `station_name.js` data with telecode and pinyin support.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `DATA-002A`
  - A 12306 `station_name.js`-format rail station generator and app wiring should provide the nationwide station suggestion pipeline.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `DATA-002C`
  - Rail station data can now be downloaded from the official 12306 source and regenerated locally through a script.
  - Status: `Implemented / needs manual verification`
  - Priority: `Medium`

- `DATA-008`
  - Train/rail station coordinates are a separate future task and must not be guessed from 12306 station-name data.
  - Status: `Open / future`
  - Priority: `Medium`

- `DATA-009`
  - Before public release, review whether the raw 12306 source file and the derived generated rail-station data can be redistributed.
  - Status: `Open / release-blocking review`
  - Priority: `High`

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
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `TICKET-DELETE-002`
  - Delete action should be a red trash icon beside the edit button.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `TICKET-DELETE-003`
  - After deleting a ticket, return to the list and refresh selected/list state safely.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `THEME-001`
  - Add light/day mode support later.
  - Status: `Open`
  - Priority: `Medium`

- `I18N-001`
  - Replaced by the implemented language-switch scaffold above; keep future i18n work under `I18N-005` and later follow-up items instead of re-opening this original placeholder.
  - Status: `Superseded`
  - Priority: `Medium`
