# ISSUE_CHECKLIST

## 1. Completed / Verified

- `SETUP-001`: `AGENTS.md` project rules created
- `DOC-001`: `PROJECT_STATUS.md` created
- `DOC-002`: `TASKS.md` created
- `DOC-003`: `TEST_PLAN.md` created
- `BL-003`: blank workspace after adding ticket fixed and manually verified
- `NAV-001`: sidebar is sticky/persistently visible
- `NAV-002`: sidebar buttons switch local sections
- `NAV-003`: switching sidebar sections scrolls the main workspace/content area back to the top and was manually verified
- `ARCH-001`: initial `HomePage` and `TicketsPage` wrappers extracted and manually verified

## 2. Implemented / Needs Checkpoint

- `ARCH-001`: page wrapper extraction has been manually verified and should be committed as a checkpoint if not already committed

## 3. Open UX / Product Issues

- `UX-001`
  - The large top summary/hero block appears on multiple pages, but it should mainly belong to Overview.
  - Status: `Open`
  - Priority: `High`

- `UX-002`
  - Overview is too long and requires scrolling to see all important content.
  - It should become a clearer dashboard with sub-section buttons/cards.
  - Status: `Open`
  - Priority: `High`

- `UX-003`
  - Overview, Tickets, and Exports each show a Preview sub-panel, but its meaning is unclear and the structure feels messy.
  - The Preview concept should appear only once or be renamed/restructured.
  - Status: `Open`
  - Priority: `High`

- `UX-004`
  - Journeys page only shows information for the currently selected ticket.
  - Selecting a ticket requires going to Tickets and scrolling down past add/import areas to find the list.
  - This user flow is unreasonable and needs redesign.
  - Status: `Open`
  - Priority: `High`

- `UX-005`
  - Tickets page ordering is not ideal because users need easier access to the ticket list, search, and add/edit actions.
  - Status: `Open`
  - Priority: `High`

- `OCR-001`
  - OCR should be part of the Add Ticket flow, not a permanent main-page section.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-001`
  - Date/time picker has no clear confirm/apply button.
  - Status: `Open`
  - Priority: `Medium`

- `FORM-002`
  - Default travel class should be Economy / `经济舱`.
  - Status: `Open`
  - Priority: `Low`

- `DATA-001`
  - Chinese airport data is incomplete, including missing `CSX` and `XMN`.
  - Status: `Open`
  - Priority: `Medium`

- `DATA-002`
  - High-speed rail / train station data is almost completely missing.
  - Status: `Open`
  - Priority: `Medium`

- `MAP-001`
  - Map marker points do not visually align well with route line endpoints.
  - Status: `Open`
  - Priority: `Medium`

- `MAP-002`
  - Overview map should avoid large markers for every route and prefer endpoint dots plus route lines.
  - Status: `Open`
  - Priority: `Medium`

- `STATUS-001`
  - Current statuses `saved` / `used` / `archived` are unclear.
  - Consider `Upcoming` / `Completed` / `Cancelled`, with Archived as a separate action.
  - Status: `Needs decision`
  - Priority: `Medium`

## 4. Recommended Next Fix Order

1. Commit verified page wrapper extraction checkpoint.
2. Fix `NAV-003` scroll-to-top on sidebar section change.
3. Remove repeated top summary from non-overview pages.
4. Clean Tickets page order so list/search/add flow is easier.
5. Redesign Journeys selection flow.
6. Then handle OCR/form/map/data/status changes in later phases.
