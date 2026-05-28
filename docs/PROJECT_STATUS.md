# PROJECT_STATUS

## 1. Project Snapshot

- Project name: `TicketTrail`
- App type: Windows-first desktop ticket archive and itinerary management app
- Main tech stack:
  - Frontend: React 18 + TypeScript + Vite
  - Desktop shell: Tauri 2
  - Backend/local service layer: Rust
  - Storage: SQLite, with a web fallback based on `localStorage`
  - OCR: `tesseract.js`
  - Map rendering: `maplibre-gl`
- Current development stage: feature-rich MVP / stabilization stage
- Main user goal: store and manage flight/train tickets, view journeys on a map, generate ticket stubs, and keep local travel records with backup/export support

## 2. Existing Features

### Ticket management

- Create, edit, delete, and update ticket status
- Separate ticket types for `flight` and `train`
- Search, filter, sort, and saved filter views
- Ticket detail loading and record selection

### Journey management

- Single-segment and multi-segment ticket drafts
- Journey/segment-oriented data model in schema and Rust code
- Segment ordering and segment count handling appear to exist

### Route map / visualization

- Route map component based on `maplibre-gl`
- Ticket detail map payloads and route visualization
- SVG-based map export helpers
- Ticket stub SVG / PNG generation helpers

### OCR / text import

- Smart text import UI
- OCR service layer using `tesseract.js`
- Import parser and review logic for parsed drafts

### Attachments

- Ticket attachment add/delete flows are wired in `App.tsx`
- Schema includes `ticket_attachments`

### Backup / restore

- Backup panel exists
- Create backup, restore backup, export backup
- Export/import archive bundle
- Backup readiness check

### Statistics

- Statistics panel exists
- Filter-aware statistics and archive context appear to be supported

### Export

- Ticket export helpers for SVG / PNG / JSON / CSV appear to exist
- Windows packaging and GitHub Release workflow exist

### Settings / configuration

- Release/version helper scripts exist
- No dedicated in-app settings page is clearly visible

## 3. Partially Implemented / Unclear Features

- Sidebar navigation appears mostly static
  - `src/components/Sidebar.tsx` renders buttons, but no page routing or click behavior is wired there
- Overall UI still behaves like one long stacked workspace
  - `src/App.tsx` composes import, backup, statistics, form, list, and dashboard in one page
- Distinct page structure such as Home / Flights / Rail / Map / Exports is unclear and needs verification
- Journey-specific screens appear conceptually present in navigation labels, but not clearly implemented as separate views
- OCR is present, but its final UX flow is unclear
  - it exists as a visible workspace module, not clearly as a focused add-ticket step
- Attachments, backup, and export flows appear implemented, but full user verification still needs confirmation
- In-app settings/configuration UX is unclear
- Some existing docs and test strings show encoding/display problems and need verification

## 4. Known Technical Risks

- `src/App.tsx` is too large and coordinates too many features
- `src-tauri/src/db.rs` is too large and contains too much business logic
- Sidebar navigation is mostly static
- The UI behaves like one long stacked page
- Tests exist, but coverage is limited
- `Dashboard`, `TicketForm`, `TicketList`, `SmartImport`, and backup/statistics flows are tightly composed in one page-level container
- `dangerouslySetInnerHTML` is used for generated SVG rendering and needs careful review
- `src-tauri/tauri.conf.json` uses `csp: null`, which is a known security risk
- Documentation and some test fixtures show Chinese text encoding/display issues
- There is no clear dedicated lint script in `package.json`

## 5. Current Documentation Status

- `README.md`
  - Project overview and startup guidance
- `docs/requirements-analysis.md`
  - Product requirements and domain goals
- `docs/technical-implementation-plan.md`
  - Architecture and implementation direction
- `docs/development-setup.md`
  - Local startup guidance and dev/runtime distinction
- `docs/windows-release.md`
  - Windows packaging and release workflow
- `docs/PROJECT_STATUS.md`
  - Current repository/project status snapshot

Missing documents:

- `docs/TEST_PLAN.md`
- `docs/API_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/TASKS.md`

## 6. Current Test Status

### Existing test setup

- Frontend test runner: `Vitest`
- Rust tests: `cargo test` under `src-tauri`

### Existing frontend test files

- `tests/importParser.test.ts`
- `tests/ticketService.fallback.test.ts`
- `tests/visualization.test.ts`

### What appears covered

- Import parser behavior
- Fallback storage behavior for ticket service
- Backup-related fallback flows
- Visualization helper output

### What appears not yet covered

- Sidebar/navigation behavior
- Page-level flows
- Component interaction behavior for major screens
- Tauri command integration end-to-end
- OCR service behavior in realistic UI flows
- Map interactions and route-selection flows
- Full backup/restore verification in desktop runtime

### Known test commands

- `npm run test`
- `cargo test --manifest-path src-tauri/Cargo.toml`

## 7. Recommended Next Steps

1. Keep documentation current and use this file as the baseline status reference.
2. Create `docs/TASKS.md` to track stabilization work before adding major features.
3. Verify the core user flows manually in desktop runtime:
   - open app
   - create/edit/delete ticket
   - view detail/map
   - import OCR/text
   - backup/restore
4. Document a focused `docs/TEST_PLAN.md` for regression coverage.
5. Stabilize navigation and page structure before any large refactor.
6. Only after stabilization, plan incremental decomposition of `src/App.tsx` and `src-tauri/src/db.rs`.

## 8. Open Questions

- Should the product move to a true multi-page desktop structure now, or first stabilize the current single-workspace flow?
- Which flows are considered must-have for the next usable release: ticket CRUD only, or also OCR, backup, map, and export?
- Should flight and rail records become clearly separated pages/lists, or stay under one shared archive view?
- Is there a desired in-app settings/configuration page for phase one, or can configuration remain file/script driven for now?
- Are the current docs and test files affected by real repository encoding problems, or only terminal display issues?
