# PROMPT_PROBLEM_RECORD

## 1. Purpose

This document records important prompt/problem/decision moments in the TicketTrail project.

It is not a raw chat log and not a complete list of every prompt.

It focuses on how the user:

- discovered bugs or product problems
- described requirements to AI/Codex
- gave constraints
- reviewed AI-proposed solutions
- accepted or rejected implementation directions
- manually verified results
- turned vague ideas into implementation checkpoints

This document complements `docs/AI_COLLABORATION_PROJECT_LOG.md`.

- `AI_COLLABORATION_PROJECT_LOG.md` records major project checkpoints and implementation stories.
- `PROMPT_PROBLEM_RECORD.md` records the user's reasoning, prompt framing, product judgment, and AI-collaboration process.

The goal is to help the user later explain the project truthfully in resumes and interviews as an AI-assisted / vibe coding project.

## 2. How To Use

Add an entry when a discussion contains a meaningful product, debugging, architecture, data, or UI decision.

Good entries include:

- the user found a bug or confusing behavior
- the user rejected an unsafe or unclear direction
- the user defined constraints before implementation
- the user chose between multiple possible approaches
- the user manually verified a checkpoint
- the decision would be useful to explain in an interview

Do not add entries for:

- tiny copy edits
- one-line spacing changes
- mechanical regeneration
- simple "run test and commit" steps

## 3. Entry Template

### Entry

- Related task/checkpoint:
- Problem or user need:
- How the user discovered it:
- Why it mattered:
- Key request to AI/Codex:
- Important user constraints:
- AI/Codex direction:
- User decision:
- What was implemented or documented:
- How it was verified:
- What remained unresolved:
- Interview angle:
- Possible resume bullet material:

---

# 4. Prompt / Problem Records

---

## Entry 1: Flight Number Normalization And Carrier Inference

- Related task/checkpoint:
  - `FLIGHT-CODE-001` to `FLIGHT-CODE-004`

- Problem or user need:
  - Flight number input needed to behave consistently.
  - The user wanted inputs like `jq661`, `jq 661`, and `jq-661` to normalize into a canonical full flight number like `JQ661`.
  - The user did not want the app to silently construct a full flight number from `Carrier + numeric suffix`.

- How the user discovered it:
  - During flight lookup design, the user realized that lookup quality depends on whether the app receives a full carrier-prefix flight number.
  - Numeric-only flight numbers such as `661` are ambiguous and should not be used silently for provider lookup.

- Why it mattered:
  - Flight lookup can fail or return misleading results if the flight number is incomplete or inconsistent.
  - Silent autofill or silent carrier overwrite would reduce trust in the form.
  - The user wanted lookup to be helpful but still transparent and manually controllable.

- Key request to AI/Codex:
  - Normalize full flight-number input.
  - Use normalized full flight codes for lookup.
  - Do not silently look up suffix-only numeric input.
  - Infer carrier from prefix only when safe.

- Important user constraints:
  - Users must enter the full flight number themselves.
  - Do not compose `Carrier + 661` into `JQ661`.
  - Numeric-only flight numbers may be saved, but lookup should not silently use them.
  - Carrier inference should not overwrite a conflicting carrier choice.
  - If flight prefix and carrier conflict, show a warning.

- AI/Codex direction:
  - Add shared flight-code normalization helpers.
  - Add lookup validation.
  - Add safe carrier inference from airline directory data.
  - Add mismatch warning.

- User decision:
  - Accept safe normalization and warning behavior.
  - Reject silent composition or silent overwrite.
  - Keep user control over the carrier field.

- What was implemented or documented:
  - Full-code normalization.
  - Numeric-only lookup blocking.
  - Prefix-based carrier inference.
  - Carrier/prefix conflict warning.
  - Existing train/rail behavior remained unchanged.

- How it was verified:
  - Checked examples such as `jq661`, `jq 661`, `jq-661`, `JQ661`, and `661`.
  - Confirmed lookup uses the normalized full code only when valid.

- What remained unresolved:
  - Airline directory coverage is still incomplete.
  - A future airline data import pipeline is still needed.

- Interview angle:
  - This story shows input normalization, validation, user trust, and safe AI-assisted implementation.
  - It also shows that the user did not simply accept "more automation"; they constrained automation to avoid silent wrong behavior.

