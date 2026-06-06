# TASKS

## 1. Current Strategy

The project is currently in a feature-rich MVP / stabilization stage.
The immediate goal is to stabilize the existing single-workspace flow and verify current user-facing behavior before making structural changes.
Large refactors should wait until the main flows are manually verified and regression expectations are clearer.
For new features or behavior changes, follow the sequence: docs -> task plan -> implementation -> tests.

## 2. Task Status Legend

- [ ] Not started
- [~] In progress / partially done
- [x] Done
- [!] Blocked / needs decision

## 3. Milestone 0: Project Control And Documentation

### [x] Confirm repository-level guidance is present and followed
- Goal: Keep work aligned with the repository rules in `AGENTS.md`.
- Acceptance criteria:
  - `AGENTS.md` exists at project root.
  - New work follows the documented development, testing, and documentation rules.
- Notes:
  - This is already present and should remain the baseline.

### [~] Keep `docs/PROJECT_STATUS.md` current
- Goal: Maintain a reliable snapshot of what exists, what is unclear, and what is risky.
- Acceptance criteria:
  - Feature/status changes are reflected after meaningful milestones.
  - Open questions and risks stay current.
- Notes:
  - Needs ongoing maintenance.

### [x] Create `docs/TASKS.md`
- Goal: Record the current roadmap in the repository.
- Acceptance criteria:
  - This file exists and reflects the current stabilization-first strategy.
- Notes:
  - Created as part of the current task.

### [ ] Create `docs/TEST_PLAN.md`
- Goal: Define manual and automated verification scope for current flows.
- Acceptance criteria:
  - Core desktop flows have a documented manual checklist.
  - Existing automated tests are mapped to features they cover.
  - Gaps are explicitly listed.
- Notes:
  - Recommended before major bug-fix work expands.

### [ ] Create `docs/DATA_MODEL.md` if model/database changes are planned
- Goal: Document the current ticket, journey, segment, location, and artifact model more directly than scattered code/docs.
- Acceptance criteria:
  - Current persisted entities and important relationships are described.
  - If no immediate model changes are planned, this can wait until schema-sensitive work begins.
- Notes:
  - Only needed when model work becomes active.

### [ ] Create `docs/API_SPEC.md` or `docs/TAURI_COMMANDS.md` if command behavior needs clarification
- Goal: Document current Tauri command contracts and expectations.
- Acceptance criteria:
  - Command names, inputs, outputs, and error expectations are recorded.
  - Desktop flows that depend on commands are traceable.
- Notes:
  - Useful before deeper stabilization or UI rework.

### [ ] Review existing docs for stale or conflicting information
- Goal: Ensure current docs do not disagree about startup, release flow, or app structure.
- Acceptance criteria:
  - `README.md`, `PROJECT_STATUS.md`, setup, release, and architecture docs are cross-checked.
  - Conflicts are recorded and resolved in docs.
- Notes:
  - Needs verification.

## 4. Milestone 1: Core Flow Stabilization

### [ ] Verify desktop app startup
- Goal: Confirm the app starts reliably in normal desktop runtime.
- Acceptance criteria:
  - Release executable starts without requiring the dev server.
  - Dev runtime starts through `npm run tauri:dev`.
  - Known debug-vs-release behavior remains documented correctly.
- Test or manual verification needed:
  - Manual desktop launch of release executable and dev runtime.
- Risk level:
  - High

### [ ] Verify ticket create / edit / delete / update status
- Goal: Confirm the core ticket lifecycle works without crashes, hangs, or inconsistent state.
- Acceptance criteria:
  - Create ticket succeeds for at least one flight and one train record.
  - Edit and delete work on existing records.
  - Status updates persist and refresh correctly.
- Test or manual verification needed:
  - Manual CRUD verification in desktop runtime.
  - Regression notes should be added to `TEST_PLAN.md` when created.
- Risk level:
  - High

### [ ] Verify ticket search / filter / sort
- Goal: Confirm archive browsing works on the existing single-workspace screen.
- Acceptance criteria:
  - Search returns expected records.
  - Ticket-type and status filters behave correctly.
  - Sort order changes are visible and consistent.
- Test or manual verification needed:
  - Manual verification with multiple records in desktop runtime.
- Risk level:
  - Medium

