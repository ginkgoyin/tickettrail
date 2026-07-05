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

- `FLIGHT-CODE-001`
  - Normalize flight-number input into canonical full-code formatting such as `JQ661` without composing code from the carrier field.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `FLIGHT-CODE-002`
  - Flight lookup should use normalized full flight codes and block suffix-only numeric input such as `661`.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `FLIGHT-CODE-003`
  - Infer Carrier / Operator from a full flight-number prefix such as `JQ` when the airline directory has a safe exact match and the carrier field is empty.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `FLIGHT-CODE-004`
  - Warn when the selected carrier conflicts with the full flight-number prefix instead of silently overwriting the carrier field.
  - Status: `Implemented / needs manual verification`
  - Priority: `High`

- `AIRLINE-DATA-001`
  - Replace the current bootstrap airline seed with a reviewed full-source dataset/import pipeline and do not claim complete airline coverage until that work is done.
  - Status: `Open / future data pipeline`
  - Notes:
    - The current airline seed remains useful for bootstrap directory lookup but is incomplete and should not be treated as full global coverage.
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
  - Status: `Implemented / audit-design checkpoint only`
  - Notes:
    - `docs/OVERVIEW_REDESIGN.md` now records the current Overview audit, clutter sources, target page purpose, proposed information architecture, data dependencies, and phased implementation plan.
    - Current Overview runtime should be rebuilt from a new layout shell rather than incrementally patched.
    - The rail/place/grouping cleanup line remains intentionally paused while Overview redesign becomes the active product track.
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

- `JOURNEY-STAY-BLOCKS-DESIGN-001`
  - Record the confirmed Stay-block design direction: Stays become the structured Journey destination model, destination text becomes a fallback, and Unknown/grouped-stay statistics rules stay separate from normal display.
  - Status: `Documented / docs-only`
  - Priority: `High`

- `JOURNEY-DESTINATION-001`
  - Derive visited Summary destinations from linked ticket endpoints while excluding internal transfer cities inside multi-segment tickets.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - This is now a transitional endpoint-based destination pass.
    - Future Journey destination display and Summary aggregation should move to Stays instead of staying on raw route anchors or legacy destination text.
  - Priority: `High`

- `JOURNEY-ROUTE-001`
  - Build Journey route summaries from ticket-level endpoints while excluding internal transfer cities inside multi-segment tickets.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Route summary must stay distinct from the future Stays model.
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
  - Status: `Implemented / needs manual verification`
  - Notes:
    - The first generated Place Catalog is now GeoNames-backed and emitted as `src/data/place-catalog.generated.json`.
    - Due real size findings, the current default source is `cities5000.zip` instead of `cities1000.zip`.
  - Priority: `High`

- `TRANSPORT-PLACE-MAPPING-001`
  - Map airport and rail endpoint catalogs to a stable `defaultJourneyPlaceKey` so Journey display and Stops can consume standard place identities instead of endpoint aliases.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Transport endpoint -> Place Catalog mapping now lives in a separate generated file instead of rewriting the endpoint catalogs directly.
    - Journey place normalization now prefers Place Catalog standard labels when endpoint mappings exist, while raw ticket endpoint fields stay unchanged.
  - Priority: `High`

- `MAP-CITY-FALLBACK-001`
  - Allow map coordinate resolution to use Place Catalog city-level coordinates when exact endpoint coordinates are unavailable, while keeping the lower precision explicit.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Desktop route-map resolution now checks rail station place metadata and uses Place Catalog city coordinates before hardcoded or pseudo fallback.
    - Saved endpoint labels remain station names; city fallback affects coordinates only and does not claim exact station precision.
  - Priority: `High`

- `MAP-UNRESOLVED-RAIL-001`
  - Prevent recognized-but-unresolved rail stations from rendering misleading pseudo/hash map coordinates.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Recognized unresolved rail stations now return `coordinateSource = unresolved_rail_place` with no coordinates instead of falling through to pseudo map points.
    - Route distance is withheld when a rail endpoint remains unresolved, so fake long-distance chips such as `16552 km` are no longer shown.
  - Priority: `High`

