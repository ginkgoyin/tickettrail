# FLIGHT_LOOKUP_AERODATABOX_SCHEMA

## 1. Scope

This document validates the current AeroDataBox endpoint and schema details needed before implementing the real flight lookup adapter.

It does **not**:

- enable live AeroDataBox lookup in the app
- change `TicketForm` behavior
- store or expose any real API key
- claim that the provider integration is complete

Current status:

- backend provider adapter skeleton exists
- desktop-side provider config and local secret storage exist
- live AeroDataBox calls are now implemented behind the existing Tauri/backend boundary
- live validation still depends on a user manually testing with their own saved key

Related docs:

- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_TAURI_CONTRACT.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_TAURI_CONTRACT.md)
- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_PROVIDER_REVIEW.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_PROVIDER_REVIEW.md)
- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_DESIGN.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_DESIGN.md)

## 2. Official Endpoint Reviewed

Primary endpoint validated from the current official OpenAPI spec:

- `GET /flights/{searchBy}/{searchParam}/{dateLocal}`

Nearest-date variant also exists:

- `GET /flights/{searchBy}/{searchParam}`

Related schedule/history endpoints also exist:

- `GET /flights/{searchBy}/{searchParam}/{dateFromLocal}/{dateToLocal}`
- `GET /flights/{searchBy}/{searchParam}/dates`
- `GET /flights/{searchBy}/{searchParam}/dates/{fromLocal}/{toLocal}`

For the app's first real adapter pass, the correct first endpoint remains:

- `GET /flights/number/{flightNumber}/{dateLocal}`

because it matches the existing `flight number + date` lookup UX most directly.

## 3. Request Validation Summary

### Method

- `GET`

### Path

- `/flights/{searchBy}/{searchParam}/{dateLocal}`

### Base URL

API.Market gateway from the official OpenAPI spec:

- `https://prod.api.market/api/v1/aedbx/aerodatabox`

RapidAPI gateway from the official OpenAPI spec:

- `https://aerodatabox.p.rapidapi.com/`

### Path parameters

- `searchBy`
  - validated enum supports flight lookup by:
    - `number`
    - `callsign`
    - `reg`
    - `icao24`
- `searchParam`
  - for this app we should use:
    - `searchBy = number`
    - `searchParam = JQ661` style flight number
  - official docs say this value accepts:
    - with or without spaces
    - IATA or ICAO style
    - any case format
    - examples include `KL1395` and `Klm 1395`
- `dateLocal`
  - local date of departure or arrival
  - format:
    - `YYYY-MM-DD`

### Query parameters relevant to MVP adapter

- `dateLocalRole`
  - optional
  - values:
    - `Both`
    - `Departure`
    - `Arrival`
  - official docs recommend `Both` as default / best results
- `withAircraftImage`
  - optional
  - default `false`
- `withLocation`
  - optional
  - default `false`
- `withFlightPlan`
  - optional
  - default `false`
  - not needed for the first ticket autofill adapter

### Flight number format conclusion

Confirmed:

- the first adapter should send the flight number in one piece like `JQ661`
- no carrier/number split is required by the endpoint

## 4. Auth Validation Summary

### API.Market

Confirmed from the current OpenAPI spec:

- auth type: API key
- header name:
  - `x-magicapi-key`

### RapidAPI

Confirmed from the current OpenAPI spec:

- header name:
  - `X-RapidAPI-Key`
- additional required header:
  - `X-RapidAPI-Host: aerodatabox.p.rapidapi.com`

### Current app integration decision

The current repository should continue assuming a desktop-side provider key boundary only.

The frontend must not receive the raw key.

## 5. Response Status Validation

Confirmed in the official OpenAPI spec for the flight status endpoints:

- `200 OK`
- `204 No Content`
- `400 Bad Request`
- `401 Unauthorized`
- `451 Unavailable For Legal Reasons`
- `500 Internal Server Error`
- `503 Service Unavailable`

Not explicitly listed in the current OpenAPI spec for this endpoint:

- `429 Too Many Requests`

Rate limiting is documented on the pricing page, but `429` is not explicitly modeled in the current published spec. Treat live rate-limit handling as a needs-validation case.

## 6. Coverage / Pricing Validation Summary

