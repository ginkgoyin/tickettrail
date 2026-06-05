# FLIGHT_LOOKUP_PROVIDER_REVIEW

## 1. Scope

This document reviews real flight-data providers for the next phase of `FLIGHT-LOOKUP-002`.

It is a planning document only.

No provider has been integrated yet.

Current repository state:

- Phase 1 mock lookup scaffold exists.
- The architecture boundary has been documented in:
  - [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_DESIGN.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_DESIGN.md)

## 2. Review Criteria

Each provider was reviewed against these questions:

1. Can it look up a flight by flight number + date?
2. Does it support future schedules?
3. Does it support historical flights?
4. Does it support real-time status?
5. Does it return departure / arrival airport codes?
6. Does it provide terminal / gate information?
7. Does it expose timezone or local-time fields?
8. What are the pricing / free-tier / request-limit characteristics?
9. How are API keys or secrets handled?
10. Are there licensing or terms concerns?
11. Is it a good fit for a personal desktop / Tauri app?
12. How complex would implementation be?

## 3. Comparison Table

| Provider | Flight number + date lookup | Future schedules | Historical flights | Real-time status | Airport codes | Terminal / gate | Timezone / local time | Pricing / limits | Secret handling | Fit for personal Tauri app | Implementation complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AeroDataBox | Yes. Official docs describe flight status by number and flight history / schedules, including date-based flight-number lookup. | Yes. Official pricing/docs mention future schedules and future airport schedules. | Yes. Official pricing/docs mention historical flight availability. | Yes. Official site/docs describe real-time flight status. | Yes, strongly implied through airport/flight objects and airport features. | Likely yes for status use-cases, but exact field mapping should be confirmed in the playground/spec before coding. | Yes, airport local-time support is documented; flight local-time handling appears viable. | Public low-cost marketplace plans; free/trial access available; rate limiting starts around 1 request/sec on lower plans. | Marketplace API key in request headers; still must stay out of frontend bundle. | Good. Explicitly marketed to SMBs, developers, and researchers. | Medium. Good flight-fit, but marketplace-based auth and exact field mapping still need validation. | Strong balance of direct flight fit, future/history coverage, and cost. |
| Amadeus On-Demand Flight Status | Yes. Official docs require `carrierCode`, `flightNumber`, and `scheduledDepartureDate`. | Likely yes for scheduled flights, but future-range behavior should be verified against real test cases before implementation. | Not clearly documented as a historical archive feature in the official status guide. | Yes. Official docs explicitly describe real-time schedule data and delay status. | Yes. Airline/airport schedule context is part of the API family and flight responses include structured airport data. | Yes. Official docs explicitly mention terminal and gate information. | Yes. Official docs explicitly mention departure/arrival times; timezone/local-time handling should be confirmed from live response payloads. | Official docs state free monthly quota in test and production, with paid overage after that; rate limits documented at 10 TPS test / 40 TPS production for most self-service APIs. Exact cost per month should be rechecked before implementation. | Uses `client_id` + `client_secret`; this strongly favors a backend/Tauri boundary and is not suitable for frontend exposure. | Good functional fit, but more enterprise-shaped auth and onboarding. | Medium-high. Strong field quality, but auth flow and product terms add more setup. | Best field/airline-style fit if we prioritize schedule/status quality over simplicity. |
| Aviationstack | Probably yes, but the official docs emphasize generic flights/timetable/future-schedule endpoints rather than a clearly documented primary “flight number + departure date” product flow. | Yes. Official docs describe `flightsFuture` for future schedules. | Yes, but official docs say only the last 3 months are available. | Yes. Official docs describe real-time flight data. | Yes. Flight and airport fields are part of the documented response family. | Yes. Official docs and pricing/FAQ pages describe terminals and gates in supported data. | Yes. Local times appear available through flight schedule data. | Free plan with 100 requests/month; commercial tiers start at about $49.99/month for 10,000 requests, then higher plans for 50,000 and 250,000. Free timetable/future endpoints have very low rate limits. | Uses `access_key` in the request URL/query style shown in docs; this is a security downside for desktop logging and still must stay out of frontend code. | Fair for experiments, less ideal for a long-term secure desktop integration. | Medium. Simple REST shape, but product fit for exact flight-number/date autofill is less direct. | Useful fallback candidate, but not the clearest first implementation choice. |
| FlightAware AeroAPI | Yes, via ident/flight lookup tooling and additional airline-flight info endpoints. | Yes. Official pricing page lists schedule endpoints. | Yes, but history access is not included in the lowest personal tier. | Yes. FlightAware is strong here. | Yes. Flight and route endpoints are mature. | Yes. Official explorer docs explicitly mention gate and baggage claim information. | Likely yes through flight status payloads and timestamps, though timezone normalization still needs adapter work. | Most expensive/complex model here. Personal tier has usage fees and restrictions; Standard starts with a monthly minimum, and pricing is result-set based rather than simple request count. | Requires API credentials and likely stronger account/license controls. | Weak for the current personal desktop phase because cost and license tiers are heavier. | High. Strong data, but expensive and operationally heavier. | Best suited later if premium operational tracking becomes necessary. |

## 4. Recommendation

### Recommended first provider to implement

Recommend **AeroDataBox** as the first real provider to prototype behind the secure Tauri boundary.

### Why AeroDataBox is the first recommendation

It currently has the best balance for this app's next step:

- explicit support for flight-number-oriented status lookup
- explicit support for future schedules
- explicit support for historical flight data
- pricing that is much easier to justify for a personal or small desktop app phase
- positioning that is explicitly friendly to smaller developer teams and individual developers
- simpler credential model than OAuth-style client credential flows

### Why not Amadeus first, despite strong field quality

Amadeus is the strongest alternative and should remain the main runner-up.

However, for the first desktop integration pass it has tradeoffs:

- client ID + client secret auth flow
- more enterprise-shaped onboarding / production path
- less explicit historical-archive positioning in the reviewed status docs
- likely higher coordination overhead before a first successful desktop prototype

If the product later decides that terminal/gate accuracy and airline-grade schedule quality matter more than simplicity, Amadeus may become the better long-term provider.

### Why not Aviationstack first

Aviationstack is attractive for quick experimentation, but it is weaker as the first choice because:

- the documented product flow is more airport-timetable oriented than direct flight-number/date autofill
- the free tier is very small
- URL-style key usage shown in docs is a poor fit unless the backend boundary is already complete

### Why not FlightAware first

FlightAware looks powerful, but for this phase it is too heavy:

- more expensive
- licensing tiers are more restrictive
- result-set billing is less straightforward for a small app
- likely overkill for the first ticket autofill implementation

## 5. Risks

Even for the recommended first provider, these risks remain open:

- exact field coverage for terminal / gate needs confirmation from the official schema/playground
- future and historical coverage may vary by carrier / airport / region
- marketplace-based auth means pricing and quotas are partly mediated by the marketplace
- using a cheaper provider may trade off some data precision or service stability

General cross-provider risks:

- provider terms may restrict redistribution or caching
- provider billing may change
- provider test environments may not reflect production data quality
- candidate data can still be ambiguous and must remain manually applied

## 6. Required Next Steps Before Implementation

Before any provider is implemented:

1. Re-check the live official pricing pages on the target date.
2. Confirm that the provider's terms allow the intended desktop usage pattern.
3. Confirm the exact endpoint and sample response shape for:
   - flight number + date
   - terminal / gate
   - departure / arrival airport codes
   - local time fields
4. Define the Tauri command contract.
5. Decide how provider keys will be stored on the desktop side.
6. Decide what error states the frontend should show:
   - no result
   - multiple candidates
   - provider unavailable
   - credential missing
   - rate limit hit

## 7. First Endpoint To Test If A Provider Is Chosen

If **AeroDataBox** is chosen first, the first endpoint to validate should be the flight-number lookup path documented around:

- `GET /flights/number/{flightNumber}/{date}`
- or the current documented flight-number status/history route in the official playground/spec

Reason:

- it most closely matches the current product behavior
- it tests the exact core input shape already present in the form
- it can validate the minimum normalized candidate payload

If **Amadeus** is chosen first instead, the first endpoint to validate should be:

- `GET /v2/schedule/flights?carrierCode=...&flightNumber=...&scheduledDepartureDate=...`

Reason:

- it directly matches the documented On-Demand Flight Status flow
- it explicitly targets schedule/status lookup by flight number and date

## 8. Sources Used

Official sources reviewed:

- AeroDataBox
  - [https://aerodatabox.com/](https://aerodatabox.com/)
  - [https://aerodatabox.com/pricing/](https://aerodatabox.com/pricing/)
  - [https://portal.aerodatabox.com/api](https://portal.aerodatabox.com/api)
  - [https://doc.aerodatabox.com/](https://doc.aerodatabox.com/)
  - [https://aerodatabox.com/faq/](https://aerodatabox.com/faq/)
  - [https://aerodatabox.com/flight-plans/](https://aerodatabox.com/flight-plans/)
  - [https://aerodatabox.com/introduction-of-the-terms-of-use/](https://aerodatabox.com/introduction-of-the-terms-of-use/)
- Amadeus
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/flights/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/flights/)
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/examples/code-example/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/examples/code-example/)
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/pricing/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/pricing/)
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/api-rate-limits/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/api-rate-limits/)
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/API-Keys/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/API-Keys/)
  - [https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/test-data/](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/test-data/)
- Aviationstack
  - [https://aviationstack.com/documentation](https://aviationstack.com/documentation)
  - [https://aviationstack.com/pricing](https://aviationstack.com/pricing)
  - [https://aviationstack.com/billing-overages-documentation](https://aviationstack.com/billing-overages-documentation)
  - [https://aviationstack.com/faq](https://aviationstack.com/faq)
- FlightAware AeroAPI
  - [https://www.flightaware.com/commercial/aeroapi/](https://www.flightaware.com/commercial/aeroapi/)
  - [https://www.flightaware.com/commercial/aeroapi/faq.rvt](https://www.flightaware.com/commercial/aeroapi/faq.rvt)
  - [https://www.flightaware.com/commercial/aeroapi/explorer/](https://www.flightaware.com/commercial/aeroapi/explorer/)
  - [https://www.flightaware.com/commercial/aeroapi/AeroAPI_Personal_License_Jan2025.pdf](https://www.flightaware.com/commercial/aeroapi/AeroAPI_Personal_License_Jan2025.pdf)
  - [https://www.flightaware.com/commercial/aeroapi/AeroAPI_Premium_License_Jan2025.pdf](https://www.flightaware.com/commercial/aeroapi/AeroAPI_Premium_License_Jan2025.pdf)

## 9. Explicit Status

No real provider has been integrated yet.

No live provider calls have been added to the app.

No API key handling has been implemented yet.
