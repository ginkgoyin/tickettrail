# JOURNEY_DESIGN

## 1. Purpose

This document expands the Journey direction into an implementation-ready MVP design.

It keeps the already accepted product direction:

- Journey = one trip / travel record / trip collection
- Ticket = single-ticket management
- Overview = whole-archive summary
- Journeys should be manually created first
- Journey creation should start from selecting tickets
- Journey title is the main title
- Destination is secondary metadata
- Companions start as free text
- Ticket and Journey remain many-to-many

This task is docs-only.

It does not:

- implement Journey runtime UI
- implement Journey CRUD
- implement Journey schema or migration
- change current Overview runtime UI
- change current Ticket detail runtime UI
- change current segment behavior
- implement Journey maps

- 



## 2. Current status

Current repo inspection shows:

- Real Journey schema, CRUD service, List, Create, Detail, Edit, Delete, and Summary runtime are implemented.
- The lightweight Create/Edit Stays editor is implemented.
- Summary includes all-time totals, a selected-year Travel calendar, Travel highlights, Top destinations, Top companions, and Cost by currency modules.
- Summary Top destinations now prefer persisted Stays when available, while old journeys without Stays still use safe legacy fallback.
- A separate reviewed/generated place-grouping data layer now exists, and Summary Top destinations already use it when persisted Stays/Stops are available while Journey Detail labels and RouteMap semantics remain unchanged.
- Journey map coloring and advanced year-scoped map behavior remain future work.
- Per-stay lodging, per-stay notes, and later review prompts remain future work.

## 3. Product definition and granularity

### JOURNEY-DECISION-008

Journey represents one trip / travel record / trip collection.
It does not represent a single ticket or a single segment.

### JOURNEY-DECISION-009

A Journey can contain different transport types, such as flight / train / rail, with possible future bus / ferry support.

### JOURNEY-DECISION-010

Ticket and Journey stay many-to-many.
One ticket can belong to multiple journeys.

Example:

- an `A -> B` ticket can be the end of the `A` trip
- and the beginning of the `B` trip

### JOURNEY-DECISION-011

Tickets inside a Journey are sorted automatically by time.
No manual ordering is needed in MVP.

### JOURNEY-DECISION-012

Journey dates default to auto-derived from linked tickets:

- `start_date = earliest linked ticket departure`
- `end_date = latest linked ticket arrival`

Manual date override is allowed.

## 4. Journey MVP scope

### Must have

- Journey List
- Create Journey manually from `Journeys > List`
- Create Journey by filling basic info first, then selecting tickets
- Journey title
- Optional destination
- Auto-suggested destination from selected tickets
- Date mode: auto from tickets / manual override
- Free-text companions
- Rating
- Mood
- Cost amount
- Cost currency
- Lodging
- Notes / memories
- Linked tickets
- Journey Detail
- Edit Journey
- Delete Journey
- Year filter in Journey List
- Month filter in Journey List
- Ticket selector search during Create Journey

### Should have if easy

- total distance from linked tickets if already available
- route summary
- compact linked-ticket list
- mini calendar in Journey Detail

### Not in MVP

- automatic Journey inference
- journey-colored map
- yearly route map filtering
- companions autocomplete
- partial ticket / partial segment linking
- manual linked-ticket ordering
- advanced route de-duplication
- Journey attachments / photos
- export all segment PNGs
- UI art-style redesign

## 5. Create Journey flow

### JOURNEY-DECISION-013

Create Journey entry point is only in `Journeys > List`.
`Journeys > Summary` is for summary only and should not contain the Create Journey button.

### JOURNEY-DECISION-014

Compatibility note:

- The rules in this early MVP section describe the existing/legacy Journey Create/Edit behavior.
- Future Create/Edit should move toward a Stays-first model per `JOURNEY-DECISION-084` and later Stay-block decisions.
- Until that future editor exists, these destination-field notes remain useful for understanding the current persisted/runtime MVP.

Create Journey flow:

1. User fills title / destination / companions / notes / rating / mood / cost / lodging.
2. User selects tickets.
3. User saves.

### JOURNEY-DECISION-015

Title is required.
Destination is optional.
Destination can be auto-suggested from selected tickets and manually edited.

### JOURNEY-DECISION-016

Destination is a free-text field in MVP.

### JOURNEY-DECISION-017

Companions are entered in one input field.
Multiple names can be separated by comma, Chinese comma, dunhao, or newline.
Save parsed names as Journey companion records.

Future:

- previously saved names can appear as suggestions / autocomplete

Example:

- after saving `妈妈`
- entering `ma` / `m` / `mama` / `妈` / `妈妈`
- can later suggest `妈妈`

### JOURNEY-DECISION-018

Create Journey allows zero linked tickets.

### JOURNEY-DECISION-019

Ticket selector search is required.
Search should support:

- date
- month
- year
- flight / train / rail code
- departure place
- arrival place

## 6. Create/Edit Journey form layout

### JOURNEY-DECISION-045

Compatibility note:

- This section still describes the current/legacy MVP modal structure that centers `destination` in the basic metadata form.
- Future Create/Edit should evolve toward a Stays-focused editor while keeping these notes as compatibility guidance for the currently implemented flow.

