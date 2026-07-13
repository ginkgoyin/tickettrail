# AI_COLLABORATION_PROJECT_LOG

## 1. Purpose

This document is a resume/interview-oriented project story log for TicketTrail.

It records major checkpoints in a durable, reviewable format so the project can be resumed later and so the user can truthfully explain how the work was done in an AI-assisted workflow.

This log is intentionally selective.
It should capture meaningful feature, design, architecture, data, and debugging checkpoints, not every tiny tweak.

It is also a transparency record for AI collaboration.
In this project, the user defines requirements, makes product decisions, reviews results, performs manual verification, and decides what gets committed or pushed.
Codex/AI helps inspect the codebase, propose approaches, implement changes, run checks, and summarize tradeoffs.

## 2. How To Use This Log

Append a new entry when a task creates a meaningful story that would be useful for:

- resume bullets
- interview examples
- architecture discussions
- debugging stories
- product/design decision explanations
- AI-collaboration transparency

Good candidates for a new entry:

- a user-facing feature with clear tradeoffs
- a tricky bug/root-cause investigation
- a data-pipeline or schema-related decision
- a design checkpoint that changes product direction
- a cross-layer fix touching frontend, backend, and generated data

Usually do not append a new entry for:

- tiny copy edits
- small spacing tweaks
- one-line typo fixes
- purely mechanical regeneration with no design/debugging story

Relationship to other docs:

- `docs/ISSUE_CHECKLIST.md`
  - checklist of completed/open items and implementation status
- `docs/TASKS.md`
  - roadmap and active work line
- `docs/AI_COLLABORATION_PROJECT_LOG.md`
  - narrative record of the most interview-worthy checkpoints

Suggested workflow after a major checkpoint:

1. finish the task
2. update `docs/ISSUE_CHECKLIST.md`
3. update `docs/TASKS.md` if roadmap or active line changed
4. append or expand a story entry here if the checkpoint is significant

Later, the user can send this file to a separate resume/interview-prep chat and ask for:

- STAR story extraction
- resume bullet drafting
- mock interview questions
- architecture discussion prompts
- "what did I actually do vs what AI helped with" framing

## 3. Entry Template

Use this template for future major checkpoints.

### Entry

- Date:
- Task ID:
- Area:
- Status:
- Problem / requirement:
- Why it mattered:
- User decision / product constraint:
- Prompt / Codex task framing:
- Alternatives considered:
- Final approach:
- Implementation summary:
- Files / modules changed:
- Tests / validation:
- Manual verification:
- Risks / tradeoffs:
- Follow-up optimization ideas:
- Interview talking points:

### STAR Summary

- Situation:
- Task:
- Action:
- Result:

## 4. Seed Entries

These seed entries are concise and conservative.
They are based on current repository docs/checklists and should be expanded from commit history later if a fuller interview narrative is needed.

---

## Entry: Flight Number Normalization And Carrier Inference

- Date: Recorded retrospectively from project checklist
- Task ID: `FLIGHT-CODE-001` to `FLIGHT-CODE-004`
- Area: Ticket form / flight lookup / airline directory usage
- Status: Implemented, with manual verification noted in checklist
- Problem / requirement:
  - Flight numbers needed a consistent canonical format such as `JQ661`.
  - Numeric-only codes like `661` should not be silently used for lookup.
  - Carrier should be inferred from the flight prefix only when safe.
- Why it mattered:
  - Inconsistent flight numbers break lookup quality, search behavior, and data quality.
  - Silent carrier overwrites would reduce user trust.
- User decision / product constraint:
  - Users must enter the full flight number themselves.
  - The app must not compose `Carrier + suffix` into a full code.
  - Numeric-only flight numbers may still be saved, but should warn and should not drive lookup.
- Prompt / Codex task framing:
  - Implement a focused normalization layer plus safe carrier inference and mismatch warnings without changing train behavior.
- Alternatives considered:
  - composing the code from carrier plus suffix
  - blocking numeric-only save completely
  - silently overwriting the carrier field on prefix match
- Final approach:
  - normalize user input into a canonical full-code format
  - block suffix-only lookup while still allowing save
  - infer carrier only when the airline directory has a safe match and the carrier field is empty
  - show a warning on carrier/prefix mismatch
- Implementation summary:
  - added shared flight-code helpers
  - normalized flight number input
  - added numeric-only warning behavior
  - connected lookup to normalized full-code validation
  - kept train/rail behavior unchanged