- `RAIL-STATION-PLACE-COVERAGE-001`
  - Audit full generated rail-station placeKey coverage against the Place Catalog instead of only patching a few sample stations.
  - Status: `Implemented / needs review`
  - Notes:
    - The repo now has a reusable full-dataset coverage report for all generated rail stations.
    - Current review artifact: `docs/reviews/rail-station-place-review.csv`.
    - Unresolved mappings still remain and should be reviewed explicitly instead of being silently assigned coordinates.
  - Priority: `High`

- `RAIL-STATION-PLACE-VALIDATION-001`
  - Add repeatable validation for generated rail stations vs Place Catalog keys plus representative regression tests for resolved and unresolved examples.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Validation now runs through `scripts/validate-rail-station-place-coverage.mjs`.
    - Representative test coverage now checks TXP, VAB, and unresolved KUX behavior.
  - Priority: `High`

- `RAIL-STATION-PLACE-REVIEW-001`
  - Keep an explicit review queue for unresolved or low-confidence rail station -> place mappings after deterministic canonicalization is applied.
  - Status: `Open / needs human review`
  - Notes:
    - Current unresolved/problematic mappings are exported to `docs/reviews/rail-station-place-review.csv`.
    - Do not treat unresolved stations as exact or reviewed city mappings until the review queue is processed.
  - Priority: `High`

- `RAIL-STATION-PLACE-REVIEW-001A`
  - Generate a grouped unresolved rail -> GeoNames China candidate review CSV before expanding the Place Catalog with rail-needed China detail.
  - Status: `Implemented / generated candidate review CSV`
  - Notes:
    - Candidate review output now lives at `docs/reviews/rail-geonames-candidate-review.csv`.
    - Rows are grouped by unresolved `placeKey` / place-name group instead of individual station rows.
    - English/ascii/slug-only matches remain review-only and are not treated as auto-resolved additions.
  - Priority: `High`

- `PLACE-CATALOG-GEONAMES-CN-RAIL-001`
  - Add a rail-needed China GeoNames extraction pipeline on top of the existing global `cities5000` Place Catalog baseline.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - The generator now merges only the safe first review batch: `can_auto_add_place` and `can_canonicalize_to_existing_catalog`.
    - Reviewed safe matches now live in `data-sources/rail/rail-geonames-reviewed-safe-matches.json` so regeneration does not depend on the unresolved candidate review CSV.
    - The global `cities5000` baseline remains in place; the project does not blindly add every China `cities1000` record.
    - Ambiguous, slug-only, and no-candidate rows remain out of runtime data until later review work.
  - Priority: `High`

- `PLACE-CATALOG-GEONAMES-CN-RAIL-001A`
  - Final validation pass for the completed safe China rail Place Catalog expansion, including review-artifact refresh and regeneration stability checks.
  - Status: `Implemented / final validation`
  - Notes:
    - The unresolved candidate review CSV now reflects remaining review work instead of acting as generator input.
    - Safe reviewed matches were moved into a stable source file for reproducible regeneration.
  - Priority: `High`

- `PLACE-CATALOG-GEONAMES-CN-RAIL-001B`
  - Clean up the remaining candidate review artifact so key-collision rows no longer appear as safe auto-add work.
  - Status: `Implemented / conflict review cleanup`
  - Notes:
    - `cn-qianan / 杩佸畨` is now emitted as a key-conflict human-review row instead of `can_auto_add_place`.
    - The reviewed-safe source file excludes skipped conflict rows and keeps only the safe matches actually applied by regeneration.
  - Priority: `High`

- `RAIL-STATION-PLACE-OVERRIDE-001`
  - Add a reviewed override layer for unresolved or ambiguous rail station -> place mappings after grouped candidate review output exists.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Reviewed overrides now live in `data-sources/rail/rail-station-place-overrides.json` and apply only when `enabled = true` and `reviewStatus = approved`.
    - Generator-side validation now rejects duplicate/conflicting overrides, missing Place Catalog targets, and approved overrides that do not match any generated rail station.
    - Remaining hard cases are now prioritized in `docs/reviews/rail-place-override-priority.csv` for manual review.
    - KUX and `cn-qianan / 杩佸畨` remain explicit human-review cases and are not auto-resolved by this override layer.
  - Priority: `High`