- Possible resume bullet material:
  - Designed and validated a flight-number normalization and carrier-inference workflow, improving lookup reliability while preventing unsafe silent autofill.

---

## Entry 2: Rail Map Fake Coordinate Problem

- Related task/checkpoint:
  - `MAP-CITY-FALLBACK-001`
  - `MAP-UNRESOLVED-RAIL-001`

- Problem or user need:
  - Some rail routes showed impossible map locations and extremely large fake distances.
  - Example problem: rail stations like Harbin West / Tianjin West or Hengdaohezi East could be displayed in obviously wrong places.

- How the user discovered it:
  - The user manually checked the app map and noticed that train routes were being drawn to impossible locations.
  - The displayed distance was clearly unrealistic, which exposed that fallback coordinates were unsafe.

- Why it mattered:
  - A fake map point is worse than no map point.
  - Wrong coordinates make the app look unreliable and can mislead the user.
  - The app is a travel archive, so trust in places and routes is central.

- Key request to AI/Codex:
  - Investigate why rail stations were falling back to wrong coordinates.
  - Stop unresolved rail stations from using fake/pseudo coordinates.
  - Use reviewed city-level fallback only when safe.

- Important user constraints:
  - Do not guess exact rail station coordinates.
  - Do not use fake pseudo coordinates for recognized but unresolved rail stations.
  - Keep unresolved rail locations visibly unavailable instead of pretending they are resolved.
  - Exact rail coordinates should remain a future task.

- AI/Codex direction:
  - Audit route-map coordinate resolution.
  - Separate flight airport coordinate fallback from rail station fallback.
  - Add city-level Place Catalog fallback for reviewed rail place mappings.
  - Add unresolved rail safety behavior.

- User decision:
  - Accept city-level fallback for reviewed rail places.
  - Reject pseudo/hash fallback for unresolved rail.
  - Prefer "Map location unavailable" over wrong coordinates.

- What was implemented or documented:
  - Rail coordinate resolution can use reviewed Place Catalog city coordinates.
  - Unresolved rail stations return unavailable coordinate state.
  - Fake long-distance display is suppressed when route endpoints are unresolved.

- How it was verified:
  - User checked corrected resolved examples.
  - User confirmed unresolved examples such as KUX remained unavailable instead of being drawn incorrectly.

- What remained unresolved:
  - Exact rail station coordinates are still future work.
  - Some rail station place mappings remain unresolved or blocked.

- Interview angle:
  - This story shows debugging from a visual symptom to backend/data fallback logic.
  - It shows a product judgment: "missing data is better than fabricated data."

- Possible resume bullet material:
  - Diagnosed and fixed unsafe rail map fallback behavior by replacing pseudo-coordinate rendering with reviewed city-level fallback and explicit unresolved states.

---

## Entry 3: GeoNames / Place Catalog Data-Cleaning Strategy

- Related task/checkpoint:
  - `PLACE-CATALOG-GEONAMES-CN-RAIL-001`
  - `RAIL-STATION-PLACE-REVIEW-001A`

- Problem or user need:
  - The app needed broader place coverage for rail station mapping.
  - Many rail stations could not safely resolve to a Place Catalog entry.

- How the user discovered it:
  - After map fallback fixes, the user found that many rail stations still lacked safe reviewed place mappings.
  - The user asked whether broader GeoNames data could help.

- Why it mattered:
  - Rail map quality and Journey/Summary place normalization depend on place coverage.
  - But bulk importing unreviewed place data could introduce more wrong mappings.

- Key request to AI/Codex:
  - Investigate available GeoNames data.
  - Determine whether existing local files were enough.
  - Generate candidate review worksheets before runtime data changes.
  - Apply only safe matches.

- Important user constraints:
  - Do not blindly import all China GeoNames records.
  - Keep global baseline plus China rail-needed detail.
  - Do not commit raw large source files.
  - Ambiguous matches should remain review-only.
  - English/slug-only matches should not be auto-applied.

- AI/Codex direction:
  - Audit current GeoNames files and generated Place Catalog.
  - Generate grouped unresolved rail candidate review CSV.
  - Separate safe auto-add/canonicalization from ambiguous review cases.
  - Move safe reviewed matches into stable source data for regeneration.