- Files / modules changed:
  - `src/components/TicketForm.tsx`
  - shared flight-code helper module
  - supporting docs/checklist updates
- Tests / validation:
  - helper-level targeted tests and project checks were recorded
- Manual verification:
  - examples like `jq661`, `jq 661`, `jq-661`, `JQ661`, and numeric-only `661`
- Risks / tradeoffs:
  - airline directory coverage is still incomplete
  - safe inference depends on reviewed airline data quality
- Follow-up optimization ideas:
  - richer airline dataset/import pipeline
  - stronger mismatch UX
  - more explicit lookup validation/error copy
- Interview talking points:
  - balancing normalization, user control, and safe autofill
  - separating canonical storage from UX convenience

### STAR Summary

- Situation: Flight ticket entry allowed inconsistent flight-number formatting and weak airline inference behavior.
- Task: Improve input quality and lookup safety without breaking existing workflows.
- Action: Added shared normalization helpers, safe carrier inference, mismatch warnings, and lookup blocking for suffix-only values.
- Result: Flight numbers became more consistent, lookup became safer, and train behavior stayed unchanged.

---

## Entry: Rail Map City Fallback And Unresolved Rail Safety

- Date: Recorded retrospectively from project checklist
- Task ID: `MAP-CITY-FALLBACK-001` and `MAP-UNRESOLVED-RAIL-001`
- Area: Route map / rail metadata / backend coordinate resolution
- Status: Implemented, with manual verification and unresolved review follow-up
- Problem / requirement:
  - Rail stations without exact coordinates were falling back to pseudo/hash coordinates, producing impossible map points and fake long distances.
- Why it mattered:
  - Fake coordinates are worse than missing coordinates because they mislead the user.
- User decision / product constraint:
  - Do not fake rail coordinates.
  - Use city-level Place Catalog fallback only when the place mapping is reviewed and available.
  - Unresolved rail stations must not be displayed as if their coordinates are real.
- Prompt / Codex task framing:
  - First add city-level rail fallback through Place Catalog, then stop unresolved rail stations from using pseudo/hash map points.
- Alternatives considered:
  - continuing pseudo fallback for rail
  - importing exact rail station coordinates immediately
  - using a broader external map source as a quick fix
- Final approach:
  - route-map resolution prefers reviewed city-level Place Catalog coordinates for rail
  - unresolved recognized rail stations are treated as unavailable instead of pseudo-located
  - fake huge distance output is suppressed for unresolved rail routes
- Implementation summary:
  - audited coordinate resolution order
  - connected recognized rail place metadata to city-level Place Catalog coordinates
  - separated resolved rail fallback from unresolved rail behavior
  - preserved station labels while improving coordinate safety
- Files / modules changed:
  - primarily backend route-map resolution logic plus related docs/tests
- Tests / validation:
  - targeted route-map / rail coverage validation was recorded
- Manual verification:
  - verified resolved examples such as Harbin/Tianjin behavior
  - unresolved examples such as KUX remained unresolved without fake coordinates
- Risks / tradeoffs:
  - city-level fallback is still coarse
  - unresolved station coverage depends on ongoing place review work
- Follow-up optimization ideas:
  - exact rail station coordinates from a reviewed future source
  - broader reviewed rail place coverage
- Interview talking points:
  - why "no data" can be safer than fabricated data
  - designing a fallback chain that protects user trust

### STAR Summary

- Situation: Rail route maps were showing impossible locations and fake distances because unresolved stations fell through to pseudo coordinates.
- Task: Make rail map behavior safer without pretending city-level fallback is exact station geography.
- Action: Added reviewed city-level fallback and blocked pseudo coordinates for recognized-but-unresolved rail stations.
- Result: Resolved rail routes became usable, unresolved stations no longer misled users, and future review work was clearly separated.

---

## Entry: GeoNames / Place Catalog Rail Coverage Expansion

- Date: Recorded retrospectively from project checklist
- Task ID: `PLACE-CATALOG-GEONAMES-CN-RAIL-001`
- Area: Generated data pipeline / place catalog / rail coverage
- Status: Implemented safe first batch, with further review workflow kept open
- Problem / requirement:
  - Many rail station place mappings could not resolve into the Place Catalog, limiting safe map fallback.
- Why it mattered:
  - Rail map quality depended on real place coverage, not just UI logic.
- User decision / product constraint:
  - Do not bulk-import questionable data.
  - Keep the global baseline and add only the reviewed China rail-needed subset.
  - Do not commit raw GeoNames source files.
