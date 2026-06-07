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

## 2. Current status

Current repo inspection shows:

- `JourneysPage` scaffold already exists.
- `Summary` and `List` subviews already exist as placeholders inside the scaffold.
- The current scaffold is manually verified as a safe placeholder and no longer duplicates Tickets single-ticket detail.
- Real Journey data model is not implemented yet.
- Real Journey create, edit, delete, and detail behavior is not implemented yet.
- Real Journey Summary statistics are not implemented yet.
- Journey map coloring and yearly filtering remain future work.

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

### JOURNEY-DECISION-058

Journeys Summary needs year/month filter.
Default:

- `All years`
- `All months`

Stats update with filters.

### JOURNEY-DECISION-059

Journey status:

- `endDate < today -> Completed`
- `startDate > today -> Upcoming`
- `startDate <= today <= endDate -> Ongoing`
- `No date -> Unscheduled`

### JOURNEY-DECISION-060

Summary should show Ongoing journeys.

### JOURNEY-DECISION-061

Top destinations MVP can count by destination text.
Future can add smarter place splitting.

### JOURNEY-DECISION-062

Summary needs transport summary:

- flight / rail / train ticket count
- total ticket count
- total segment count

### JOURNEY-DECISION-063

Summary can show total cost grouped by currency.
No exchange-rate conversion.

### JOURNEY-DECISION-064

Summary can include a simple bar chart, but the Summary layout must be designed before runtime UI changes.

### Recommended Summary sections

Filter row:

- year
- month

Top metrics:

- total journeys
- travel days
- upcoming
- ongoing
- completed
- unscheduled

Main content:

- recent / upcoming journeys
- top destinations

Stats:

- transport summary
- cost by currency
- companion summary

Optional visual:

- simple bar chart after layout design

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

### JOURNEY-SUMMARY-001

- Implement real Journeys Summary after CRUD is stable.

### JOURNEY-MAP-001

- Add simple Journey route overview / map later.

### JOURNEY-MAP-004

- Future journey-colored map and yearly filtering.

## 18. Acceptance criteria

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