Create/Edit Journey uses a modal, not a standalone page.
The modal can be wider than the ticket modal and use multi-column layout where appropriate.

### JOURNEY-DECISION-046

Create/Edit Journey does not use a stepper.
Use sections inside one modal:

- Basic
- Tickets
- People & cost
- Notes

### JOURNEY-DECISION-047

Date mode defaults to `Auto from selected tickets`.
If there are no linked tickets, auto dates are empty.
Users can switch to `Manual date range`.

### JOURNEY-DECISION-048

Destination auto-suggestion must not overwrite user input.

- If destination is empty, selected tickets can fill a suggestion.
- If the user already typed a destination, show a suggestion chip such as `Use suggested: Sydney` instead of overwriting.

### JOURNEY-DECISION-049

Cost currency auto-suggestion must not overwrite user input.

- If currency is empty, selected tickets can suggest a currency.
- If the user manually changed currency, do not overwrite it.

### JOURNEY-DECISION-050

Rating uses `1-5` star buttons.
Clicking the nth star lights up stars `1` through `n`.

### JOURNEY-DECISION-051

Mood is a free-text input.

Examples:

- `开心`
- `累但值得`
- `一般`

## 7. Ticket selector behavior

Ticket selector rows should show:

- checkbox
- date
- transport type icon
- route summary
- code summary
- status
- optional carrier/operator subtitle

### Route summary

Single-segment ticket:

- `SYD -> AYQ`

Multi-segment ticket:

- `CSX -> PVG -> SYD`
- `SYD -> BNE -> AYQ`

### Code summary

Single-segment:

- `HO1230`

Multi-segment:

- `HO1230 / HO1669`

Related future task:

- `TICKET-LIST-SEGMENT-CODE-001`
  - Ticket List and Journey linked-ticket rows should show multi-segment code summaries such as `HO1230 / HO1669` instead of only one flight/train code.

## 8. Journey List design

### JOURNEY-DECISION-020

Journey List uses compact card rows.
Each Journey card can be clicked to open Journey Detail.

### JOURNEY-DECISION-021

Navigation chain:

- `Journeys`
- `Journey List`
- `Journey Detail`
- `Ticket Detail`

### JOURNEY-DECISION-022

Linked ticket rows in Journey Detail can be clicked to open existing Ticket Detail.

### JOURNEY-DECISION-023

Journey List needs year filter and month filter.
Default:

- `All years`
- `All months`

### JOURNEY-DECISION-024

Journey List default sort is `start_date` descending.
Journeys with no date go last.

### JOURNEY-DECISION-025

Long route summaries can be truncated:

- `CSX -> PVG -> SYD -> MEL -> ...`

### JOURNEY-DECISION-026

A Journey with zero tickets displays `No tickets yet`.
Add/remove ticket operations belong in Journey Edit, not as extra list-card buttons.

### Journey List card content

Each Journey List card should display:

- title
- destination
- date range
- duration
- ticket count
- segment count
- companion summary
- route summary
- total distance if derivable

## 9. Journey Detail design

### JOURNEY-DECISION-027

Journey Detail should include a small calendar module that highlights the Journey date range.

### JOURNEY-DECISION-028

Journey Detail MVP does not require a map.
Route map / Journey map can be added later.
MVP can use route summary.

### JOURNEY-DECISION-029

Journey Detail linked tickets use compact ticket rows/cards.
Clicking a linked ticket opens the existing Ticket Detail.

### JOURNEY-DECISION-030

Linked-ticket row style can follow Ticket List card style, but must not duplicate full Ticket Detail.

### JOURNEY-DECISION-035

Companions display as chips in Journey Detail.

### JOURNEY-DECISION-037

Edit Journey can modify:

- title
- destination
- date mode / manual date range
- companions
- notes
- rating
- mood
- cost
- lodging
- linked tickets

### Recommended Journey Detail modules

Sticky action bar:

- Back
- title
- Edit
- Delete

Journey summary:

- destination
- date range
- duration
- ticket count
- segment count
- transport types
- companions
- cost
- rating
- mood
- short generated notes preview

Mini calendar:

- highlights `start_date` to `end_date`
- if only one date exists, highlight one day
- no daily itinerary editing
- no drag/drop

Linked tickets:

- compact rows
- click row to open Ticket Detail

Route summary:

- text summary in MVP
- map later

Notes:

- full notes / memories / lodging details

### Zero-ticket Journey Detail

If a Journey has zero linked tickets, show:

- `No tickets linked yet.`
- `Use Edit to add tickets to this journey.`

## 10. Journey notes and memory fields

### JOURNEY-DECISION-032

Journey notes have two layers:

- short notes / summary notes: auto-generated
- full notes: user-entered, can be empty

### JOURNEY-DECISION-033

Short notes can summarize:

- duration
- cost
- lodging count
- flight count
- rail/train count
- rating
- mood

Example:

- `4 days 3 nights | cost 2000 AUD | 1 hotel | 2 flights | 5 stars | 开心`

### JOURNEY-DECISION-034

Full notes can include:

- rating
- mood
- cost
- memories
- lodging

User-entered full notes can be empty.

### JOURNEY-DECISION-038

Journey MVP has rating, `1-5`, nullable.

### JOURNEY-DECISION-039

Journey MVP has mood, free text / emoji text, nullable.