- User decision:
  - Accept review-driven data expansion.
  - Reject unsafe bulk import.
  - Keep ambiguous, slug-only, no-candidate, and conflict rows out of runtime data.

- What was implemented or documented:
  - GeoNames-backed Place Catalog pipeline.
  - Rail-needed China safe match expansion.
  - Candidate review worksheets.
  - Stable reviewed-safe source file.
  - Conflict rows kept as human-review cases.

- How it was verified:
  - Generation counts and coverage reports were checked.
  - Representative rail station examples were reviewed.
  - KUX and other unresolved cases were not forced into unsafe mappings.

- What remained unresolved:
  - Many rail station place mappings still require future review.
  - Exact station coordinates remain separate future work.

- Interview angle:
  - This story shows data pipeline thinking and risk control.
  - It also shows how the user used AI to generate review artifacts instead of blindly trusting generated results.

- Possible resume bullet material:
  - Built a reviewed Place Catalog expansion workflow using GeoNames-derived candidates, improving rail place coverage while keeping ambiguous mappings out of runtime data.

---

## Entry 4: Journey Summary Place Grouping Without Breaking Map Semantics

- Related task/checkpoint:
  - `JOURNEY-PLACE-GROUPING-001A`
  - `JOURNEY-PLACE-GROUPING-001B`
  - `JOURNEY-PLACE-GROUPING-001D`

- Problem or user need:
  - The user wanted Summary statistics to group places at a city/prefecture level.
  - But map display should still preserve more specific reviewed place identities.

- How the user discovered it:
  - While reviewing Summary destinations, the user noticed that detailed places and grouped destination statistics had different needs.
  - Examples included places such as Danyang needing to appear under Zhenjiang in Summary, while Journey Detail could still show Danyang.

- Why it mattered:
  - If all place keys were collapsed to city level, map and detail accuracy would get worse.
  - If no grouping existed, Summary Top Destinations would become noisy or misleading.
  - The same `placeKey` should not be forced to serve both map precision and statistical grouping.

- Key request to AI/Codex:
  - Audit current Journey/Summary place flow.
  - Design a separate grouping layer.
  - Do not change RouteMap.
  - Do not change persisted `journey_stops.placeKey`.
  - Use grouping only in Summary aggregation.

- Important user constraints:
  - Map place identity and Summary grouping identity must stay separate.
  - Do not migrate stored Journey Stops.
  - Do not change Journey List/Detail labels yet.
  - Do not use grouping to hide unresolved rail-place problems.

- AI/Codex direction:
  - Add reviewed grouping source data.
  - Generate `place-grouping.generated.json`.
  - Add lookup helper.
  - Wire grouping into Summary Top Destinations only.

- User decision:
  - Accept separate grouping layer.
  - Keep RouteMap and persisted stop identity unchanged.
  - Expand grouping only through reviewed entries.

- What was implemented or documented:
  - Reviewed/generated place grouping layer.
  - Summary Top Destinations uses `summaryPlaceKey` when available.
  - Journey Detail and RouteMap keep specific place identities.
  - Approved entries were applied selectively.

- How it was verified:
  - User created or checked examples where Detail showed the specific place but Summary grouped it.
  - Danyang -> Zhenjiang was manually verified.

- What remained unresolved:
  - More grouping coverage requires reviewed entries.
  - Mixed placeKey cases needed separate repair before safe grouping.

- Interview angle:
  - This story shows data modeling and separation of concerns.
  - It explains why a single data identity can need different product interpretations in different views.

- Possible resume bullet material:
  - Designed a separate reviewed place-grouping layer for Journey Summary aggregation, preserving map/detail precision while improving destination statistics.

---

## Entry 5: Mixed PlaceKey Repair With Exact Telecode Overrides

- Related task/checkpoint:
  - `PLACE-GROUPING-MIXED-REPAIR-001`
  - `PLACE-GROUPING-MIXED-REPAIR-002`

- Problem or user need:
  - Some generated rail place groups mixed stations from different real places.
  - These mixed keys blocked safe Summary grouping and could pollute future map/place logic.

