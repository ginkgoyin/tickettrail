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
  - The next UI issue after that is reducing repeated hero/preview content across non-overview sections.

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

Create `docs/TEST_PLAN.md` next, then perform manual core-flow verification against that checklist before starting new feature or navigation work.