### JOURNEY-DECISION-040

Journey MVP has `costAmount`, nullable.

### JOURNEY-DECISION-041

Journey MVP has `costCurrency`.
No exchange-rate conversion.
Default can be suggested from linked-ticket geography and can be manually changed.

### JOURNEY-DECISION-042

Journey MVP has `lodging`, free text / multiline text, nullable.

### JOURNEY-DECISION-043

The app may store `dateMode = auto | manual`.
UI does not need to prominently show `auto`.
Display the final derived/manual duration normally.

### JOURNEY-DECISION-044

Destination can be suggested from linked tickets by detecting the main or intermediate travel locations.
User can manually edit it.

## 11. Destination and currency auto-suggestion rules

### Destination suggestion

Destination is free text but can be suggested.

For simple round trip:

- `Changsha -> Sydney -> Changsha`
- suggest `Sydney` or `Australia / Sydney`, depending on available location labels

For multi-city trip:

- `Shanghai -> Hangzhou -> Suzhou -> Shanghai`
- suggest `Hangzhou | Suzhou`, or a shortened multi-city summary

For one-way:

- `Changsha -> Sydney`
- suggest `Sydney`

If the user already edited destination, do not overwrite.
Show an optional suggestion chip instead.

### Currency suggestion

Currency is display-only, with no exchange-rate conversion.

If linked tickets form a likely round trip:

- `origin country A -> destination country B -> origin country A`
- suggest country B currency

Example:

- `Changsha -> Sydney -> Changsha`
- suggest `AUD`

If one-way:

- suggest final destination country currency if known

If multi-country or unclear:

- leave empty rather than guessing

If the user already edited currency, do not overwrite.

## 12. Data model proposal

This is documentation only.
Do not implement this schema in this task.

### Proposed SQL direction

```sql
journeys
- id
- title
- destination
- date_mode
- start_date
- end_date
- notes
- rating
- mood
- cost_amount
- cost_currency
- cost_exchange_rate_to_cny
- lodging
- created_at
- updated_at

journey_tickets
- id
- journey_id
- ticket_id
- created_at

journey_companions
- id
- journey_id
- name
- created_at
```

### JOURNEY-DECISION-052

Deleting a ticket removes corresponding `journey_tickets` links.
The Journey itself is not deleted.

### JOURNEY-DECISION-053

Journey MVP `journey_tickets` does not include role/note.
Ticket order is automatic by ticket time.

### JOURNEY-DECISION-054

For `dateMode = auto`, save computed `start_date` / `end_date`.
When linked tickets change, recalculate `start_date` / `end_date` if `dateMode` is still `auto`.

### JOURNEY-DECISION-055

Zero tickets + auto date is allowed.
Show `No date yet`.
User can switch to manual date.

### JOURNEY-DECISION-056

If `costCurrency` auto-suggestion fails, leave it empty rather than guessing.

### JOURNEY-DECISION-057

Journey MVP does not include attachments / photos.

## 13. TypeScript/Rust model direction

Expected conceptual TypeScript shape:

```ts
type Journey = {
  id: string;
  title: string;
  destination?: string;
  dateMode: "auto" | "manual";
  startDate?: string;
  endDate?: string;
  notes?: string;
  rating?: number;
  mood?: string;
  costAmount?: number;
  costCurrency?: string;
  costExchangeRateToCny?: number;
  lodging?: string;
  companions: JourneyCompanion[];
  ticketIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

Implementation rule for later phases:

- frontend TypeScript and Rust/Tauri Journey models must stay consistent
- the runtime should not introduce a frontend-only Journey shape that diverges from backend storage semantics

## 14. Multi-segment ticket handling

Journey MVP links to tickets, not individual segments.

Rules:

- a linked multi-segment ticket contributes all of its segments to Journey route summary
- a linked multi-segment ticket contributes all of its segments to Journey segment count
- a linked multi-segment ticket contributes all of its segments to a future Journey route map
- partial segment linking is future work
- linked-ticket rows and selectors should use multi-segment route/code summaries

## 15. Delete Journey confirmation dialog

### JOURNEY-DECISION-036

Delete Journey uses a centered, app-themed confirmation modal/dialog.
Do not use browser/system alert/confirm style dialogs.

Dialog copy must say:

- deleting the Journey removes the Journey and links
- it does not delete the original tickets

Related future item:

- `UI-DIALOG-001`
  - Destructive confirm dialogs should use app-themed centered dialogs.
  - This should apply to Delete Journey first, and later can unify existing Delete Ticket style.

## 16. Journeys Summary design

Journeys Summary is a Journey-level travel recap dashboard.
It is not Overview, and it is not Journey Detail.

Its first runtime goal is to answer:

- How many journeys do I have?
- How many unique travel days do I have?
- Which years/months had travel?
- What are my top destinations?
- Who do I travel with most often?
- How much did I spend by currency?
- What are my travel highlights?

### JOURNEY-DECISION-058

The Summary page header and all-time totals direction is:

```text
Journeys [info]

[Summary] [List]

ALL-TIME SUMMARY
4 journeys        27 travel days        Total cost approx. CNY 10,000