- How the user discovered it:
  - During grouping candidate review, the user noticed that several rows had sample station names from different real cities or provinces.
  - The user originally reviewed them as problematic `C` cases, then clarified that `C` should mean "needs placeKey repair", not "discard forever."

- Why it mattered:
  - A polluted placeKey can cause incorrect grouping, wrong maps, and wrong future automation.
  - Treating problematic rows as simply rejected would hide real data-quality issues.

- Key request to AI/Codex:
  - Do not process only a tiny batch.
  - Inspect all 23 mixed rows in one pass.
  - Apply every repair that is safe with local data.
  - Explicitly block the rest with clear reasons.

- Important user constraints:
  - Do not guess.
  - Do not apply broad placeGroup overrides.
  - Prefer exact telecode-scoped overrides.
  - Do not use broad station-name overrides when ambiguous.
  - Do not reduce map specificity just to make grouping easier.
  - Block ambiguous rows instead of forcing them.

- AI/Codex direction:
  - Read the mixed repair worksheet.
  - Inspect generated rail station data.
  - Add exact telecode overrides for safe station groups.
  - Regenerate rail station data through the generator.
  - Update repair worksheet statuses.
  - Add grouping rows only when now safe.

- User decision:
  - Approve one-pass inspection of all 23 rows.
  - Accept safe exact telecode repairs.
  - Keep ambiguous rows blocked.
  - Pause the rail/place/grouping cleanup line after no more safe repairs were available.

- What was implemented or documented:
  - 39 exact telecode rail overrides.
  - 13 rows fully repaired.
  - 5 rows partially repaired.
  - 5 rows remained blocked.
  - Final blocked rows were documented and intentionally paused.

- How it was verified:
  - Validation scripts and targeted tests passed.
  - Representative telecodes were checked.
  - User reviewed Codex reports and accepted the checkpoint.

- What remained unresolved:
  - 5 rows still require stronger local evidence or reviewed specific place keys.
  - KUX / Hengdaohezi East remains unresolved for later work.

- Interview angle:
  - This story shows that the user could push for efficiency while still preserving safety.
  - It demonstrates human review over AI-generated data and careful scoping of automated repair.

- Possible resume bullet material:
  - Led a reviewed data-repair pass for mixed rail place keys, applying exact telecode-scoped overrides while explicitly blocking ambiguous cases to prevent unsafe remapping.

---

## Entry 6: Overview Redesign And User-Guided UI Decision Process

- Related task/checkpoint:
  - `OVERVIEW-REDESIGN-001`
  - `OVERVIEW-REDESIGN-001A`
  - `OVERVIEW-REDESIGN-002`
  - `OVERVIEW-REDESIGN-002A`
  - `OVERVIEW-REDESIGN-002B`

- Problem or user need:
  - The old Overview page felt cluttered and confusing.
  - It mixed hero summary, analytics, route map, scope inspector, and route-heavy dashboard content.
  - The user wanted to rebuild it from a new design direction, not patch it incrementally.

- How the user discovered it:
  - The user reviewed the existing UI and felt the Overview was too messy.
  - After the first redesigned shell, the user gave screenshot feedback: fonts were too large, spacing was too loose, copy was redundant, and modules had too many nested mini-cards.

- Why it mattered:
  - Overview is the app's home page and first impression.
  - A cluttered Overview makes the app feel less polished even when the underlying features are strong.
  - The page should feel like a personal travel archive home, not a debug or analytics workbench.

- Key request to AI/Codex:
  - First audit current Overview.
  - Write a design document.
  - Do not implement until the user approves the layout.
  - After approval, implement a new shell.
  - Then refine density, alignment, copy, and transport-scope behavior.

- Important user constraints:
  - UI/design decisions must be discussed with the user before implementation.
  - Do not let Codex jump directly into code after a vague design idea.
  - The approved order is:
    1. Archive Snapshot
    2. Full-width Travel Map
    3. Focus Trip
    4. Recent Journeys + Upcoming/Recent Tickets
    5. This year + Favorite places
  - No Quick Actions in Overview V1.
  - No data health panel in Overview.
  - Data health should later belong to Tickets/Journeys list filters or reminders.
  - All / Flights / Rail toggle should scope tickets/map/stats.
  - Journey modules should show whole journeys that contain the selected transport, not split the journey into transport-only fragments.