- `RAIL-STATION-PLACE-OVERRIDE-001A`
  - Prepare the first small human-review worksheet for remaining override candidates without applying any reviewed overrides yet.
  - Status: `Implemented / first human review batch prepared`
  - Notes:
    - The first worksheet now lives at `docs/reviews/rail-place-override-batch-001.csv`.
    - The batch intentionally stays small and includes the user-reported `KUX / ?????` case, the `cn-qianan / 杩佸畨` key-conflict case, high-impact unresolved groups, ambiguous multi-candidate groups, and a few risky slug-only examples.
    - `data-sources/rail/rail-station-place-overrides.json` remains empty, so no reviewed override is applied by runtime generation yet.
  - Priority: `High`

- `RAIL-STATION-PLACE-OVERRIDE-001B`
  - Apply the first approved override batch only after explicit human review decisions are captured from the batch worksheet.
  - Status: `Open / paused pending documented granularity policy and reviewed override decisions`
  - Notes:
    - Do not approve KUX, `cn-qianan / 杩佸畨`, or any risky slug-only mapping without explicit evidence and a reviewed decision.
    - Any future reviewed override should represent the reviewed map/coordinate place, not a forced Journey/Summary grouping key.
  - Priority: `High`

- `RAIL-STATION-PLACE-COVERAGE-002`
  - Re-run rail station place coverage after China rail-needed Place Catalog additions and reviewed overrides are applied.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Coverage has now been regenerated after the safe GeoNames China additions and reviewed canonicalization batch.
    - Remaining unresolved groups still require review or future override work.
  - Priority: `High`

- `RAIL-PLACE-GRANULARITY-DESIGN-001`
  - Record the accepted policy that reviewed rail map places may stay more specific, while Journey/Summary should later use a separate city-level or prefecture-level grouping layer.
  - Status: `Documented / accepted policy`
  - Notes:
    - Do not collapse all reviewed rail station places to city-level just to simplify Summary.
    - Do not remove smaller Place Catalog entries.
    - Do not apply reviewed rail station overrides until this policy is documented.
  - Priority: `High`

- `JOURNEY-PLACE-GROUPING-001A`
  - Add the first safe reviewed/generated place-grouping data layer so Journey and Summary can later roll specific places up to city-level or prefecture-level identities without degrading route-map fallback accuracy.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - This checkpoint adds source data, generated data, a loader/helper, and validation only.
    - `journey_stops.placeKey` remains the specific reviewed place identity.
    - Summary Top destinations do not use the grouping map yet.
  - Priority: `High`

- `JOURNEY-PLACE-GROUPING-001B`
  - Wire the grouping layer into Summary Top destinations aggregation without changing RouteMap fallback accuracy, Journey List labels, or Journey Detail labels.
  - Status: `Implemented / manually verified`
  - Notes:
    - Summary now aggregates persisted `journey_stops.placeKey` through `summaryPlaceKey` when a reviewed grouping exists.
    - Grouping is limited to Summary Top destinations only in this checkpoint.
    - Manual verification passed for the accepted `Danyang -> Zhenjiang` example: Journey Detail still showed the specific place while Summary grouped it under Zhenjiang.
    - Persisted `journey_stops.placeKey` storage remains unchanged.
  - Priority: `High`

- `JOURNEY-PLACE-GROUPING-001C`
  - Prepare a reviewed candidate expansion worksheet for future Journey/Summary place grouping coverage without changing runtime aggregation behavior.
  - Status: `Implemented / human review captured in follow-up`
  - Notes:
    - Candidate review output now lives at `docs/reviews/place-grouping-candidate-review.csv`.
    - The worksheet keeps the current two applied seed entries as reference rows and adds a small rail-prioritized review batch only.
    - The full 30-row human review result is now preserved in the candidate worksheet and applied selectively by `JOURNEY-PLACE-GROUPING-001D`.
  - Priority: `High`

- `JOURNEY-PLACE-GROUPING-001D`
  - Apply only the explicitly approved Journey/Summary grouping rows, preserve the full human review decisions, and create a mixed placeKey repair worksheet without repairing rail placeKeys yet.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - The reviewed grouping source now contains 6 entries: the original 2 seeds plus 4 newly approved rows.
    - The candidate review CSV now preserves all 30 human review decisions: 2 `already_applied`, 4 `approved`, 1 `rejected_no_grouping_needed`, and 23 `needs_placekey_repair`.
    - Mixed rows are now tracked in `docs/reviews/place-grouping-mixed-placekey-repair.csv` instead of being auto-applied.
  - Priority: `High`