From the official site and pricing page:

- real-time flight status: available
- future schedules: available
- historical flight data: available
- future schedule range depends on pricing plan
- historical range depends on pricing plan
- lower plans include rate limiting such as:
  - `1 request / second`
  - some RapidAPI plans also mention `1000 requests / hour`

Relevant current pricing-page notes:

- future flight availability can be up to `180`, `210`, or `365` days depending on plan
- historical flight availability can be up to `180`, `210`, or `365` days depending on plan
- `Flight History & Schedule` range per request is limited by plan

## 7. Request Examples

These examples are intentionally redacted and contain **no real API key**.

### API.Market example

```http
GET https://prod.api.market/api/v1/aedbx/aerodatabox/flights/number/JQ661/2026-06-05?dateLocalRole=Both
x-magicapi-key: REDACTED
Accept: application/json
```

### RapidAPI example

```http
GET https://aerodatabox.p.rapidapi.com/flights/number/JQ661/2026-06-05?dateLocalRole=Both
X-RapidAPI-Key: REDACTED
X-RapidAPI-Host: aerodatabox.p.rapidapi.com
Accept: application/json
```

## 8. Normalized Field Mapping

The tables below describe how AeroDataBox fields appear to map into the app's normalized candidate shape.

Status legend:

- `confirmed`
- `likely`
- `unavailable`
- `needs live validation`

| Normalized field | AeroDataBox field / source | Status | Notes |
| --- | --- | --- | --- |
| `provider` | static adapter value `aerodatabox` | confirmed | internal adapter value |
| `providerLabel` | static adapter label `AeroDataBox` | confirmed | UI label, not provider payload |
| `sourceNote` | adapter-generated note | confirmed | should describe schedule/live quality |
| `carrierName` | `flight.airline.name` | confirmed | `FlightAirlineContract.name` exists |
| `code` | `flight.number` | confirmed | `FlightContract.number` exists |
| `departure.name` | `departure.airport.name` | confirmed | `ListingAirportContract.name` exists |
| `departure.code` | `departure.airport.iata` | confirmed | IATA field exists, but may be nullable |
| `departure.terminal` | `departure.terminal` | confirmed | field exists in `FlightAirportMovementContract` |
| `departure.timeLocal` | `departure.scheduledTime.local` or `departure.revisedTime.local` | confirmed | adapter should normalize provider-local timestamps to a `datetime-local` compatible value such as `2026-06-05T11:40` |
| `departure.timezone` | `departure.airport.timeZone` | confirmed | `ListingAirportContract.timeZone` exists |
| `arrival.name` | `arrival.airport.name` | confirmed | `ListingAirportContract.name` exists |
| `arrival.code` | `arrival.airport.iata` | confirmed | IATA field exists, may be nullable |
| `arrival.terminal` | `arrival.terminal` | confirmed | field exists |
| `arrival.timeLocal` | `arrival.scheduledTime.local` or `arrival.revisedTime.local` | confirmed | apply the same `datetime-local` normalization rule as departure time |
| `arrival.timezone` | `arrival.airport.timeZone` | confirmed | `ListingAirportContract.timeZone` exists |
| `aircraft` | `flight.aircraft.model` | confirmed | model field exists |
| `flightStatus` | `flight.status` | confirmed | `FlightStatus` enum exists |
| `confidence` | derive from movement `quality` arrays and schedule/live presence | needs live validation | not a direct provider field; likely adapter-derived |

### Important subfield notes

- `DateTimeContract` is confirmed to contain:
  - `utc`
  - `local`
- `FlightAirportMovementContract` is confirmed to contain:
  - `scheduledTime`
  - `revisedTime`
  - `predictedTime`
  - `runwayTime`
  - `terminal`
  - `gate`
  - `checkInDesk`
  - `baggageBelt`
  - `quality`
- `ListingAirportContract` is confirmed to contain:
  - `name`
  - `iata`
  - `icao`
  - `countryCode`
  - `timeZone`

### Fields not currently mapped into the app candidate

Available from AeroDataBox but currently out of MVP candidate scope:

- `gate`
- `checkInDesk`
- `baggageBelt`
- `runway`
- `location`
- `callSign`
- `flightPlan`
- aircraft image / registration fields