- AI/Codex direction:
  - Audit `HomePage`, `StatisticsPanel`, `Dashboard(mode="overview")`, and data sources.
  - Create `OVERVIEW_REDESIGN.md`.
  - Replace old Overview composition with new shell.
  - Tighten visual density and reduce redundant copy.
  - Add transport scope toggle.
  - Refine Journey scope semantics.

- User decision:
  - Approve the new high-level direction.
  - Reorder the page so total overview comes before the map and focus trip.
  - Require a full-width map row.
  - Reject redundant headings and heavy nested card structures.
  - Clarify that mixed journeys can appear in both Flights and Rail views as complete journeys.

- What was implemented or documented:
  - Overview redesign document.
  - New Overview shell.
  - Denser layout pass.
  - All / Flights / Rail scope toggle.
  - Journey-scope behavior clarified and implemented.

- How it was verified:
  - User reviewed screenshots and gave UI feedback.
  - Build and targeted tests passed.
  - The user continued refining behavior before accepting later implementation steps.

- What remained unresolved:
  - Further data-selection refinement may still be needed.
  - Shared route styling is separate:
    - flight and rail lines should use different colors
    - all map lines should be thinner
    - repeated routes should use a simple binary thicker style

- Interview angle:
  - This story shows product/design ownership, not just coding.
  - It demonstrates that the user uses AI as an implementation partner but keeps control of UX decisions.

- Possible resume bullet material:
  - Led a full Overview redesign from audit to implementation, replacing an analytics-heavy dashboard with a cleaner travel-archive home and transport-aware scoped views.

---

## Entry 7: AI Collaboration Workflow And Checkpoint Control

- Related task/checkpoint:
  - Ongoing project process
  - `DOC-AI-LOG-001`
  - `PROJECT-STORY-LOG-001`

- Problem or user need:
  - The user wanted the project to be usable for real development and later interview explanation.
  - Because the project is AI-assisted, the user needed a clear record of what was decided, implemented, tested, and deferred.

- How the user discovered it:
  - While preparing for job search, the user saw advice about recording prompts, problems, decisions, and optimization ideas for vibe coding projects.
  - The user realized that existing checklists captured tasks, but not enough of the reasoning and prompt process.

- Why it mattered:
  - For interviews, the user needs to explain not only what the project does, but how they worked with AI and controlled quality.
  - Without records, key decisions and debugging stories can be forgotten.

- Key request to AI/Codex:
  - Create a durable project story log.
  - Record major checkpoints, not every tiny edit.
  - Keep future updates tied to meaningful feature/fix/design checkpoints.

- Important user constraints:
  - Be truthful about AI-assisted development.
  - Do not claim everything was hand-coded manually.
  - Record user decisions, manual verification, and quality-control process.
  - Do not let this documentation become noisy after every minor tweak.

- AI/Codex direction:
  - Create `AI_COLLABORATION_PROJECT_LOG.md`.
  - Update `TASKS.md` and `ISSUE_CHECKLIST.md`.
  - Add seed entries for major completed checkpoints.

- User decision:
  - Keep project development and resume/interview prep mostly in separate conversations.
  - Use project docs as the bridge between them.
  - Add a companion prompt/problem record based on user reasoning, not just Codex summaries.

- What was implemented or documented:
  - Major-checkpoint story log created.
  - Process notes added to project docs.
  - This prompt/problem record was planned as a user-reasoning companion document.

- How it was verified:
  - User reviewed Codex summary and clarified that Codex alone should not write the prompt/problem record content.
  - User decided that the assistant and user should draft the reasoning content first, and Codex should only place confirmed content into the repository.

- What remained unresolved:
  - Resume bullets and final interview answers still need a separate resume/interview-prep conversation.
  - Future major checkpoints should keep updating the story log and prompt/problem record.

- Interview angle:
  - This story helps explain how the user managed AI-assisted development responsibly:
    - requirements
    - constraints
    - review
    - testing
    - checkpointing
    - documentation

- Possible resume bullet material:
  - Established a checkpoint-based AI-assisted development workflow with structured issue tracking, project story logs, and validation gates for maintainable iterative delivery.
