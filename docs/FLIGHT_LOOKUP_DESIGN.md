# FLIGHT_LOOKUP_DESIGN

## 1. Scope

This document defines the planned architecture for real flight-data provider integration after the current Phase 1 mock scaffold.

It does **not** approve or implement any live provider yet.

Current status:

- Phase 1 mock scaffold already exists in:
  - [C:\yx\00app\ticket\src\lib\flightLookup.ts](C:/yx/00app/ticket/src/lib/flightLookup.ts)
- Add/Edit flight forms already support:
  - flight number input
  - lookup date input
  - optional lookup action
  - manual candidate apply

This design is for the next safe integration phases only.

The concrete Tauri-side request/response/error proposal now lives in:

- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_TAURI_CONTRACT.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_TAURI_CONTRACT.md)

## 2. Product Behavior

The real-provider flow should preserve the current user-facing behavior:

1. Manual ticket entry remains fully supported.
2. Flight API lookup is optional, not required.
3. The user enters:
   - flight number
   - date
4. The user clicks `Lookup flight`.
5. The provider returns zero or more candidate flights.
6. The UI shows normalized candidates.
7. The user manually applies one candidate.
8. Existing form fields must not be overwritten silently.

Required UX rules:

- no auto-apply
- no silent overwrite
- no blocking if lookup fails
- no dependency on lookup for saving a ticket
- no hidden provider-specific fields leaking into the form

## 3. Frontend Abstraction

The frontend-facing abstraction should remain:

- [C:\yx\00app\ticket\src\lib\flightLookup.ts](C:/yx/00app/ticket/src/lib/flightLookup.ts)

That file should continue to expose a normalized API such as:

- `lookupFlightCandidates(request)`
- `FlightLookupRequest`
- `FlightLookupCandidate`

`TicketForm` should only depend on the normalized result shape, not on any provider-specific response format.

## 4. Normalized Candidate Shape

The common candidate shape should stay conceptually close to the current scaffold:

- `id`
- `providerLabel`
- `sourceNote`
- `carrierName`
- `code`
- `departure`
  - `name`
  - `code`
  - `timezone`
- `arrival`
  - `name`
  - `code`
  - `timezone`
- `departureTerminal?`
- `arrivalTerminal?`
- `departureTimeLocal`
- `arrivalTimeLocal`

Future optional normalized fields may be added later if a clear user need appears, for example:

- `gate`
- `aircraftType`
- `flightStatus`
- `baggageClaim`
- `codeshareInfo`

Those should only be added after:

- provider review
- UI need confirmation
- stable mapping rules

## 5. Provider Adapter Model

Real providers should live behind adapters rather than being wired directly into `TicketForm`.

Recommended structure:

- `src/lib/flightLookup.ts`
  - frontend-facing lookup entrypoint
  - candidate normalization boundary
- future adapter files, for example:
  - `src/lib/flightLookupProviders/aerodatabox.ts`
  - `src/lib/flightLookupProviders/amadeus.ts`
  - `src/lib/flightLookupProviders/aviationstack.ts`
  - `src/lib/flightLookupProviders/flightaware.ts`

Each adapter should:

1. accept a normalized request
2. call a secure backend boundary later
3. parse provider-specific response fields
4. normalize them into `FlightLookupCandidate[]`
5. return only normalized output to the UI

`TicketForm` should never need to know:

- provider response JSON shape
- provider auth scheme
- provider rate-limit details
- provider-specific error codes

## 6. API Key Security Boundary

This is the most important architecture rule for the real integration phase:

- API keys must not be hardcoded in frontend code.
- API keys must not be exposed in bundled JavaScript.
- Real provider requests should not be made directly from the React layer when they require secret credentials.

Recommended future boundary:

1. frontend calls a local Tauri command
2. Tauri command reads provider configuration from a safer desktop-side boundary
3. Tauri command calls the selected external provider
4. Tauri command returns normalized candidate data to the frontend

This means the likely future path is:

- React `TicketForm`
  -> `src/lib/flightLookup.ts`
  -> Tauri `invoke(...)`
  -> Rust command
  -> provider adapter / HTTP client
  -> normalized candidate payload

This phase does **not** implement:

- real secret storage
- credential encryption
- environment-specific key loading
- provider HTTP calls

But the design assumes those will be handled outside the frontend bundle.

## 7. Settings Boundary

The current placeholder in Settings is acceptable for Phase 1 only.

Later Settings work may support:

- provider selection
- non-secret provider metadata
- API-key entry or reference
- provider enable/disable state
- last sync / last lookup diagnostics

However, this design does **not** approve storing a raw provider key in frontend-only state such as:

- React component state
- localStorage as the final security model
- bundled config files

If Settings later offers API-key input, it should still route through a safer desktop-side persistence model.

## 8. Candidate Providers To Review Later

No real provider is selected in this document.

Candidates to review later:

- AeroDataBox
- Amadeus Flight Status
- Aviationstack
- FlightAware AeroAPI
- other suitable providers if they meet coverage and licensing requirements

For each future provider review, check:

- pricing / free tier
- request limits
- date range coverage
- schedule support vs. real-time status support
- terminal / gate availability
- airport / timezone field quality
- license / terms of use
- redistribution or caching restrictions
- backend/API-key storage requirements

## 9. OpenSky Note

OpenSky should not be treated as the primary source for this ticket autofill feature.

Reason:

- it is more aligned with aircraft state / ADS-B style data
- it is not primarily a commercial schedule / terminal / gate source
- it is weaker for direct ticket-entry autofill by flight number + date

OpenSky may still be useful later for:

- aircraft movement experiments
- map overlays
- research-style operational data checks

But not as the main source for current ticket auto-fill.

## 10. Proposed Future Phases

### Phase 1

- mock scaffold
- manual candidate apply
- no real provider

Status:

- already implemented

### Phase 2

- provider selection
- terms / pricing / quota review
- field-coverage comparison

### Phase 3

- secure local backend / Tauri command design
- request/response contract definition
- normalized error model

### Phase 4

- Settings provider/API-key configuration
- desktop-side persistence approach
- validation rules

### Phase 5

- real provider adapter implementation
- normalized candidate mapping
- frontend wiring stays unchanged or nearly unchanged

### Phase 6

- better fallback / no-results / error messaging
- retry rules
- provider diagnostics
- optional multiple-provider failover if needed

## 11. Proposed Future Tauri Command Direction

This is a proposal only, not an implementation.

Possible future command shapes:

- `lookup_flight_candidates(request)`
- `get_flight_lookup_settings()`
- `save_flight_lookup_settings(payload)`

Possible request shape:

- `flight_number`
- `departure_date`

Possible response shape:

- normalized `FlightLookupCandidate[]`
- non-secret provider label
- optional warning / rate-limit / no-result metadata

## 12. Non-Goals For This Design

This document does not approve or implement:

- direct frontend API-key usage
- live provider HTTP calls
- schema changes
- form redesign
- automatic field overwrite
- map changes
- OCR extraction changes
- language-switching work

## 13. Recommended Next Step

The next safe step after this design is:

1. provider comparison and terms review
2. choose one provider for a first secure desktop integration
3. define the Tauri command contract before any live HTTP call is added

Related review document:

- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_PROVIDER_REVIEW.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_PROVIDER_REVIEW.md)