### [ ] Verify ticket detail loading
- Goal: Confirm selecting records loads consistent detail content without blank states or stale content.
- Acceptance criteria:
  - Selecting tickets updates the detail view.
  - Empty-state behavior is understandable when no record is selected.
  - No obvious crashes when switching records quickly.
- Test or manual verification needed:
  - Manual verification in desktop runtime.
- Risk level:
  - High

### [ ] Verify flight / train distinction in current UI and data flow
- Goal: Confirm the app actually treats flight and train records differently where intended.
- Acceptance criteria:
  - Flight and train records can both be created and loaded.
  - Ticket-type-specific fields appear to behave as expected.
  - Any mismatches are documented as defects or unclear behavior.
- Test or manual verification needed:
  - Manual create/load verification for both ticket types.
- Risk level:
  - Medium

### [ ] Verify basic journey / segment handling
- Goal: Confirm single-segment and multi-segment flows do not break current workspace behavior.
- Acceptance criteria:
  - Single-segment records load correctly.
  - Multi-segment ticket drafts can be saved and reopened.
  - Segment counts and summaries appear consistent.
- Test or manual verification needed:
  - Manual verification with both single and multi-segment examples.
- Risk level:
  - High

### [ ] Verify error and empty states
- Goal: Confirm the app handles missing data, empty archives, and failures in a user-visible way.
- Acceptance criteria:
  - Empty list state is understandable.
  - Failed actions expose useful messages.
  - No obvious full-screen blank state on common errors.
- Test or manual verification needed:
  - Manual verification and defect notes.
- Risk level:
  - High

## 5. Milestone 2: Import, OCR, And Attachments Stabilization

### [ ] Verify smart text import flow
- Goal: Confirm text-based import creates a usable parsed draft.
- Acceptance criteria:
  - Pasted ticket text produces a parsed result when supported.
  - Import result can be reviewed before saving.
  - Unsupported/invalid text fails visibly instead of silently.
- Verification steps:
  - Manual text import with a known flight example.
  - Manual text import with a known train example.
  - Negative test with invalid text.

### [ ] Verify OCR flow
- Goal: Confirm OCR can run and feed data into the import workflow.
- Acceptance criteria:
  - OCR action can be started from the current UI.
  - OCR results populate a draft/review path.
  - Failure states are understandable.
- Verification steps:
  - Manual OCR test with a readable ticket image.
  - Manual OCR failure test with poor/unsupported input.
- Notes:
  - UX structure still needs verification.

### [ ] Verify parsed draft review behavior
- Goal: Confirm parsed fields and review hints are usable.
- Acceptance criteria:
  - Review hints appear when fields are incomplete or unclear.
  - User can continue into save flow after review.
- Verification steps:
  - Manual import review with intentionally incomplete input.

### [ ] Verify attachment add / delete
- Goal: Confirm attachments work against the current desktop flow.
- Acceptance criteria:
  - Attachment can be added to a selected ticket.
  - Attachment can be removed.
  - Ticket detail reflects the current attachment state.
- Verification steps:
  - Manual desktop test with a small local file.

### [ ] Verify import / OCR / attachment error handling
- Goal: Confirm failed operations do not leave the workspace in a broken state.
- Acceptance criteria:
  - Failed import/OCR/attachment actions show a visible error.
  - App remains usable after failure.
- Verification steps:
  - Manual negative-path testing.

## 6. Milestone 3: Map, Statistics, Backup, And Export Stabilization

### [ ] Verify route map rendering
- Goal: Confirm current map view renders usable route information.
- Acceptance criteria:
  - At least one ticket displays a route map.
  - Map does not fail on a basic flight record.
- Verification steps:
  - Manual desktop verification with a sample ticket.

### [ ] Verify ticket detail map payload handling
- Goal: Confirm ticket detail and map payload stay in sync.
- Acceptance criteria:
  - Selecting a ticket refreshes the corresponding route information.
  - Missing/empty route cases degrade safely.
- Verification steps:
  - Manual switching between records with different route structures.

### [ ] Verify statistics panel behavior
- Goal: Confirm statistics reflect the current visible archive state.
- Acceptance criteria:
  - Basic counts update when records exist.
  - Filter-aware stats appear to match visible records.
