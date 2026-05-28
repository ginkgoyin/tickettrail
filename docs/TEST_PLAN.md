# TEST_PLAN

## 1. Purpose

This document defines the current automated and manual verification approach for the TicketTrail stabilization stage.
Its purpose is to make regression checking repeatable while the project stabilizes the existing single-workspace desktop flow.

## 2. Test Strategy

- Existing features should be stabilized before large refactors.
- Automated tests should cover parser, service, and helper logic where practical.
- Tauri desktop flows may require manual verification because current desktop runtime behavior is not fully automated.
- High-risk flows such as backup/restore, import/OCR, attachments, and ticket CRUD need repeatable manual checklists.
- Every feature change should update this test plan if the verification scope changes.

## 3. Test Commands

Known commands:

- `npm run test`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`
- `npm run tauri:build`
- `npm run tauri:dev`

Additional Windows-related build commands also exist in `package.json`, but they are release/build commands rather than baseline test commands:

- `npm run tauri:build:windows`
- `npm run release:windows`

No dedicated lint command is currently documented in `package.json`.
There is also no separate type-check command documented; frontend type-checking appears to run as part of `npm run build`.

## 4. Existing Automated Tests

### `tests/importParser.test.ts`

- File path: `tests/importParser.test.ts`
- What it appears to cover:
  - Flight-like text parsing into a draft
  - Train-like text parsing into a draft
  - Import review generation for incomplete OCR/text input
- What it does not cover:
  - OCR runtime behavior
  - UI import flow
  - Many parser edge cases and malformed mixed inputs
- Should it be expanded later:
  - Yes

### `tests/ticketService.fallback.test.ts`

- File path: `tests/ticketService.fallback.test.ts`
- What it appears to cover:
  - Web fallback ticket create/list/update/delete
  - Fallback ticket detail loading
  - Fallback backup create/restore
  - Fallback backup readiness
  - Fallback archive export behavior
  - Error handling for missing backup records
- What it does not cover:
  - Real Tauri command behavior
  - SQLite persistence
  - Desktop attachment flows
  - Desktop backup/archive file operations
- Should it be expanded later:
  - Yes

### `tests/visualization.test.ts`

- File path: `tests/visualization.test.ts`
- What it appears to cover:
  - Route SVG generation
  - Flight stub SVG generation
  - Train stub SVG generation
- What it does not cover:
  - Browser rendering correctness
  - PNG export runtime behavior
  - UI export flow
  - Edge cases for malformed payloads
- Should it be expanded later:
  - Yes

## 5. Manual Desktop Regression Checklist

### 5.1 App startup

- Launch with `npm run tauri:dev`
- Launch release executable if available
- Confirm app opens without a blank screen
- Confirm no obvious startup error

### 5.2 Ticket CRUD

- Create one flight ticket
- Create one train ticket
- Edit ticket fields
- Delete a ticket
- Update ticket status
- Restart app and confirm data persists

### 5.3 Search / filter / sort

- Search by known ticket text
- Filter by ticket type
- Filter by status
- Sort by date or another available sort field
- Confirm empty-state behavior

### 5.4 Ticket detail and journey/segment behavior

- Select a ticket and verify the detail panel updates
- Test a single-segment ticket
- Test a multi-segment ticket if supported in the current UI
- Switch quickly between records and check for stale, blank, or inconsistent states

### 5.5 Import and OCR

- Paste a known flight text sample
- Paste a known train text sample
- Try invalid text
- Run OCR on a readable ticket image
- Run OCR on unsupported or poor-quality input
- Confirm the review/save path works, or document gaps if behavior is unclear

### 5.6 Attachments

- Add an attachment to a selected ticket
- Remove an attachment
- Restart app and confirm attachment state if persistence is expected
- Test failure or invalid file path handling if practical

### 5.7 Map and visualization

- Select a ticket with route data
- Confirm route map renders
- Switch to a ticket with missing or weak route data if practical
- Confirm safe fallback behavior

### 5.8 Statistics

- Add multiple records
- Check whether statistics update
- Apply filters and check whether statistics match visible records

### 5.9 Backup / restore / archive import-export

- Create backup
- Modify data
- Restore backup
- Confirm restored state
- Export archive bundle
- Import archive bundle if supported in the current desktop flow
- Confirm failure/cancel behavior is safe

### 5.10 Ticket stub and data export

- Export a ticket stub if available
- Export JSON / CSV / SVG / PNG if available in the UI
- Confirm output is generated and the app remains usable

### 5.11 Windows-specific checks

- Build Windows installer if the environment supports it
- Confirm app starts from an installed build
- Confirm backup/export paths are usable on Windows

## 6. High-Risk Areas

- `src/App.tsx`
  - Large page-level coordination file with many flows composed together
- `src-tauri/src/db.rs`
  - Large Rust file containing significant database and business logic
- Backup/restore data integrity
  - Risk of destructive state changes or partial restore behavior
- Import/OCR parsing reliability
  - OCR and parser behavior can be sensitive to input quality and structure
- Attachment file handling
  - File persistence and delete behavior need manual confirmation
- Generated SVG/HTML rendering and `dangerouslySetInnerHTML`
  - Rendering safety and malformed content handling need care
- `csp: null` in Tauri config
  - Known security risk
- Limited automated test coverage
  - Most desktop UX behavior still needs manual verification

## 7. Suggested Future Automated Tests

- Ticket CRUD service tests beyond current fallback coverage
- Import parser edge-case tests
- Visualization/export helper regression tests for malformed or partial payloads
- Backup/restore fallback tests with more edge cases
- Component-level tests for major flows if feasible
- Tauri command tests where practical

Do not implement these tests as part of this document task.

## 8. When To Run Which Tests

- Docs-only change:
  - No runtime test required, but summarize that no test was needed
- Frontend utility change:
  - Run `npm run test`
- Frontend UI change:
  - Run `npm run test` plus the relevant manual desktop checklist
- Rust/Tauri command change:
  - Run `cargo test --manifest-path src-tauri/Cargo.toml` plus desktop manual verification
- Build/release change:
  - Run build commands if the environment supports them
- Backup/import/export change:
  - Always perform the manual regression checklist for those flows

## 9. Known Gaps

- Desktop runtime behavior is not fully automated
- OCR and map behavior still need manual verification
- Backup/restore needs careful manual verification
- Navigation/page-level behavior is not yet covered
- No dedicated lint command is currently documented

## 10. Update Rules

- Update this file when adding or changing major flows
- Record manual verification results in task notes or changelog when relevant
- Do not claim a flow is verified unless it has actually been tested
