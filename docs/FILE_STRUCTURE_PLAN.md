# FILE_STRUCTURE_PLAN

## 1. Purpose

This document defines a future file-structure and architecture organization direction for TicketTrail after the current stabilization work is complete.
It is a planning document only.
It does not require immediate file moves, large refactors, or broad architecture changes while core user flows are still being stabilized.

## 2. Current Structure Summary

### `src/`

- Current role:
  - Main frontend application root
- Current contents:
  - `src/App.tsx`
  - `src/main.tsx`
  - `src/styles.css`
  - `src/pages/`
  - `src/components/`
  - `src/lib/`
  - `src/types/`
  - `src/data/`

### `src/pages/`

- Current role:
  - Early page-level composition wrappers introduced without a router rewrite
- Current contents:
  - `HomePage.tsx`
  - `TicketsPage.tsx`
- Current issue:
  - Only the first two wrappers exist so far; journeys, map, and export areas still rely on section-level inline composition inside `src/App.tsx`

### `src/components/`

- Current role:
  - Holds most visible UI modules
- Current contents:
  - `AppErrorBoundary.tsx`
  - `BackupPanel.tsx`
  - `Dashboard.tsx`
  - `Header.tsx`
  - `RouteMap.tsx`
  - `Sidebar.tsx`
  - `SmartImport.tsx`
  - `StatisticsPanel.tsx`
  - `TicketForm.tsx`
  - `TicketList.tsx`
- Current issue:
  - Components are mostly grouped by technical type, not by product area or page responsibility

### `src/lib/`

- Current role:
  - Frontend service and helper layer
- Current contents:
  - `importParser.ts`
  - `ocrService.ts`
  - `ticketService.ts`
  - `visualization.ts`
- Current issue:
  - Several high-impact helpers and service functions are concentrated in a few files without stronger feature grouping

### `src/types/`

- Current role:
  - Shared frontend TypeScript models
- Current contents:
  - `ticket.ts`

### `src/data/`

- Current role:
  - Seed data for directory/autocomplete behavior
- Current contents:
  - `airlines.seed.json`
  - `locations.seed.json`

### `src-tauri/src/`

- Current role:
  - Rust/Tauri desktop backend
- Current contents:
  - `main.rs`
  - `lib.rs`
  - `commands.rs`
  - `db.rs`
  - `models.rs`
- Current issue:
  - Tauri commands, database access, and substantial business logic are still concentrated in a very small number of files

### `tests/`

- Current role:
  - Frontend automated tests
- Current contents:
  - `importParser.test.ts`
  - `ticketService.fallback.test.ts`
  - `visualization.test.ts`

### `docs/`

- Current role:
  - Requirements, plans, test documentation, bug analysis, and release notes

### Key large/risky files

- `src/App.tsx`
  - Large page-level coordinator for many features
- `src-tauri/src/db.rs`
  - Large combined database/business-logic file

## 3. Current Problems

- `src/App.tsx` coordinates too many features and states at once.
- Frontend components are not clearly grouped by product area.
- Sidebar/navigation does not yet map cleanly to actual views.
- Import/OCR, backup, statistics, dashboard, ticket list, and ticket form are mixed into one workspace.
- `src-tauri/src/db.rs` combines too much database and business logic.
- Map and visualization flows remain high-risk after BL-003 and should be changed carefully.
- Current structure does not yet reflect the target UX sections defined in the redesign plan.

## 4. Target Frontend Structure

One practical future direction is:

```text
src/
  app/
    App.tsx
    AppShell.tsx
    navigation.ts
  pages/
    HomePage.tsx
    FlightTicketsPage.tsx
    TrainTicketsPage.tsx
    MapPage.tsx
    StatisticsPage.tsx
    BackupExportPage.tsx
  features/
    tickets/
      components/
      services/
      types/
    journeys/
    import/
    ocr/
    map/
    statistics/
    backup/
    export/
  components/
    common/
    layout/
  lib/
    tauri/
    utils/
  types/
  data/
```

### Folder responsibilities

### `src/app/`

- App-level shell and top-level state wiring
- Section switching/navigation state
- Shared top-level providers or app boot logic

### `src/pages/`

- Page-level compositions that match visible product sections
- Each page should combine existing feature components without forcing all features into one stacked workspace

### `src/features/`

- Feature-grouped logic and UI
- Example:
  - tickets
  - import
  - ocr
  - map
  - statistics
  - backup
  - export

### `src/components/common/`

- Reusable generic UI parts
- Buttons, empty states, cards, shared controls, small display units

### `src/components/layout/`

- Shell, header, sidebar, layout wrappers

### `src/lib/tauri/`

- Tauri-specific frontend bridge/helpers if later separated from broader utilities

### `src/lib/utils/`

- Lower-level pure utility helpers not tied to one product feature

### `src/types/`

- Shared TypeScript model contracts
- May remain mostly centralized until there is enough stability to split by feature

### `src/data/`

- Seed and local directory data
- Keep structured and searchable

Notes:
- This is a future direction, not an immediate migration plan.
- The exact structure can be adjusted if the next implementation step reveals a simpler safer shape.

## 5. Target Rust / Tauri Structure

One practical future direction is:

```text
src-tauri/src/
  main.rs
  lib.rs
  commands/
    tickets.rs
    backups.rs
    imports.rs
    attachments.rs
    exports.rs
  db/
    mod.rs
    connection.rs
    tickets.rs
    journeys.rs
    backups.rs
    attachments.rs
  models/
    tickets.rs
    journeys.rs
    map.rs
    export.rs
  services/
    backup_service.rs
    export_service.rs
    import_service.rs
```