```

Rules:

- All-time totals live in an `ALL-TIME SUMMARY` strip below the `Summary / List` tabs.
- Do not place all-time totals as small right-aligned text in the page header.
- The strip should stay compact and text-first.
- Do not use large cards, badges, pills, or heavy bordered boxes for these top metrics.
- Do not add a third explanatory row such as `Total trips / Unique travel days`.
- All-time totals include:
  - total journeys
  - deduped travel days
  - total / comparable CNY cost when enough exchange-rate data exists
- These all-time totals do not change when the Travel calendar year dropdown changes.
- If some non-CNY journeys are missing exchange rates, the cost label can use wording such as `Comparable cost` and show a small missing-rate note.



### JOURNEY-DECISION-059

The top Summary module is a Travel calendar / travel heatmap.

Rules:

- Use a GitHub contribution-style week grid.
- Each square represents one day.
- Horizontal axis is weeks.
- Vertical axis is weekdays.
- Week starts on Monday.
- The calendar occupies a full row.
- The module has a year dropdown on the right.
- Default year is the current year.
- Year dropdown options include the current year and all years covered by Journey dates.
- The year dropdown affects only the Travel calendar module and its local year-specific metrics.
- It does not filter the whole Summary page.

Travel calendar header concept:

- `Travel calendar        4 journeys    27 travel days        Year: 2026`

Rules:

- The `4 journeys / 27 travel days` shown inside the Travel calendar are selected-year statistics.
- The top page totals remain all-time totals.

### JOURNEY-DECISION-060

Travel calendar colors must use fixed month-based tokens, not dynamically generated colors.

Rules:

- Adjacent months must stay visually distinguishable because dates such as Apr 30 and May 1 can be adjacent in the same week grid.
- No-travel days use the light / inactive version of that month color.
- Travel days use the dark / active version of that month color.
- Overlapping journey days can use an even darker shade, a border, shadow, or a small marker.
- Colors should lean khaki, warm, low-saturation, and pastel.
- ColorHunt-style palette direction can inspire the look, but the app must not depend on any external palette site at runtime.
- Both light mode and dark mode need corresponding month color tokens.
- Use theme/color tokens later rather than scattering hardcoded colors across runtime components.

Example semantics:

- Jan inactive = light dusty pink
- Jan active = deeper dusty pink
- Feb inactive = light warm orange
- Feb active = deeper warm orange

### JOURNEY-DECISION-061

Travel calendar supports hover tooltip details for travel days.

For a day with one Journey:

```text
2026-07-09
Japan trip (2026-07-09 ~ 2026-07-23)
first day
```

For a middle travel day:

```text
2026-07-10
Japan trip (2026-07-09 ~ 2026-07-23)
travel day
```

For the last day:

```text
2026-07-23
Japan trip (2026-07-09 ~ 2026-07-23)
last day
```

If `startDate = endDate`, show:

- `single-day trip`

If multiple journeys overlap on one day:

```text
2026-07-09
2 journeys

Japan trip (2026-07-09 ~ 2026-07-23) · first day
Tokyo weekend (2026-07-08 ~ 2026-07-10) · travel day
```

Rules:

- No-travel days may omit tooltip to avoid noise.

### JOURNEY-DECISION-062

Travel days are deduplicated.

Example:

- Journey A = July 1 - July 5
- Journey B = July 4 - July 8
- Travel days count = `8`, not `10`

Rules:

- All-time travel days use one deduped date set across all journeys.
- Selected-year calendar travel days use only dates inside that year.
- Overlapping journeys must not double-count travel days.

### JOURNEY-DECISION-063

The main Summary grid uses a fixed `2 x 2` layout:

- Top left: Travel highlights
- Top right: Top destinations
- Bottom left: Top companions
- Bottom right: Cost by currency

Do not include in the first Summary runtime:

- Transport summary
- Upcoming journeys list
- Recently completed journeys list

### JOURNEY-DECISION-064

Travel highlights first version should include:

- Longest journey
- Busiest month
- Highest recorded cost / most expensive journey
- Most visited destination

Rules:

- Highlights are all-time by default.
- They do not follow the Travel calendar year dropdown.
- Longest journey uses journey duration.
- Busiest month should prefer deduped travel days if practical; journey count is a fallback rule only if needed later.
- Most visited destination should align with Top destinations ranking.
- Highest recorded cost uses the CNY comparison rule documented below.

### JOURNEY-DECISION-065

Top destinations display as a list, not tags.

Sort:

- Primary: journey count descending
- Tiebreaker: known / stay-specific days descending where available

Each row shows:

- destination
- journey count
- known total days when available

Example:

```text
Yulara        3 journeys / 5 days
Sydney        1 journey  / 52 days
Hobart        1 journey  / 19 days
```

Rules:

- Prefer persisted Stays when available.
- If a Journey has no Stays, fall back to legacy `journeys.destination`.
- Do not rank `No destination` as a destination row.
- Journeys without destination / Stays may be tracked separately as a note later, but not as a ranked destination row.
- Unresolved stay days are not included in confirmed destination day totals.
- Top destinations are all-time by default and do not follow the Travel calendar year dropdown.

### JOURNEY-DECISION-066

Top companions use a compact podium-style display.

Concept:

```text
Top companions

          1. Mom
          5 journeys

2. Dad                  3. Ava
3 journeys              2 journeys