- Prompt / Codex task framing:
  - Expand Place Catalog coverage using only safe reviewed candidate matches from local GeoNames-based review artifacts.
- Alternatives considered:
  - adding every China GeoNames entry
  - manually editing generated catalog output
  - fixing only a few visible example stations
- Final approach:
  - created a review pipeline
  - applied only safe reviewed matches and canonicalizations
  - kept risky or ambiguous cases for later review
- Implementation summary:
  - generated review artifacts
  - expanded Place Catalog with safe reviewed China matches
  - improved rail place coverage without pretending full review was complete
- Files / modules changed:
  - place-catalog generators
  - review artifacts
  - generated catalog data
  - supporting docs/tests
- Tests / validation:
  - generation and coverage validation scripts were used
- Manual verification:
  - representative resolved rail stations were checked after coverage expansion
- Risks / tradeoffs:
  - coverage increased but remained incomplete
  - ambiguous locations still need human review
- Follow-up optimization ideas:
  - reviewed override batches
  - more place-catalog grouping/repair work
- Interview talking points:
  - staged data-pipeline hardening
  - using review artifacts to keep AI/data-assisted changes auditable

### STAR Summary

- Situation: Safe rail map fallback depended on place coverage that the existing catalog did not yet provide.
- Task: Expand coverage without importing unreviewed bulk data or faking coordinates.
- Action: Built a review-driven GeoNames/Place Catalog pipeline and applied only safe reviewed China rail matches.
- Result: Rail coverage improved materially while preserving an auditable path for the unresolved remainder.

---

## Entry: Journey Summary Place Grouping Layer

- Date: Recorded retrospectively from project checklist
- Task ID: `JOURNEY-PLACE-GROUPING-001A` and `JOURNEY-PLACE-GROUPING-001B`
- Area: Journey summary / place grouping / separation of map vs summary semantics
- Status: Implemented
- Problem / requirement:
  - Specific reviewed places are useful for map accuracy, but Summary destination aggregation often needs a city/prefecture-level grouping.
- Why it mattered:
  - Forcing map place keys to city level would reduce geographic usefulness.
  - Leaving Summary fully ungrouped would create noisier destination statistics.
- User decision / product constraint:
  - Keep `journey_stops.placeKey` as the specific reviewed place identity.
  - Add a separate grouping layer for Summary instead of changing map semantics.
- Prompt / Codex task framing:
  - First add a safe grouping data/model layer, then wire it into Summary only.
- Alternatives considered:
  - storing grouped keys directly in journey stops
  - collapsing rail/map place keys to city level
  - dynamic grouping without reviewed mapping data
- Final approach:
  - add a reviewed/generated grouping map
  - keep route-map fallback on specific places
  - use grouping only in Summary top destinations where available
- Implementation summary:
  - created reviewed grouping source and generated output
  - added lookup helpers and targeted tests
  - wired Summary aggregation to `summaryPlaceKey` when a reviewed grouping exists
- Files / modules changed:
  - place grouping data source and generator
  - `src/lib/placeGrouping.ts`
  - `src/lib/journeySummary.ts`
  - related tests/docs
- Tests / validation:
  - targeted place-grouping and journey-summary tests
- Manual verification:
  - confirmed examples such as specific-place Journey detail with grouped Summary output
- Risks / tradeoffs:
  - grouping coverage is still intentionally limited to reviewed mappings
- Follow-up optimization ideas:
  - expand reviewed grouping coverage
  - later decide whether more Journey surfaces should expose grouped semantics
- Interview talking points:
  - separating one data identity into two product meanings
  - preserving map accuracy while improving analytics readability

### STAR Summary

- Situation: One `placeKey` concept was being asked to serve both map accuracy and destination roll-up needs.
- Task: Improve Summary grouping without degrading route-map precision or migrating stored journey stops.
- Action: Added a separate reviewed grouping layer and wired Summary to use it only when available.
- Result: Summary became cleaner while Journey stop identity and map behavior remained stable.

---

## Entry: Mixed Rail PlaceKey Repair With Exact Telecode Overrides

- Date: Recorded retrospectively from project checklist
- Task ID: `PLACE-GROUPING-MIXED-REPAIR-001`
- Area: Rail place quality / override safety / generated data repair
- Status: Implemented and pushed, with a later verification pass recorded
- Problem / requirement:
  - Some generated rail place groups mixed stations from multiple real places under one placeKey, which blocked safe Summary grouping and downstream mapping quality.