- Verification steps:
  - Manual verification after adding multiple records.

### [ ] Verify backup creation
- Goal: Confirm a backup can be created from the current archive.
- Acceptance criteria:
  - Backup action completes.
  - Backup readiness and backup list update visibly.
- Verification steps:
  - Manual desktop verification.

### [ ] Verify backup restore
- Goal: Confirm a previously created backup can be restored safely.
- Acceptance criteria:
  - Restore completes and archive state changes as expected.
  - Existing confirmation flow is understandable.
- Verification steps:
  - Manual create -> mutate -> restore sequence.
- Risk level:
  - High

### [ ] Verify archive export / import
- Goal: Confirm archive bundle export/import works in current desktop flow.
- Acceptance criteria:
  - Export action completes with a visible destination/result.
  - Import action restores usable archive data.
- Verification steps:
  - Manual desktop export/import sequence.

### [ ] Verify ticket stub export
- Goal: Confirm ticket stub export remains usable.
- Acceptance criteria:
  - At least one stub export path works for a selected ticket.
  - Output is generated without crashing the UI.
- Verification steps:
  - Manual export for a flight or train record.

### [ ] Verify CSV / JSON / SVG / PNG export helpers in runtime
- Goal: Confirm helper-based exports are still wired correctly in the app.
- Acceptance criteria:
  - Visible export actions produce expected files or outputs.
  - Failures are visible.
- Verification steps:
  - Manual export checks in desktop runtime.

## 7. Milestone 4: Navigation And UX Structure

### [ ] Decision: verify and document current sidebar behavior
- Goal: Confirm what the sidebar currently does and does not control.
- Acceptance criteria:
  - Current behavior is described in docs or task notes.
  - Static vs interactive navigation status is no longer ambiguous.
- Notes:
  - This is a documentation/verification task first.

### [!] Decision: should the sidebar control sections or real pages for the next release?
- Goal: Get an explicit product/UX decision before changing navigation structure.
- Acceptance criteria:
  - A documented decision exists.
  - Scope is limited to the next release, not long-term ideal architecture.
- Notes:
  - Needs user confirmation.

### [~] Improve visible section navigation if current single-workspace flow remains
- Goal: Make the current workspace easier to navigate without a full routing refactor.
- Acceptance criteria:
  - Current sections become easier to reach and understand.
  - No large page/router rewrite is required.