### Direction notes

- This is a future direction only.
- `src-tauri/src/db.rs` should **not** be split all at once.
- Safe extraction should begin only after the main desktop flows are verified and the frontend is more stable.
- The first Rust cleanup should be narrow and behavior-preserving.

## 6. Mapping From Current Files To Future Areas

| Current file/folder | Future area | Priority | Notes |
|---------------------|-------------|----------|-------|
| `src/App.tsx` | `src/app/App.tsx` plus page composition | High | Do not split immediately; first reduce risk by introducing section-level composition |
| `src/components/Sidebar.tsx` | `src/components/layout/Sidebar.tsx` | High | Likely first navigation-aware layout file |
| `src/components/Header.tsx` | `src/components/layout/Header.tsx` | Medium | Layout-level component |
| `src/components/Dashboard.tsx` | `src/pages/HomePage.tsx` and/or `src/features/tickets` + `src/features/map` | High | Currently mixes detail, exports, map, and scope summary |
| `src/components/TicketForm.tsx` | `src/features/tickets/components/` | High | Likely reused by Flight and Train views |
| `src/components/TicketList.tsx` | `src/features/tickets/components/` or page-specific ticket list wrappers | High | May later support flight/train-specific list wrappers |
| `src/components/RouteMap.tsx` | `src/features/map/components/` | High | High-risk area after BL-003; only move after stability is proven |
| `src/components/SmartImport.tsx` | `src/features/import/components/` and `src/features/ocr/` | Medium | Should later align with Add Ticket flow redesign |
| `src/components/BackupPanel.tsx` | `src/features/backup/components/` or `BackupExportPage` | Medium | Natural fit for Backup / Export section |
| `src/components/StatisticsPanel.tsx` | `src/features/statistics/components/` or `StatisticsPage` | Medium | Should align with separate statistics view later |
| `src/components/AppErrorBoundary.tsx` | `src/components/common/` or `src/app/` | Medium | App-level resilience helper |
| `src/lib/ticketService.ts` | `src/features/tickets/services/` or `src/lib/tauri/` split | Medium | Keep stable until page split starts |
| `src/lib/importParser.ts` | `src/features/import/` | Medium | Good candidate for feature grouping because tests already exist |
| `src/lib/ocrService.ts` | `src/features/ocr/` | Medium | Keep separate from general import parsing |
| `src/lib/visualization.ts` | `src/features/map/` and/or `src/features/export/` | Medium | Split only when map/export responsibilities are clearer |
| `src/types/ticket.ts` | shared `src/types/` first, later feature-local type re-exports if needed | Low | Keep stable for now to avoid unnecessary churn |
| `src/data/airlines.seed.json` | `src/data/` | Medium | Keep under data directory; may later gain subfolders |
| `src/data/locations.seed.json` | `src/data/` | High | Important for future location-data expansion |
| `src-tauri/src/db.rs` | future `src-tauri/src/db/` modules | High | Do not split yet; document safe extraction points later |
| `src-tauri/src/commands.rs` | future `src-tauri/src/commands/` modules | Medium | Commands can be separated by domain later |
| `src-tauri/src/models.rs` | future `src-tauri/src/models/` modules | Medium | Split after command/db boundaries are clearer |
| `tests/` | keep centralized initially, later organize by feature if test count grows | Low | Current small size does not justify early restructure |

## 7. Refactor Phases

### Phase 0

- No file moves
- No refactor
- Documentation only

### Phase 1

- Introduce app shell / section state if needed
- Make sidebar switch visible sections
- Keep existing components mostly in place

### Phase 2

- Extract page-level views:
  - `HomePage`
  - `FlightTicketsPage`
  - `TrainTicketsPage`
  - `MapPage`
  - `BackupExportPage`
- Keep current data model unchanged if possible
- Notes:
  - `HomePage` and `TicketsPage` wrapper-level extraction has started.
  - Further page extraction should stay incremental.

### Phase 3

- Group frontend feature components gradually
- Move components only after the section/page behavior is stable

### Phase 4

- Extract services/helpers only where tests already exist or can be added safely
- Prefer low-risk utility/service separations over large UI rewrites

### Phase 5

- Plan `src-tauri/src/db.rs` split separately after frontend stability improves
- Keep Rust cleanup scoped and incremental

## 8. Files Not To Refactor Yet

- `src-tauri/src/db.rs`
- low-level database schema
- map rendering internals unless fixing a specific bug
- backup/restore internals unless testing first
- recently stabilized add-ticket flow internals unless tied to a verified bug

## 9. Testing Requirements For Structure Changes

- Run `npm run test`
- Run `npm run build`
- Run `cargo test --manifest-path src-tauri/Cargo.toml` if Rust changes
- Manually check the add-ticket flow because of BL-003 history
- Manually check map rendering because `RouteMap` was recently fixed
- Manually check sidebar behavior and section switching after navigation changes

## 10. Open Questions

- Should Flight and Train pages share one ticket model with filters, or become more strongly separated views?
- Should a router be introduced now, or should the app use local section state first?
- Should `App.tsx` become only `AppShell` plus app-level providers later?
- Which current component should become `HomePage` first?
- How soon should `db.rs` be split after stabilization improves?

## 11. Recommended First Implementation Step

The smallest safe next implementation step is:

- make the sidebar sticky and clickable
- use local section state first
- switch visible sections without introducing a router yet
- keep most current components in place
- do not move many files in the same change
- keep the add-ticket flow working while section switching is introduced

This matches the current stabilization-first strategy and avoids mixing navigation work with large structural refactors.