- Why it mattered:
  - Mixed place keys create incorrect roll-ups and poison later automation.
- User decision / product constraint:
  - Repair only with exact, reviewable overrides.
  - No broad place-group overrides for mixed rows.
  - No unsafe station-name-only guessing.
- Prompt / Codex task framing:
  - Inspect all mixed rows, apply every safe repair using exact telecode-scoped overrides, and explicitly block the rest.
- Alternatives considered:
  - leaving mixed rows untouched
  - broad placeGroup overrides
  - hand-editing generated rail data directly
- Final approach:
  - use reviewed, exact telecode-scoped rail station overrides
  - regenerate rail data through the pipeline
  - keep blocked rows documented instead of guessed
- Implementation summary:
  - reviewed all mixed rows
  - applied a batch of safe exact telecode overrides
  - updated grouping where now safe
  - preserved blocked cases with explicit reasons
- Files / modules changed:
  - rail override source
  - regenerated rail station data
  - place grouping data
  - repair worksheet and related tests/docs
- Tests / validation:
  - override validation
  - rail coverage validation
  - targeted place-grouping and rail-override tests
- Manual verification:
  - representative telecode mappings and grouping roll-ups were checked
- Risks / tradeoffs:
  - some ambiguous rows still remained blocked
  - exact coordinate coverage was still not part of this repair line
- Follow-up optimization ideas:
  - future small-batch override review
  - broader place quality review only if product value justifies it
- Interview talking points:
  - preventing data-cleanup work from becoming unsafe mass rewriting
  - why exact key-scoped repair is safer than fuzzy matching

### STAR Summary

- Situation: Mixed rail place keys were contaminating grouping and map-related downstream behavior.
- Task: Repair as much as possible in one pass without introducing unsafe broad remaps.
- Action: Applied reviewed telecode-scoped overrides, regenerated data, and left the rest explicitly blocked.
- Result: Data quality improved while preserving an auditable record of what was fixed and what was intentionally deferred.

---

## Entry: Overview Redesign Audit, Decision, And First Shell

- Date: Recorded retrospectively from project checklist
- Task ID: `OVERVIEW-REDESIGN-001`, `OVERVIEW-REDESIGN-001A`, and `OVERVIEW-REDESIGN-002`
- Area: Information architecture / dashboard UX / archive home
- Status: Implemented first shell, with later refinement checkpoints tracked separately
- Problem / requirement:
  - The old Overview felt cluttered, route-heavy, and split across multiple overlapping modules.
- Why it mattered:
  - Overview is the archive home and strongly shapes first impression and daily usability.
- User decision / product constraint:
  - Do not patch the old Overview incrementally.
  - Redesign from a new information architecture.
  - Keep it a clean personal travel archive home, not an analytics workbench.
- Prompt / Codex task framing:
  - First audit the old Overview and write the redesign direction, then build the first runtime shell in the approved section order.
- Alternatives considered:
  - small visual cleanup of the old layout
  - keeping analytics and route-debug surfaces on Overview
  - preserving old stacked `StatisticsPanel` plus `Dashboard(mode="overview")`
- Final approach:
  - define a new section order and purpose
  - replace the old composition with a new shell:
    - total overview
    - travel map
    - focus trip
    - recent journeys and tickets
    - this year and favorite places
- Implementation summary:
  - audited current Overview responsibilities and duplication
  - documented the redesign direction
  - implemented the first new layout shell and later refined density/scope behavior in follow-up tasks
- Files / modules changed:
  - overview redesign docs
  - `src/App.tsx`
  - `src/pages/HomePage.tsx`
  - `src/styles.css`
- Tests / validation:
  - build and targeted test checks were run
- Manual verification:
  - section order, reduced clutter, and later transport-scope behavior were manually reviewed
- Risks / tradeoffs:
  - first shell still needs continued visual polish
  - shared route styling is intentionally deferred to a separate map task
- Follow-up optimization ideas:
  - shared route styling
  - richer data connection/polish
  - responsive refinement
- Interview talking points:
  - redesigning from user goals instead of patching inherited UI
  - separating product-home concerns from analytics/detail concerns

### STAR Summary

- Situation: The old Overview mixed hero stats, analytics, scope inspection, and route-heavy content into a cluttered page.
- Task: Replace it with a cleaner archive-home structure that reflects what users actually need first.
- Action: Audited the current IA, documented a new section order, and implemented the first new runtime shell.
- Result: Overview moved toward a cleaner archive-home experience with a clearer base for future refinement.