- Notes:
  - A first local-section implementation is now in place without a router rewrite.
  - Sticky sidebar and local section switching have now been manually verified by the user.
  - `NAV-003` scroll-to-top on sidebar section change has now been manually verified by the user.
  - `UX-001` limiting the large overview hero/summary to `Overview` still needs follow-up and manual verification.
  - `UX-006` compacting long non-overview intro text behind a smaller tooltip-style help affordance still needs manual verification.
  - `UX-007` removing large bordered title containers from non-overview page headers is now part of the same follow-up pass.
  - `UX-003` reducing repeated preview content and clarifying non-overview section structure has now been manually verified.
  - `UX-005` ticket workflow improvements are now manually verified for the current desktop-first phase: modal-based add flow, compact list-first browsing, local detail subview, denser form layout, reduced decorative eyebrow labels, and safe save flows for flight/train tickets.
  - Pagination remains implemented but still needs future verification once the archive exceeds `20` records.
  - `SETTINGS-001` is now in place as a safe UI scaffold: a bottom sidebar entry and a non-functional Settings page for Appearance, Export, and About placeholders.
  - Sidebar / Settings / Exports IA cleanup should now keep backup/export placeholders under `Settings > Export`, keep standalone `Exports` out of primary navigation, and leave ticket-edit behavior for a separate task.
  - For the current phase, desktop layout remains the primary target; responsive behavior is only a safe fallback for narrower desktop windows, not a mobile-first redesign track.
  - Journey implementation should not start until the Journey design is accepted, especially because Journeys are being redefined as trip collections rather than single-ticket detail duplication.
  - Journey design decisions are now confirmed: manual-first creation, ticket-list selection flow, `title` as the main list title, free-text companions with later suggestions, `All years` as default filter, and a future many-to-many table direction.
  - Journey implementation should begin with a safe `Summary + List` scaffold only.
  - Journeys Phase 1 scaffold has now been manually verified: `Journeys` opens `Summary` by default, `Summary / List` switching works, and the section no longer duplicates Tickets single-ticket detail.
  - Do not implement the real Journey database schema until a later phase.
  - Ticket edit modal/refresh behavior has now been manually verified: edit opens from detail, uses the shared modal/form pattern without OCR in edit mode, locks ticket type, refreshes the current detail view after save, and keeps add/list flows stable.
  - Ticket location suggestions/placeholders are now manually verified for transport-specific filtering: flight forms suggest airports only, train/rail forms suggest stations only, and placeholders reflect the selected ticket type in both add and edit flows.
  - `FORM-001` date/time confirm/apply behavior is deferred for now; keep the original/simple datetime inputs until a clearer picker direction is chosen.
  - `FORM-002` has now been manually verified: new ticket drafts default `Cabin / Class` to `Economy`, saving without changes stores that value, and edit mode preserves existing class values instead of overwriting them.
  - Global airport coverage is now backed by an OurAirports-based generation pipeline plus a small Chinese alias overlay, and this airport data is now manually verified as connected to route-map coordinate resolution for flight tickets.
  - Rail station suggestion expansion now uses a real 12306 `station_name.js` generator path, and the current repository has already generated a nationwide rail-station suggestion dataset from the downloaded source file.
  - The rail generator can now also download the official 12306 source locally before regeneration, which gives the project a safer future option to stop committing the raw source file if redistribution review requires that.
  - Map endpoint alignment is now manually verified: summary/overview maps stay label-free, endpoint dots sit on the exact route endpoints, and detail labels may offset visually without moving dot coordinates.
  - Current map color work should stay simple: non-Journey-total maps use one shared route color, endpoint dots match the route line color, and only the future Journeys total map should introduce journey-based color grouping.
  - Endpoint alignment and label cleanup remain stable. `MAP-006` is now a small, isolated zoom-aware dot-sizing pass, `MAP-007` is limited to disabling repeated world copies only, and `MAP-008` is deferred for the current phase because manual verification no longer reproduces the problematic endless horizontal dragging behavior after `MAP-007`.
  - Ticket detail delete is now implemented as a focused follow-up: the detail header restores a visible delete action beside edit, uses destructive confirmation, and should return safely to the list after successful deletion once manually verified.
  - Ticket detail IA cleanup is now focused on a single `Ticket information` module for current tickets: avoid repeated route titles, keep route-map copy compact, place stub preview and original files side-by-side on wider desktop layouts, and keep inline status editing limited to the current persisted states (`Upcoming` / `Completed` / `Archived`) until any future `Cancelled` semantics are explicitly added at the data-model level.
  - The current detail refinement pass should now keep the ticket page itself out of the way during detail mode: use a sticky in-workspace action bar, a simplified centered route title/code subtitle, explicit ticket-information row ordering, `Route legs` wording with an info icon, status explanation via an info icon, lighter outer wrappers around the main detail modules, and slightly roomier/aligned route-map header spacing without adding route arrows or endpoint time labels.
  - Status behavior should stay frontend-only and low-risk for now: the existing default `saved` state should display as an auto-derived `Upcoming` or `Completed` result based on current time, while explicit persisted overrides remain limited to the current model until any future `Cancelled` semantics are approved at the data-model level.
  - The latest refinement pass simplifies further: keep the auto/default status live over time with a lightweight frontend clock, remove the temporary Status and Route legs info icons again, and remove only the extra outer detail shell while preserving each module (`Ticket information`, `Route map`, `Ticket stub preview`) as its own readable block.
  - The current visual cleanup should now use two desktop detail rows with safe responsive stacking: `Ticket information` left of `Route map`, then `Ticket stub preview` left of `Original ticket files`, separated by only a lightweight divider instead of another boxed wrapper.
  - Ticket-detail text cleanup for this phase should stay English-first and replace any mojibake labels in stub-preview and attachment actions with clear English button text.
  - When a ticket has notes, the notes block should now live inside `Ticket information` as its final row instead of floating above the detail modules as a separate card.
  - The next focused ticket-data improvement is optional flight terminal support only: add `departureTerminal` / `arrivalTerminal`, surface them in Add/Edit for flights, show them compactly in ticket detail, and optionally use departure terminal on the ticket stub without expanding into gate/platform/carriage work.
  - Flight terminal fields are now manually verified. The next language-related work should stay separate: add a Settings language switch later, let UI labels switch between English and Chinese, and keep user-entered ticket data / airport-station names untranslated.
  - Keep OCR terminal extraction and any real `Cancelled` persistence work as separate future tasks.
  - English UI completion remains the current priority; language switching and Chinese localization should wait for a later Settings/i18n phase.
  - A new flight lookup scaffold should stay intentionally small in Phase 1: use a local mock provider plus manual candidate apply in Add/Edit flight forms first, add a Settings placeholder for future provider/API wiring, and defer any real paid/commercial integration until provider/license/secret-handling review is accepted.
  - Any future real flight lookup integration should keep API secrets out of the frontend bundle and prefer a safer desktop/backend boundary when the project moves beyond the scaffold.
  - `FLIGHT-LOOKUP-002` should now begin with architecture only: keep `src/lib/flightLookup.ts` as the frontend-facing abstraction, define provider adapters behind a secure Tauri/backend boundary, and do not connect any live provider until one is selected through pricing/terms/coverage review.
  - A new `docs/FLIGHT_LOOKUP_DESIGN.md` should act as the reference for future provider phases, normalization rules, and API-key security constraints.
  - The provider review phase should now compare AeroDataBox, Amadeus, Aviationstack, and FlightAware side-by-side using official docs only, recommend one first provider, and keep live integration blocked until the pricing/terms/secret-handling decision is accepted.
  - After provider review, the next planning step should define the exact Tauri request/response/error contract for an AeroDataBox-first integration without adding live HTTP calls yet.
  - Secure provider configuration and API key storage should remain a separate future task from the current contract-planning pass.
  - After the contract is documented, the next implementation step should be a backend mock command boundary that returns normalized candidates through Tauri before any real provider call is attempted.
  - The current next safe scaffold is local provider/API-key configuration in Settings only; keep it local, keep it explicit that live provider calls are still disabled, and treat this storage as MVP-only rather than final secure secret handling.
  - The current flight lookup backend now also has a provider adapter skeleton: `mock` remains the default safe route, saved provider config can select the backend path, and the AeroDataBox adapter must continue returning structured non-network errors until real API work is explicitly approved.
  - The current hardening step should now keep raw provider keys desktop-side only: return sanitized metadata to React, keep replacement/clear flows in Settings, and leave OS-keychain-grade storage as the next release-blocking review rather than mixing it into live provider integration.
  - The next live-provider step should begin with the validated AeroDataBox single-day endpoint/schema only: keep the current user-facing mock flow untouched until the real adapter maps `FlightContract` fields and provider HTTP statuses into the normalized candidate/error model.
  - Live AeroDataBox follow-up cleanup should stay small and practical: normalize provider-local times into the current `datetime-local` field shape, remove stale mock-only lookup copy from the live-provider path, and allow a short-lived repeated-lookup cache before moving on to provider test-connection work.
  - Current post-validation polish can also stay small: normalize inline terminal display to `T n`, show the derived auto-status label directly without `Auto:`, and let onward flight segments reuse the same lookup/apply flow as the primary flight leg.
  - The urgent next design task is now `SEGMENT-DESIGN-001` because current multi-segment ticket detail display and route-map leg construction are semantically wrong.
  - `MAP-004 / MAP-005` and `AIRLINE-DATA-001 / AIRLINE-LOGO-001` should stay paused until the multi-segment ticket issue is resolved or explicitly deprioritized.