## 9. Error Mapping Validation

Proposed mapping from AeroDataBox/provider-side outcomes into the app's normalized error codes:

| Provider outcome | Normalized error code | Status | Notes |
| --- | --- | --- | --- |
| no local provider config selected | `missing_provider_configuration` | adapter policy | app-level state, not provider HTTP |
| AeroDataBox selected but no stored key | `missing_api_key` | confirmed app mapping | current backend skeleton already uses this |
| HTTP `401` | `provider_unauthorized` | confirmed | explicit in spec |
| HTTP `204` | `no_results` | confirmed | explicit in spec |
| HTTP `400` | `provider_response_parse_error` or request-validation failure | likely | frontend should not send malformed request in normal flow |
| HTTP `451` | `provider_response_parse_error` | likely | legal/coverage restriction is provider-side but not yet a dedicated app error code |
| HTTP `500` | `network_error` | likely | backend/provider failure; retry may be reasonable |
| HTTP `503` | `network_error` | confirmed-like | service unavailable should map to transient failure |
| undocumented live rate-limit response | `rate_limited` | needs live validation | pricing docs mention limits, spec does not list `429` |
| unsupported provider selection in backend | `unsupported_provider` | confirmed app mapping | backend route-level error |
| historical adapter-skeleton state or future partially integrated provider | `provider_not_implemented` | documented fallback | keep the code for future provider phases even though AeroDataBox now has a live path |

## 10. Live Validation Status

- Live validation: **not run**

Reason:

- this task stayed docs-only
- no real provider call was wired into the app
- no raw API key was read, printed, or committed

## 11. Open Questions

These points are still best treated as implementation-time validation items:

1. Exact fallback order for `scheduledTime`, `revisedTime`, `predictedTime`, and `runwayTime`
2. Whether terminal values are consistently populated enough to trust for autofill
3. Whether some carriers/regions return nullable `iata` while still having `icao` only
4. Whether live rate-limit responses come back as `429`, marketplace-specific `403`, or another shape
5. Whether `dateLocalRole=Both` should remain default for the first adapter, or whether `Departure` is better for the add-ticket flow
6. Whether `withLocation=false` and `withAircraftImage=false` should stay the default to keep response weight/cost lower

## 12. Future Adapter Notes

When the real adapter is implemented later:

1. Use the single-day endpoint first:
   - `/flights/number/{flightNumber}/{dateLocal}`
2. Send:
   - `dateLocalRole=Both`
   - `withLocation=false`
   - `withAircraftImage=false`
   - `withFlightPlan=false`
3. Normalize response using:
   - `airline.name`
   - `number`
   - `departure.airport.*`
   - `arrival.airport.*`
   - `departure.terminal`
   - `arrival.terminal`
   - `scheduledTime.local` / `revisedTime.local`
4. Treat `204` as `no_results`
5. Keep all provider auth and HTTP inside the Tauri/backend layer

## 13. Sources Used

Official sources used for this validation:

- AeroDataBox OpenAPI hub
  - [https://doc.aerodatabox.com/](https://doc.aerodatabox.com/)
- API.Market OpenAPI JSON
  - [https://doc.aerodatabox.com/docs/openapi-apimarket-v1.json](https://doc.aerodatabox.com/docs/openapi-apimarket-v1.json)
- RapidAPI OpenAPI JSON
  - [https://doc.aerodatabox.com/docs/openapi-rapidapi-v1.json](https://doc.aerodatabox.com/docs/openapi-rapidapi-v1.json)
- API / features page
  - [https://portal.aerodatabox.com/api](https://portal.aerodatabox.com/api)
- Pricing
  - [https://aerodatabox.com/pricing/](https://aerodatabox.com/pricing/)
- Flight history update note
  - [https://aerodatabox.com/flight-history/](https://aerodatabox.com/flight-history/)
- Flight plans note
  - [https://aerodatabox.com/flight-plans/](https://aerodatabox.com/flight-plans/)

## 14. Explicit Status

The real AeroDataBox adapter is now implemented behind the Tauri/backend boundary.

This document still only records the validated endpoint shape, auth scheme, response schema, and mapping plan. It does not include any real key or raw response dumps, and it does not claim live provider verification until a user manually tests with their own saved key.
