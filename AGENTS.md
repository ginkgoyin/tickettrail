# AGENTS.md

## Project Overview

TicketTrail is a Windows-first desktop ticket archive app built with Tauri 2, React 18, TypeScript, Rust, and SQLite.
It manages flight and train tickets, journeys, route maps, OCR/text import, attachments, backup/restore, statistics, and ticket-stub export.

Current repository risks to keep in mind:

- `src/App.tsx` is too heavy and coordinates too many features.
- `src-tauri/src/db.rs` is too large and contains too much business logic.
- Sidebar navigation is mostly static and not wired to real page routing.
- The UI behaves like one long stacked page instead of clear feature pages.
- Tests exist, but coverage is still limited.
- Do not start large refactors before the main user flows are stable.

## Repository Structure

- `src/`: React frontend
- `src/components/`: UI modules such as dashboard, ticket form, ticket list, OCR import, statistics, backup, sidebar
- `src/lib/`: frontend service layer, import parsing, OCR helpers, visualization/export helpers
- `src/types/`: shared frontend TypeScript models
- `src/data/`: seed data for airlines and locations
- `src-tauri/src/`: Rust Tauri commands, models, and database logic
- `database/schema.sql`: SQLite schema
- `tests/`: Vitest frontend tests
- `docs/`: requirements, implementation plan, setup notes, Windows release notes
- `scripts/`: versioning and launch helper scripts

## Main Commands

- Install: `npm install`
- Web dev: `npm run dev`
- Desktop dev: `npm run tauri:dev`
- Frontend build: `npm run build`
- Desktop build: `npm run tauri:build`
- Frontend tests: `npm run test`
- Rust tests: `cargo test`

## Development Rules

- Prefer small, safe, incremental changes.
- Do not rewrite large files unless explicitly asked.
- Do not introduce new production dependencies without explaining why.
- Keep Tauri/Rust models and frontend TypeScript models consistent.
- Update docs when behavior, architecture, data model, or commands change.
- Stabilize main flows before doing structural refactors.

## Testing Expectations

- Run relevant tests after changes.
- Add or update tests for new behavior when practical.
- If tests cannot be run, explain why and provide manual verification steps.
- For docs-only changes, say that no runtime tests were necessary.

## Documentation Expectations

- Keep `docs/` up to date.
- Prefer recording project decisions in `docs/` rather than leaving important context only in chat.
- If requirements change, update the relevant requirements or plan doc first.

## Safety And Security Rules

- Be careful with Tauri permissions and capability scope.
- Treat `csp: null` in `src-tauri/tauri.conf.json` as a known security risk.
- Be careful with `dangerouslySetInnerHTML` and generated SVG/HTML output.
- Do not hardcode secrets, tokens, or credentials.
- Be cautious when changing file import/export, backup, or restore flows.

## Change Management Workflow

For new requirements:

1. Update docs first.
2. Update a task list or project plan.
3. Implement.
4. Test.
5. Summarize changes, risks, and verification.

## Definition Of Done

- Code compiles.
- Relevant tests pass, or non-runnable tests are clearly documented.
- User-facing behavior is verified.
- Docs are updated when needed.
- Changed files and commands are summarized.