### [ ] Document UX direction before implementation
- Goal: Record the intended near-term UX structure before UI changes begin.
- Acceptance criteria:
  - UX decision is documented in `docs/` before implementation starts.
- Notes:
  - Prevents ad hoc UI changes.

## 8. Milestone 5: Testing And Regression Coverage

### [ ] Expand import parser tests if needed
- Goal: Increase confidence in import parsing behavior.
- Acceptance criteria:
  - Important supported examples and failure cases are covered.

### [ ] Expand ticket service fallback tests
- Goal: Keep fallback behavior stable where it is still part of the codebase.
- Acceptance criteria:
  - Key CRUD and backup-related fallback paths remain covered.

### [ ] Add tests for visualization / export helpers where needed
- Goal: Protect SVG/PNG/text export helper behavior.
- Acceptance criteria:
  - Current helper behavior used in the app has regression coverage.

### [ ] Add regression tests for ticket CRUD where practical
- Goal: Add focused automated coverage around the highest-risk flows.
- Acceptance criteria:
  - At least small, practical coverage is added around create/edit/delete/status paths where feasible.
- Notes:
  - Exact approach needs verification.

### [ ] Document manual test checklist for Tauri desktop flows
- Goal: Make desktop verification repeatable.
- Acceptance criteria:
  - Core manual flows are written down in `docs/TEST_PLAN.md`.

