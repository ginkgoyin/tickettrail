# FLIGHT_LOOKUP_TAURI_CONTRACT

## 1. Scope

This document defines the first proposed Tauri command contract for future real-provider flight lookup.

It is intentionally **docs-only**.

It does **not**:

- call AeroDataBox or any other real provider
- store any API key
- change frontend runtime behavior

Current implementation status:

- Phase A mock Tauri command boundary is now implemented.
- It returns local mock candidates only.
- It does **not** call a live provider.
- Local provider configuration commands are now scaffolded for Settings:
  - `get_flight_data_source_config`
  - `save_flight_data_source_config`
- Those config commands do **not** mean real provider integration is complete.

Current provider recommendation remains:

- AeroDataBox first
- Amadeus as the main runner-up

Reference docs:

- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_DESIGN.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_DESIGN.md)
- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_PROVIDER_REVIEW.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_PROVIDER_REVIEW.md)

## 2. Proposed Frontend Request Shape

The frontend should continue using a provider-agnostic lookup request and send it to a future Tauri command.

Proposed request shape:

```ts
type FlightLookupProvider = "aerodatabox" | "amadeus";

type FlightLookupTauriRequest = {
  flightNumber: string;
  date: string;
  provider: FlightLookupProvider;
  locale?: string;
  departureAirportHint?: string;
  arrivalAirportHint?: string;
  countryHint?: string;
};
```

Field notes:

- `flightNumber`
  - Required.
  - User-entered airline flight number such as `QF127` or `MF802`.
- `date`
  - Required.
  - Lookup date in `YYYY-MM-DD`.
- `provider`
  - Required.
  - Starts with `aerodatabox` in the first real-provider prototype.
- `locale`
  - Optional.
  - Reserved for future provider-side localization or formatting hints.
- `departureAirportHint`
  - Optional.
  - Reserved for future disambiguation if multiple results are returned.
- `arrivalAirportHint`
  - Optional.
  - Reserved for future disambiguation if multiple results are returned.
- `countryHint`
  - Optional.
  - Reserved for future narrowing when the provider supports broader flight-number matches.

## 3. Proposed Tauri Command

The first backend boundary should be a single lookup command:

- `lookup_flight_candidates(request)`

Suggested Rust-facing concept:

```rust
lookup_flight_candidates(request: FlightLookupTauriRequest) -> Result<Vec<FlightLookupCandidatePayload>, FlightLookupErrorPayload>
```

This command should:

1. accept only normalized lookup input from the frontend
2. read provider configuration later from a desktop-side boundary
3. call a provider adapter later
4. return normalized candidates or a structured error

This command should **not** expose:

- raw provider credentials
- provider-specific HTTP details
- provider-specific JSON payloads

## 4. Normalized Response Shape

The response should align with the existing frontend `FlightLookupCandidate` concept while leaving room for future enrichment.

Proposed normalized candidate payload:

```ts
type FlightLookupCandidatePayload = {
  id: string;
  provider: string;
  providerLabel: string;
  sourceNote?: string;
  carrierName: string;
  code: string;
  departure: {
    name: string;
    code: string;
    timezone?: string;
    terminal?: string;
    timeLocal?: string;
  };
  arrival: {
    name: string;
    code: string;
    timezone?: string;
    terminal?: string;
    timeLocal?: string;
  };
  aircraft?: string;
  flightStatus?: string;
  confidence?: string;
};
```

Normalization expectations:

- `provider`
  - Stable internal provider id such as `aerodatabox`.
- `providerLabel`
  - User-facing provider label such as `AeroDataBox`.
- `sourceNote`
  - Optional explanation like `Scheduled data`, `Historical result`, or `Provider returned multiple matches`.
- `carrierName`
  - Normalized operating carrier / airline label.
- `code`
  - Flight number in a UI-ready form such as `QF127`.
- `departure.name`
  - Departure airport display name.
- `departure.code`
  - IATA or equivalent airport code if available.
- `departure.terminal`
  - Optional terminal value.
- `departure.timeLocal`
  - Optional local departure time string.
- `departure.timezone`
  - Optional departure timezone id or label.
- `arrival.*`
  - Same shape as departure.
- `aircraft`
  - Optional aircraft type or family if the provider exposes it clearly.
- `flightStatus`
  - Optional normalized status label.
- `confidence`
  - Optional note describing certainty or match quality when multiple results exist.

## 5. Error Shape

The frontend should receive a structured error payload instead of raw provider failures.

Proposed error payload:

```ts
type FlightLookupErrorPayload = {
  code:
    | "missing_provider_configuration"
    | "missing_api_key"
    | "provider_unauthorized"
    | "rate_limited"
    | "no_results"
    | "network_error"
    | "provider_response_parse_error"
    | "unsupported_provider";
  message: string;
  provider?: string;
  retryable: boolean;
  details?: string;
};
```

Expected meanings:

- `missing_provider_configuration`
  - Provider is selected but not configured locally.
- `missing_api_key`
  - Provider requires a credential and none is available.
- `provider_unauthorized`
  - Credential exists but the provider rejected it.
- `rate_limited`
  - Provider quota or burst limit was exceeded.
- `no_results`
  - Request completed but no candidate flights matched.
- `network_error`
  - Request could not be completed due to connectivity failure or timeout.
- `provider_response_parse_error`
  - Provider returned data but it could not be safely normalized.
- `unsupported_provider`
  - Frontend requested a provider that the backend does not support.

## 6. Secret Boundary

The secret boundary should remain strict:

- Frontend sends only the normalized lookup request.
- Frontend must not receive or store a raw provider API key for live use.
- Tauri/backend should read provider configuration later from a safer desktop-side boundary.
- Any temporary localStorage-based MVP setting is **not** the final secure secret-storage design.

This means:

- `TicketForm` stays provider-agnostic
- `src/lib/flightLookup.ts` stays frontend-facing and normalized
- real credentials stay outside the frontend bundle

## 7. Provider Adapter Boundary

The future AeroDataBox adapter should live behind the Tauri command boundary and map provider-specific fields into the normalized candidate shape.

The adapter layer should be responsible for:

- constructing provider-specific request URLs later
- handling auth headers later
- parsing provider-specific response JSON later
- selecting the best candidate rows later
- translating provider-specific status/terminal/time fields into the normalized shape

`TicketForm` should never depend on:

- AeroDataBox response keys
- AeroDataBox endpoint paths
- AeroDataBox auth format

## 8. Future Implementation Phases

Recommended phases:

- Phase A
  - Add a Tauri command stub that returns mock lookup candidates through the backend boundary.
  - Status: implemented in the current phase.
- Phase B
  - Design local provider selection and API key configuration in Settings.
- Phase C
  - Add an AeroDataBox adapter using a user-provided key.
- Phase D
  - Add structured error handling and a provider test-connection flow.
- Phase E
  - Evaluate optional second providers such as Amadeus after the first provider is stable.

## 9. First Endpoint To Validate Later

If AeroDataBox remains the chosen first provider, the first endpoint validation pass should start with the flight-number-and-date lookup path documented in the provider review, using the current official docs at implementation time.

This validation pass should confirm:

- exact endpoint path
- required auth format
- request date format
- airport code fields
- terminal fields
- local-time fields
- timezone fields
- historical vs. future availability

That endpoint validation is a **future task** and is not implemented here.

## 10. Explicit Status Note

No real provider has been integrated yet.

This document only defines the proposed request/response/error contract and the backend integration boundary for a future AeroDataBox-first prototype.