- `PLACE-GROUPING-MIXED-REPAIR-001`
  - Repair mixed rail/place candidate keys in small reviewed batches before any additional Journey/Summary grouping rows are approved from those mixed candidates.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - All 23 mixed rows from `docs/reviews/place-grouping-mixed-placekey-repair.csv` were inspected in one pass.
    - Safe exact `telecode` overrides now repair 13 rows completely and 5 rows partially without using broad place-group overrides.
    - 5 rows remain blocked on unresolved station identity rather than missing Summary grouping.
    - Current blocked rows are now explicitly documented with blockers such as `blocked_ambiguous_station_match` instead of being left as generic follow-up noise.
  - Priority: `High`

- `PLACE-GROUPING-MIXED-REPAIR-002`
  - Re-check the remaining 5 blocked mixed rows, apply only newly safe exact telecode repairs, and then pause the current rail/place/grouping cleanup line.
  - Status: `Implemented / paused after verification-only re-check`
  - Notes:
    - The 5 blocked rows were re-checked against current generated rail data, current reviewed overrides, and existing Place Catalog keys.
    - No additional safe exact telecode repair was found without lowering current map specificity or guessing unresolved station identity.
    - The remaining blocked rows are: `cn-dongsheng`, `cn-changge`, `cn-huarong`, `cn-jiashan`, and `cn-linhai`.
    - This rail/place/grouping cleanup line is now intentionally paused so the next design/implementation track can move to the complete Overview redesign.
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
  - Add future Journey Stop editing/review UI, aligned with the lightweight Stays editor direction rather than an endpoint-style stop editor, including manual add/edit/delete and stale-stop review after linked-ticket changes.
  - Status: `Open / future implementation`
  - Priority: `Medium`

- `JOURNEY-SUMMARY-STOPS-001`
  - Move Journey Summary destination aggregation from raw Journey destination/route inference toward persisted Journey Stays/Stops when that data is available.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Summary Top destinations now prefers persisted Journey Stays/Stops when present and falls back to legacy route/destination inference only for older Journeys without Stops.
    - `No destination` is no longer ranked as a Top destination row.
    - Unresolved grouped Stay blocks such as `Nara + Tokyo` now appear in a separate Summary subsection instead of splitting their days across individual places.
  - Priority: `High`

- `JOURNEY-STAYS-EDIT-001`
  - Implement the future lightweight Create/Edit Journey Stays editor with suggested ticket tags, Place/Departure rows, add/delete controls, and mixed known-date/Unknown ordering rules.
  - Status: `Implemented / needs manual verification`
  - Notes:
    - Create/Edit Journey now includes a lightweight Stays editor backed by persisted `journey_stops` rows.
    - Suggested ticket tags can auto-add confirmed destination stays, while transfer places stay suggestion-only unless the user clicks them.
    - Unknown rows currently use simple up/down ordering controls instead of full drag-and-drop.
  - Priority: `High`

- `JOURNEY-STAY-DETAILS-001`
  - Add later per-stay lodging, per-stay notes, and review prompts when linked tickets change after user-edited Stays exist.
  - Status: `Open / future enhancement`
  - Priority: `Medium`

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
  - Status: `Implemented / needs manual verification`
  - Notes:
    - The add-ticket modal now exposes separate `Manual`, `Image OCR`, and `Text import` entry tabs instead of a single mixed import block.
    - OCR/image recognition and pasted-text parsing remain part of the add-ticket flow and still apply into the same manual form review step.
  - Priority: `Medium`

- `OCR-002`
  - Rework the add-ticket `Image OCR` and `Text import` experience more substantially instead of only polishing the current first-pass layout.
  - Status: `Open / future UX redesign`
  - Notes:
    - The current modal flow is acceptable as a checkpoint, but the import area still needs a larger structural pass.
    - Revisit how `Image OCR` and `Text import` are separated, how the first-step input modules are presented, and how duplicated or confusing affordances are removed.
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