### [ ] Document tests that cannot be automated yet
- Goal: Explicitly record known test gaps.
- Acceptance criteria:
  - Unautomated areas such as desktop runtime, map behavior, and OCR limitations are listed.

## 9. Milestone 6: Incremental Architecture Cleanup

### [ ] Identify safe extraction points from `src/App.tsx`
- Goal: Find small, low-risk seams for future cleanup after stabilization.
- Acceptance criteria:
  - Candidate extraction points are documented.
  - No behavior changes are made as part of the identification step.

### [ ] Identify safe extraction points from `src-tauri/src/db.rs`
- Goal: Find small, low-risk seams for future Rust cleanup after stabilization.
- Acceptance criteria:
  - Candidate extraction points are documented.
  - No behavior changes are made as part of the identification step.

### [ ] Extract one small feature/module at a time after stabilization
- Goal: Improve maintainability without destabilizing the app.
- Acceptance criteria:
  - Each extraction is scoped narrowly.
  - Behavior remains unchanged.
  - Tests/manual checks are updated around the extraction.
- Notes:
  - Initial `HomePage` and `TicketsPage` wrapper extraction has been manually verified.
  - Further page-level extraction should remain incremental and should not begin with a router rewrite.

### [ ] Keep architecture cleanup out of unrelated feature work
- Goal: Avoid hidden refactors in routine tasks.
- Acceptance criteria:
  - Refactors are explicit, narrow, and separately justified.

## 10. Milestone 7: Windows Release Readiness

### [ ] Verify Windows build commands
- Goal: Confirm documented build commands still match the repository.
- Acceptance criteria:
  - `npm run tauri:build:windows` and `npm run release:windows` are still valid for the repo.

### [ ] Verify installer build
- Goal: Confirm the Windows installer can still be produced as documented.
- Acceptance criteria:
  - Installer output path and packaging steps remain correct.
- Verification steps:
  - Needs manual build verification.

### [ ] Verify release scripts and version workflow
- Goal: Confirm version sync/check scripts and release notes still match the process.
- Acceptance criteria:
  - Scripts are documented and still consistent with package/release docs.

### [ ] Confirm backup/export paths work on Windows
- Goal: Ensure Windows-specific file outputs are understandable and usable.
- Acceptance criteria:
  - Backup/export output locations can be verified in runtime or docs.
- Verification steps:
  - Needs manual verification.

### [ ] Update `docs/windows-release.md` if release behavior changes
- Goal: Keep packaging/release instructions aligned with reality.
- Acceptance criteria:
  - Release doc is updated whenever verified behavior changes.

## 11. Open Decisions

- [!] Whether to stay with the single-workspace UX for the next release
- [!] Whether flight and rail should remain one archive or become separate pages/lists
- [!] Whether a settings page is needed now
- [!] Which features are must-have for the next release
- [!] Whether current encoding issues are real repository issues or only terminal display issues

## 12. Immediate Next Task Recommendation

The urgent next implementation task is still `SEGMENT-DETAIL-001` because multi-segment route-map legs, visible segment cards, and segment data preservation are now fixed, but ticket detail still has single-itinerary summary and single-stub semantics.

The next follow-up should stay small and focused:

1. `SEGMENT-DETAIL-001` first if the user wants the detail layout to match the accepted itinerary-container model.
2. `SEGMENT-STUB-001` next if segment-level boarding-pass previews are the highest-value follow-up after detail layout work.

`MAP-004 / MAP-005` and `AIRLINE-DATA-001 / AIRLINE-LOGO-001` are paused until the multi-segment ticket issue is resolved or explicitly deprioritized.