4. Lily · 1 journey
5. Xiaowang · 1 journey
```

Rules:

- Show top 5 companions.
- First place is centered and more prominent.
- Second and third are left/right below first.
- Fourth and fifth are smaller list rows.
- If no companions exist, show `No companions recorded yet.`

### JOURNEY-DECISION-067

Cost by currency stays grouped by original currency.

Rules:

- No automatic exchange-rate API.
- No realtime conversion.
- No exchange-rate lookup.

Example:

```text
AUD 1,200
CNY 3,000
JPY 200,000
5 journeys without cost
```

Rules:

- Journeys without cost should be counted and shown as a small note.
- This note is not clickable in MVP.
- Editing cost belongs in Journey Detail / Edit.

### JOURNEY-DECISION-068

Cross-currency cost comparison uses CNY as the fixed comparison base.

Rules:

- Journey storage still keeps original `costAmount` and `costCurrency`.
- For non-CNY journeys, users can optionally enter `costExchangeRateToCny` later.
- Exchange-rate meaning: `1 foreign currency unit = X CNY`
- Example:
  - `1 AUD = 4.8 CNY`
  - `1 JPY = 0.05 CNY`
- Formula:
  - `convertedCostCny = costAmount * costExchangeRateToCny`
- If `costCurrency = CNY`:
  - `convertedCostCny = costAmount`
  - `costExchangeRateToCny` can be empty or `1`
- If a non-CNY journey has no `costExchangeRateToCny`:
  - it can still be saved
  - it still appears in Cost by currency
  - it is excluded from Highest recorded cost / most expensive journey comparison
  - Summary should show a warning:
    - `Some journeys are missing exchange rates and are excluded from cost comparison.`

### JOURNEY-DECISION-069

Summary cross-currency comparison depends on `costExchangeRateToCny`.

Current status:

- `JOURNEY-COST-001` has added optional `costExchangeRateToCny` support to the Journey schema/model/service/Create/Edit form.
- Summary can compare costs in CNY when:
  - `costCurrency = CNY`, or
  - `costCurrency` is non-CNY and `costExchangeRateToCny` is provided.
- Non-CNY journeys without `costExchangeRateToCny` remain valid and still appear in Cost by currency, but they are excluded from comparable CNY cost calculations.

### JOURNEY-DECISION-070

If there are no journeys, Summary uses this empty state:

- `No journey statistics yet`
- `Create journeys from the List tab to unlock travel summaries.`

Rules:

- Top page totals still show `0 journeys` and `0 travel days`.

### JOURNEY-DECISION-071

When the real Summary runtime is implemented, remove old placeholder copy such as:

- `Travel records will live here.`
- `Journey list is now backed by stored data.`
- `Summary still stays lightweight for now.`
- `Archive context.`

### JOURNEY-DECISION-072

Future enhancements, not for this checkpoint:

- selected-year vs all-time Summary scope toggle
- click month/day in calendar to filter
- Journey map
- smarter destination parsing
- companion suggestions
- travel-days vs journey-count toggle
- refined color tokens after final UI art direction is chosen

## 17. Implementation phases

### JOURNEY-DESIGN-002

- Expand Journey MVP design docs.

### JOURNEY-DATA-001

- Add real Journey schema, migration, and model direction.

### JOURNEY-SERVICE-001

- Add Journey CRUD service / Tauri command layer.

### JOURNEY-LIST-001

- Implement real Journey List from stored journeys.
- It may be manually verified together with `JOURNEY-CREATE-001`, but automated tests/build still run when code changes.

### JOURNEY-CREATE-001

- Create Journey manually with metadata and ticket selection.
- Ticket selector search is part of the first Create Journey implementation.

### JOURNEY-DETAIL-001

- Implement Journey detail with trip summary, mini calendar, linked tickets, route summary, companions, and notes.
- Status: Implemented / needs manual verification.
- Scope note: This checkpoint is read-only; Journey edit/delete, map, and summary statistics remain separate future tasks.

### JOURNEY-EDIT-001

- Edit Journey metadata and linked tickets.

### JOURNEY-DELETE-001

- Delete Journey without deleting tickets using centered themed confirmation dialog.

### JOURNEY-COMPANION-001

- Store free-text companions.

### JOURNEY-COMPANION-002

- Suggest previously used companion names later.

### JOURNEY-SUMMARY-DESIGN-001

- Document Journeys Summary layout, Travel calendar behavior, all-time vs selected-year scope, top destinations, companion podium, and cost-comparison rules before runtime UI work begins.

### JOURNEY-COST-001

- Add optional `costExchangeRateToCny` to Journey schema/model/service/Create/Edit form before cross-currency Summary comparison is implemented.
- Status: Implemented.

### JOURNEY-SUMMARY-001

- Implement real Journeys Summary runtime after Summary design is accepted and `JOURNEY-COST-001` is available.
- Status: Implemented.

### JOURNEY-SUMMARY-002

- Polish Summary information hierarchy by moving all-time totals into the `ALL-TIME SUMMARY` strip and clarifying Travel calendar selected-year wording.
- Status: Implemented.

### JOURNEY-SUMMARY-004

- Extract Summary helper logic, add focused tests, and harden date/destination/route/cost calculations.
- Status: Implemented.

### JOURNEY-STOPS-DESIGN-001

- Document the future Journey Stops / Stays model, place-normalization dependency, route-vs-stops distinction, incomplete-stay rules, and implementation order.
- Status: Documented / docs-only.

### JOURNEY-MAP-001

- Add simple Journey route overview / map later.

### JOURNEY-MAP-004

- Future journey-colored map and yearly filtering.

## 18. Journey Stops / Stays design

### JOURNEY-DECISION-073

Current Journey route/destination inference is not enough for long-term Journey meaning.

Reasons:

- raw ticket endpoints are often airports or stations, not the real visited place
- internal transfer cities inside one ticket should not count as destinations
- some trips have missing internal movement tickets, such as `Osaka -> Tokyo` not being recorded
- future Journeys may have fuller `A -> B -> C -> A` chains where stay timing can be inferred partially
- lodging and manual stay edits require their own persistent model

### JOURNEY-DECISION-074

Concept distinction:

- Journey = the whole trip record
- Journey Stop / Stay = one real visited place within that Journey

Rules:

- Stops are place-level travel meaning
- Stops are not raw airport/station transfer endpoints
- A future Journey can contain multiple Stops

### JOURNEY-DECISION-075

Future persistent model direction should include a `journey_stops` table or equivalent model.

Suggested future fields:

```text
id
journeyId
placeName
placeKey
countryCode optional
arrivalDateTime optional
departureDateTime optional
lodging optional
notes optional
source: auto | manual
arrivalTicketId optional
departureTicketId optional
sortOrder
userEdited flag or equivalent
```

Rules:

- This is documentation only for now.
- Do not implement schema/migration/runtime code in this checkpoint.

### JOURNEY-DECISION-076

Auto-derived Stops should come from linked tickets sorted by time.

Ticket contribution rules:

- single-segment ticket contributes `origin -> destination`
- multi-segment ticket contributes `first segment origin -> last segment destination`
- internal transfer endpoints inside one ticket are transfer-only and are not Stops
- adjacent duplicate anchors are collapsed
- route anchors are used to infer future Stops

Example:

Ticket:

- `Changsha -> Xiamen -> Sydney`

Ticket-level route contribution:

- `Changsha -> Sydney`

Stop meaning:

- `Xiamen` is transfer only

### JOURNEY-DECISION-077

Journey route summary and Journey Stops are related but not identical.

Example Journey:

- `Changsha -> Sydney`
- `Sydney -> Melbourne`
- `Melbourne -> Tasmania`
- `Tasmania -> Perth`
- `Perth -> Shanghai -> Tianjin`

Route summary:

- `Changsha -> Sydney -> Melbourne -> Tasmania -> Perth -> Tianjin`

Stops:

- `Sydney`
- `Melbourne`
- `Tasmania`
- `Perth`

Do not count as Stops:

- `Xiamen`, internal transfer
- `Shanghai`, internal transfer
- `Tianjin`, final end/return endpoint in this multi-ticket Journey

Single one-way Journey:

- `Changsha -> Sydney`

Stops:

- `Sydney`

### JOURNEY-DECISION-078

Missing internal movement tickets must remain explicit instead of being guessed away.

Example:

- `Changsha -> Osaka`
- `Tokyo -> Shanghai -> Changsha`

Route anchors:

- `Changsha -> Osaka -> Tokyo -> Changsha`

Stops:

- `Osaka`
- `Tokyo`

But stay timing is incomplete:

- Osaka arrival is known from the first ticket
- Osaka departure is unknown unless the user adds `Osaka -> Tokyo` or fills it manually
- Tokyo arrival is unknown
- Tokyo departure is known from the return-side ticket

Rule:

- The system must not pretend `Osaka` and `Tokyo` each lasted the full Journey.
- Incomplete stay timing should remain incomplete until better source data or manual edits exist.

### JOURNEY-DECISION-079

Future Stop editing must preserve user intent when linked tickets change.

Rules:

- auto-generated Stops can be regenerated when linked tickets change
- user-edited Stops should not be overwritten automatically
- if linked tickets change and Stops may be stale, future UI should show a `Review stops` prompt
- manual Stops can be added, edited, and deleted in a future UI task
- lodging and notes belong at Stop level as well as Journey level when needed

### JOURNEY-DECISION-080

Stops depend on place normalization rather than raw endpoint labels.

Rules:

- airport/station endpoint should normalize to a city/place label
- system language controls preferred display language
- Chinese UI should prefer Chinese place names
- English UI should prefer English place names
- future enhancement can support bilingual labels such as:
  - `Qingdao (青岛)`
  - `悉尼 (Sydney)`

Future dependency tasks:

- `JOURNEY-PLACE-001`
  - Normalize station/airport endpoints into Journey-level place labels.

- `TRAIN-STATION-GEO-001`
  - Add city/place metadata and coordinates for train/rail stations.

### JOURNEY-DECISION-081

Top destinations should eventually aggregate Journey Stops, not raw route endpoints.

Ranking rules:

- primary ranking = number of Journeys containing that Stop
- the same Journey counts a place at most once
- tiebreak can later use known stay days if available

Future days-based summary rules:

- support destination stay-days summary later
- use Stop arrival/departure dates when available
- one Journey date should not be double-counted across multiple destinations
- if stay dates are incomplete, mark days as unknown or exclude them from days-based ranking
- do not guess stay days from incomplete route data

### JOURNEY-DECISION-082

Route summary and Stops must stay distinct concepts.

Rules:

- Route summary shows the main movement path and keeps the final endpoint
- Stops show visited/stayed places and may exclude the final return/end endpoint
- Ticket Detail should still show real raw segments and transfer points
- Journey Detail / Journey Summary should move toward place-level Stop display later

### JOURNEY-DECISION-083

Recommended future implementation order:

1. `JOURNEY-STOPS-DESIGN-001`
2. `JOURNEY-PLACE-001`
3. `TRAIN-STATION-GEO-001` if rail place metadata is needed for normalization/map support
4. `JOURNEY-STOPS-DATA-001`
5. `JOURNEY-STOPS-AUTO-001`
6. `JOURNEY-STOPS-UI-001`
7. `JOURNEY-SUMMARY-STOPS-001`

## 19. Journey Stay Blocks design checkpoint

### JOURNEY-DECISION-084

Destination summary is no longer the intended long-term primary Create/Edit Journey input.

Rules:

- Future Create/Edit Journey should focus on structured `Stays`, not a single destination summary text field.
- `journeys.destination` remains a legacy/display fallback for old journeys or journeys without Stays.
- Journey List and Journey Detail destination display should eventually prefer a value derived from Stays.
- If no Stays exist, fall back to `journeys.destination`.

### JOURNEY-DECISION-085

UI language direction for the Stays model remains conservative in v1.

Rules:

- Keep the current v1 UI English-first.
- Do not start Chinese UI localization in this design checkpoint.
- Place names should come from the existing Place Catalog / transport-place mapping when available.
- Do not introduce ad-hoc manual translations for place labels.
- User-entered ticket text and user-entered place text must not be automatically translated.

### JOURNEY-DECISION-086

`Stays` becomes the user-facing structured destination model for Journeys.

Naming rules:

- Product/UI language should prefer `Stays`.
- Existing implementation/task naming can continue to use `journey_stops` for now.
- A Stay row represents a visited place inside a Journey.
- A Stay row is not a raw airport/station endpoint.
- Raw ticket endpoints remain unchanged and still belong to Ticket Detail and route fidelity.

### JOURNEY-DECISION-087

Future Create/Edit Journey should use a lightweight Stays editor concept.

Target layout concept:

```text
Stays

Suggested from tickets
[ Osaka ] [ Tokyo ] [ Narita ] [ Xiamen ]

Stays                                         [ + Add stay ]
Place                  Departure
[drag] [ Osaka       ] [ 2026-06-04 ] [-]
[drag] [ Tokyo       ] [ Unknown    ] [-]
```

Rules:

- `Suggested from tickets` shows place tags only.
- Clicking a suggestion tag adds that place to the Stays table.
- If the suggestion has a known departure date, prefill it.
- If no departure date is known, use `Unknown`.
- Users can add stays manually.
- Users can delete stays.
- Future delete control should be a compact red circular minus-style control.
- A compact drag handle may be used for sortable unknown rows.

### JOURNEY-DECISION-088

Auto-derived stay adoption should stay conservative.

Rules:

- Confirmed single-place destination stays may be auto-added to the Stays table.
- Internal transfer points, low-confidence places, and optional places should appear as suggestion tags only.
- Transfer places must not automatically become Stays.
- If the user clicks a transfer tag, it becomes a user-selected/manual Stay.

### JOURNEY-DECISION-089

Multi-segment transfer places remain transfer-only by default.

Example:

- `Changsha -> Xiamen -> Sydney`

Rules:

- The ticket-level destination/stay contribution remains `Changsha -> Sydney`.
- `Xiamen` is an internal transfer by default.
- `Xiamen` may still appear as a suggested tag, especially when a Journey contains only one multi-segment ticket.
- `Xiamen` should not be auto-added to Stays unless the user explicitly chooses it.

### JOURNEY-DECISION-090

The future lightweight Stay row should keep a small field set.

Primary row fields:

- `place`
- `departure date` or `Unknown`
- `order`

Rules:

- Do not introduce `durationDays` in this design checkpoint.
- Stay days should later be derived from arrival/departure where possible.

Arrival inference rules:

- First Stay arrival uses the first linked ticket arrival time when available.
- If no linked ticket arrival exists, use Journey start date.
- If neither exists, arrival is unknown.
- Later Stay arrival comes from the previous Stay row's departure date.

### JOURNEY-DECISION-091

Stay-day calculation uses inclusive calendar days.

Rules:

- Same-day arrival and departure counts as `1` day.
- Example: arrival `2026-06-01`, departure `2026-06-04` = `4 days`.
- Do not add night-count support now.
- Future lodging/night calculations can be a separate task.

### JOURNEY-DECISION-092

Unknown departure rows should follow mixed automatic/manual ordering rules.

Rules:

- Unknown departure rows default to the end when first added, unless inserted from a ticket suggestion with a known order.
- Users can drag Unknown rows to choose their position.
- Known departure rows should sort by departure date automatically.
- If a user changes a known departure date, the Stays table should auto-reorder by date.
- Known departure rows do not need manual drag sorting.
- Unknown rows keep their user-chosen relative position.

### JOURNEY-DECISION-093

Consecutive Unknown departure rows should stay separate in normal display but group in statistics/day calculations.

Example rows:

- `B depart 2026-06-04`
- `C depart Unknown`
- `D depart 2026-06-06`

Rules:

- Normal Journey Detail/List display keeps `B`, `C`, and `D` as separate rows.
- Statistics/day calculations should group the consecutive Unknown block with the next known departure row.
- In the example above, statistics should treat `C + D` as one unresolved grouped block covering `2026-06-04` through `2026-06-06`.
- Do not split the full grouped block days between `C` and `D`.
- `C + D` is a statistics/grouping result only, not a persisted merged row.

### JOURNEY-DECISION-094

Auto-generation should add visited destinations, not the Journey origin by default.

Rules:

- `Changsha -> Osaka -> Changsha` should auto-add `Osaka` only.
- `Changsha -> Osaka -> Tokyo` may auto-add `Osaka` and `Tokyo`.
- Users may still manually add the origin if they want to record it as a Stay.

### JOURNEY-DECISION-095

Journey List and Journey Detail destination display should eventually derive from ordered Stays.

Rules:

- Preferred display should list Stays in order, for example `Osaka · Nara · Tokyo`.
- If too long, truncate after the first few places, for example `Osaka · Nara · Tokyo · ...`.
- Normal display must stay separate from grouped statistics display.
- Grouped labels such as `Nara + Tokyo` belong only to statistics/day calculations.
- If no Stays are available, fall back to `journeys.destination`.
- A future rail-aware grouping layer may roll more specific reviewed places up to city-level or prefecture-level reporting identities without rewriting the underlying reviewed map place.
- `JOURNEY-PLACE-GROUPING-001A` adds the reviewed/generated grouping data layer only; it does not change Journey List, Journey Detail, or RouteMap behavior.
- `JOURNEY-PLACE-GROUPING-001B` now uses that grouping map in Summary Top destinations only when persisted Stays/Stops are available, and manual verification passed for the accepted `Danyang -> Zhenjiang` grouping example.

### JOURNEY-DECISION-096

Future Summary / Top destinations should aggregate from Stays instead of raw route anchors or legacy destination text.

Rules:

- `JOURNEY-SUMMARY-STOPS-001` has migrated destination aggregation onto Stays when they are available.
- Confirmed single-place Stays can count normally.
- Unresolved grouped stays are not shown as individual list rows in Top destinations.
- When unresolved grouped stay days exist, Top destinations should show a compact note such as `Unresolved stays total 15 days not included.`
- Do not assign the full grouped days to each individual place inside an unresolved block.
- Direct-admin municipalities should group to the municipality itself.
- Prefecture-level cities, autonomous prefectures, leagues, and equivalent regional units are the preferred future reporting level for cleaner Journey/Summary destination statistics.
- That grouping layer should stay separate from reviewed map fallback places so rail map accuracy does not have to collapse to the same coarser identity.
- `JOURNEY-PLACE-GROUPING-001B` currently applies grouping in Summary Top destinations only; Journey List and Journey Detail labels still keep their existing specific-place behavior.

### JOURNEY-DECISION-097

Route summary and Stays must remain separate concepts even after Stays become the main destination model.

Rules:

- Route summary keeps the movement chain.
- Stays represent visited places.
- `JOURNEY-ROUTE-001` remains transitional movement logic and should not become the Stays model.
- `JOURNEY-DESTINATION-001` is transitional and should later yield to Stays-based destination display/aggregation.

### JOURNEY-DECISION-098

Recommended follow-up tasks after this design checkpoint:

1. `JOURNEY-STAYS-EDIT-001`
2. `JOURNEY-STOPS-UI-001`
3. `JOURNEY-SUMMARY-STOPS-001`
4. `JOURNEY-STAY-DETAILS-001`

Task notes:

- `JOURNEY-STAYS-EDIT-001` = implemented. This checkpoint delivered the lightweight Create/Edit Journey Stays editor with suggested tags, Place/Departure rows, add/delete controls, and limited ordering.
- `JOURNEY-STOPS-UI-001` = the broader future review/edit UI if it is still needed beyond the lightweight Stays editor, or an umbrella/superseding task that absorbs the wider stale-stop review flow.
- `JOURNEY-SUMMARY-STOPS-001` = implemented. Summary Top destinations now prefer persisted Stays and keep a compact unresolved-days note instead of unresolved list rows.
- `JOURNEY-STAY-DETAILS-001` = the later enhancement for per-stay lodging, per-stay notes, and review prompts when linked tickets change after user-edited stays exist.

## 20. Acceptance criteria

This docs-only task is complete when:

- `docs/JOURNEY_DESIGN.md` defines Journey MVP scope
- all confirmed Journey decisions are recorded
- Create / Edit / Delete / List / Detail flows are documented
- Journey Summary design direction is documented
- data model proposal is documented
- many-to-many ticket relationship is documented
- companion MVP is documented
- multi-segment ticket handling is documented
- destination and currency auto-suggestion rules are documented
- implementation phases are broken into small tasks
- `docs/ISSUE_CHECKLIST.md` is updated
- `docs/TASKS.md` is updated
- no runtime code changed
- no commits are made as part of this task
- no pushes are made as part of this task
