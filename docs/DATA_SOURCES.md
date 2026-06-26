# DATA_SOURCES

## 1. Airport Data Source

- Global airport coverage is generated from [OurAirports](https://ourairports.com/data/).
- Preferred upstream file: `airports.csv`
- Current upstream download location is documented by OurAirports and mirrored from the maintained `davidmegginson/ourairports-data` repository.

## 2. Airport Filtering Rules

The airport generator keeps only ticket-useful airports:

- include `large_airport`
- include `medium_airport`
- include `small_airport` only when an IATA code exists

The generator excludes:

- closed airports
- heliports
- seaplane bases
- balloonports
- any record without an IATA code

If multiple rows share the same IATA code, the generator keeps the best candidate by preferring:

1. `large_airport`
2. `medium_airport`
3. `small_airport`
4. scheduled-service rows over non-scheduled rows

## 3. Generated Output

- Generator script: [C:\yx\00app\ticket\scripts\generate-airports-data.mjs](C:/yx/00app/ticket/scripts/generate-airports-data.mjs)
- Generated output: [C:\yx\00app\ticket\src\data\airports.generated.json](C:/yx/00app/ticket/src/data/airports.generated.json)

The generated airport records are normalized to the app's `LocationDirectoryEntry`-compatible shape:

- `id`
- `locationType = "airport"`
- `code` (IATA)
- `nameEn`
- `aliases`
- `latitude`
- `longitude`
- `countryCode`

OurAirports `airports.csv` does not provide app-ready Chinese names or timezones, so those are supplemented separately where needed.

## 4. Chinese Alias Overlay

- Overlay file: [C:\yx\00app\ticket\src\data\airport-aliases.zh-CN.ts](C:/yx/00app/ticket/src/data/airport-aliases.zh-CN.ts)

This curated overlay supplements the generated global airport list with:

- Chinese aliases for common China airports
- Chinese display names where available
- known timezone values for those curated airports

This overlay is additive only. It does not replace the global generated airport dataset.

## 5. Regeneration

1. Download `airports.csv` from the OurAirports data source.
2. Run:

```powershell
node scripts/generate-airports-data.mjs path\to\airports.csv
```

Optional explicit output path:

```powershell
node scripts/generate-airports-data.mjs path\to\airports.csv src\data\airports.generated.json
```

## 6. Rail Station Source Format

- Train/rail station suggestion data is generated from the official 12306 `station_name.js` style format.
- Expected source file location:
  - [C:\yx\00app\ticket\data-sources\12306\station_name.js](C:/yx/00app/ticket/data-sources/12306/station_name.js)
- This source may be either:
  - a full JS assignment such as `var station_names ='@bjb|北京北|VAP|beijingbei|bjb|0@...'`
  - or the raw station payload string that starts with `@`

The parser reads each `@...` station entry and maps:

- field 1: short pinyin slug
- field 2: Chinese station name
- field 3: 12306 railway station telecode
- field 4: full pinyin
- field 5: short pinyin
- field 6: station index

## 7. Rail Station Generator

- Generator script: [C:\yx\00app\ticket\scripts\generate-rail-stations-data.mjs](C:/yx/00app/ticket/scripts/generate-rail-stations-data.mjs)
- Generated output: [C:\yx\00app\ticket\src\data\rail-stations.generated.json](C:/yx/00app/ticket/src/data/rail-stations.generated.json)
- Official source file currently stored in-repo:
  - [C:\yx\00app\ticket\data-sources\12306\station_name.js](C:/yx/00app/ticket/data-sources/12306/station_name.js)
- Official source URL:
  - [https://kyfw.12306.cn/otn/resources/js/framework/station_name.js](https://kyfw.12306.cn/otn/resources/js/framework/station_name.js)
- Validation sample source:
  - [C:\yx\00app\ticket\data-sources\12306\station_name.sample.js](C:/yx/00app/ticket/data-sources/12306/station_name.sample.js)

Automatic download + regenerate:

```powershell
npm.cmd run generate:rail-stations
```

Direct script usage with download:

```powershell
node scripts/generate-rail-stations-data.mjs --download
```

Direct script usage with download + explicit paths:

```powershell
node scripts/generate-rail-stations-data.mjs --download --source data-sources\12306\station_name.js --out src\data\rail-stations.generated.json
```

Existing local-source usage is still supported:

```powershell
node scripts/generate-rail-stations-data.mjs data-sources\12306\station_name.js
```

If the local source file is encoded differently, the generator also supports:

```powershell
node scripts/generate-rail-stations-data.mjs data-sources\12306\station_name.js --encoding=gbk
```

The generated records are normalized to the app's `LocationDirectoryEntry`-compatible shape:

- `id`
- `locationType = "station"`
- `code` (12306 telecode)
- `nameZh`
- `nameEn` (12306 pinyin string)
- `pinyin`
- `shortPinyin`
- `stationIndex`
- `aliases`
- `countryCode = "CN"`
- conservative derived place metadata:
  - `placeNameZh`
  - `placeNameEn`
  - `placeKey`
  - `placeConfidence`
  - `placeRule`

The derived rail place metadata stage is intentionally conservative:

- exact curated hub rules can map station names such as `上海虹桥` to the city/place label `上海`
- directional suffix stripping can map names such as `青岛北` / `长沙南` / `北京南` to the city/place label
- uncertain cases fall back to the original station name instead of over-normalizing
- no coordinates are added in this stage
- no external city dataset is used in this stage

## 8. Current Repository State For Rail Data

- The repository now includes:
  - the 12306 generator
  - the runtime wiring
  - a validation sample fixture
  - the full downloaded `station_name.js` source file
  - a generated nationwide rail-station dataset
- The rail generator now also derives a conservative station-to-place metadata layer directly from the existing 12306 station name + pinyin fields.
- The current generated file was produced from the downloaded 12306 source and currently contains `3339` rail station records.
- The runtime currently merges:
  - generated rail station records
  - legacy station seed entries that still carry a few existing aliases/coordinates
- This means the suggestion pipeline is now using generated nationwide rail station data, while still keeping a small legacy station fallback for previously hardcoded aliases/coordinates.
- The generator can now also download the current official 12306 source locally before regenerating output, so the project can later choose not to commit the raw source file.

## 9. Provenance And Redistribution Warning

- The 12306 source URL above is a publicly accessible official static resource.
- Public accessibility does **not** automatically mean the data is openly licensed for redistribution.
- Explicit open-data / redistribution permission for:
  - the raw `station_name.js`
  - the derived `rail-stations.generated.json`
  is **not currently confirmed** in this repository.
- Before any broader public release, the project should review whether it is appropriate to keep committing:
  - [C:\yx\00app\ticket\data-sources\12306\station_name.js](C:/yx/00app/ticket/data-sources/12306/station_name.js)
  - [C:\yx\00app\ticket\src\data\rail-stations.generated.json](C:/yx/00app/ticket/src/data/rail-stations.generated.json)
- Because the local regeneration script now exists, the repository can later choose to stop committing the raw source file and regenerate locally when needed.

## 10. Rail Coordinates

- This 12306 station-name pipeline does **not** provide coordinates.
- No rail station coordinates are guessed in this pipeline.
- Train route-map coordinates remain a separate future task and require:
  - a separate source
  - a separate validation pass
  - a separate license review if needed

## 11. Flight Lookup Scaffold (Current Phase)

- Phase 1 flight lookup is intentionally a local scaffold only.
- Current implementation file:
  - [C:\yx\00app\ticket\src\lib\flightLookup.ts](C:/yx/00app/ticket/src/lib/flightLookup.ts)
- It performs:
  - flight number + departure date lookup
  - local mock candidate generation
  - manual candidate apply back into the flight form
- It does **not** perform:
  - live airline API requests
  - paid provider integration
  - API-key storage
  - backend credential handling

The current scaffold exists to prove the Add/Edit form flow safely before the project chooses a real provider.

## 12. Future Flight Data Provider Candidates

Potential future providers that should be evaluated from official sources only:

- [AeroDataBox](https://aerodatabox.com/)
  - Official site describes flight status, schedules, airport schedules, airport details, and flight-number search capabilities.
- [Amadeus On-Demand Flight Status API](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/flights/)
  - Official docs describe real-time flight schedule data including departure/arrival times, terminal and gate information, and duration.
- [aviationstack](https://aviationstack.com/documentation)
  - Official docs describe real-time, historical, and future flight data, including airport/timezone/terminal fields in flight responses.
- [FlightAware AeroAPI](https://www.flightaware.com/commercial/aeroapi)
  - Official site describes global flight status/tracking access with multiple endpoints and query-based usage.

Provider review is now complete enough to guide the next prototype step:

- AeroDataBox is the recommended first implementation candidate / prototype provider.
- Amadeus remains the main runner-up if later testing shows stronger field quality is worth the extra integration complexity.
- AeroDataBox is now integrated as the first real provider path behind the Tauri/backend boundary.
- The current user-facing lookup UX still preserves the existing manual candidate-review/apply flow.

Before any real provider is connected, the project still needs:

- the reviewed first adapter implementation
- final live-endpoint validation with a real user-provided key
- commercial license/usage confirmation for the chosen integration path
- acceptable redistribution/caching rules
- Tauri/backend secret handling

The current provider review document now recommends AeroDataBox as the first provider to prototype, with Amadeus kept as the main runner-up if higher field quality becomes more important than initial simplicity:

- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_PROVIDER_REVIEW.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_PROVIDER_REVIEW.md)
- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_TAURI_CONTRACT.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_TAURI_CONTRACT.md)
- [C:\yx\00app\ticket\docs\FLIGHT_LOOKUP_AERODATABOX_SCHEMA.md](C:/yx/00app/ticket/docs/FLIGHT_LOOKUP_AERODATABOX_SCHEMA.md)

Current validation status:

- AeroDataBox single-day flight status endpoint and related response schema have now been reviewed from the official OpenAPI docs.
- This validation confirms the planned first endpoint shape and mapping rules.
- A real AeroDataBox adapter path now exists behind the backend boundary when Settings selects `AeroDataBox` and a local key is saved.
- The current runtime still keeps `Mock` as the safe fallback/default provider path.

## 13. Why OpenSky Is Not The Primary Candidate Here

- [OpenSky FAQ](https://opensky-network.org/about/faq) states that its inferred flights are derived after the finished UTC day and that it has historical flight data for previous days, not commercial schedule/delay/cancellation data for the current day.
- [OpenSky terms](https://opensky-network.org/about/terms-of-use) also state that operational/live product API use requires a written license.

For this app's current lookup goal, that makes OpenSky a poor primary fit for:

- flight-number + date autofill during ticket entry
- terminal-aware commercial schedule lookup
- simple desktop operational use without a separate license review

## 14. Planned Real Integration Boundary

The current repository does **not** call a live provider yet.

The intended future integration boundary is:

- React form
  -> frontend lookup abstraction
  -> Tauri command
  -> provider adapter
  -> normalized `FlightLookupCandidate[]`

That future boundary is intended to ensure:

- no hardcoded provider keys in frontend code
- no provider secret exposure in bundled JavaScript
- one normalized candidate shape regardless of provider

The first real provider path is now implemented for AeroDataBox behind the desktop-side boundary, while the normalized payload shape and contract rules continue to apply to future providers.

## 15. Place Catalog Source

- The Place Catalog is now generated from GeoNames downloadable dump files.
- Current generator script:
  - [C:\yx\00app\ticket\scripts\generate-place-catalog-data.mjs](C:/yx/00app/ticket/scripts/generate-place-catalog-data.mjs)
- Current generated output:
  - [C:\yx\00app\ticket\src\data\place-catalog.generated.json](C:/yx/00app/ticket/src/data/place-catalog.generated.json)

Current default source choice:

- global baseline: `cities5000.zip`
- targeted China rail supplement: reviewed safe matches from local `cities1000.zip` + filtered `alternateNamesV2.zip`

Reason:

- `cities1000.zip` was evaluated first as a full runtime catalog source, but the generated catalog was too large for the current repository/runtime foundation.
- The project therefore keeps `cities5000.zip` as the practical global baseline after measuring the real generated size.
- Additional China detail is now merged only for rail-needed places that were pre-reviewed through `docs/reviews/rail-geonames-candidate-review.csv` and fall into safe actions such as `can_auto_add_place` or `can_canonicalize_to_existing_catalog`.
- Ambiguous, slug-only, and no-candidate rows remain outside runtime data until later review / override work.

GeoNames files used:

- `cities5000.zip`
- `cities1000.zip` for the reviewed rail-needed China subset only
- `alternateNamesV2.zip`

GeoNames files currently not required in the first runtime foundation:

- `countryInfo.txt`

Current local raw cache path:

- `data-sources/geonames/`

Raw GeoNames cache files are local generation inputs only and are ignored by Git.

## 16. Place Catalog Generation Rules

The generator builds standard city/place records with:

- `placeKey`
- `geonameId`
- `nameEn`
- `nameZh` when a useful GeoNames alternate name exists
- `asciiName`
- `countryCode`
- optional admin codes
- city-level `latitude` / `longitude`
- `timezone`
- `population`
- small filtered `aliases`
- `source = "geonames"`
- `sourceId = geonameId`
- `coordinatePrecision = "city"`

Language rules:

- `nameEn` prefers English alternate names when available, otherwise falls back to the main GeoNames name / ASCII name
- `nameZh` prefers `zh-CN`, `zh-Hans`, then `zh` alternate names when available
- aliases are search-only fields
- aliases are not used as display names

## 17. GeoNames Attribution And License

- GeoNames data is licensed under CC BY.
- Commercial use is allowed.
- Attribution is required.

Project attribution note:

- TicketTrail Place Catalog data is derived from GeoNames geographic data.
- Future release notes / about/legal surfaces should keep a visible GeoNames credit when this catalog is shipped in app builds.

Official GeoNames references:

- [GeoNames download server](https://download.geonames.org/export/dump/)
- [GeoNames export documentation](https://www.geonames.org/export/)
- [GeoNames about / licensing notes](https://www.geonames.org/about.html)

## 18. Place Catalog Source Boundaries

- GeoNames is now the primary Place Catalog source.
- OurAirports remains the airport endpoint source.
- 12306 `station_name.js` remains the rail endpoint source.
- Wikidata remains a future multilingual enrichment candidate only.
- OpenStreetMap is not used for this Place Catalog because ODbL / derived-database obligations would require a separate review.

## 19. Transport Endpoint -> Place Mapping

- Transport endpoint -> Place Catalog mapping is now generated as a separate derived file:
  - [C:\yx\00app\ticket\scripts\generate-transport-place-data.mjs](C:/yx/00app/ticket/scripts/generate-transport-place-data.mjs)
  - [C:\yx\00app\ticket\src\data\transport-place.generated.json](C:/yx/00app/ticket/src/data/transport-place.generated.json)
- This layer keeps airport and rail endpoint catalogs separate from the standard Place Catalog.
- It does not replace endpoint records.
- It adds stable `defaultJourneyPlaceKey` mappings for Journey-level place meaning.

Current generated mapping shape stores:

- mapped airport codes
- mapped rail telecodes
- one deduped place-label dictionary keyed by `placeKey`
- per-endpoint:
  - `defaultJourneyPlaceKey`
  - `mappingSource`
  - `mappingConfidence`
- per-place:
  - standard `nameEn`
  - optional standard `nameZh`

Runtime rule:

- raw ticket detail still shows exact airport / station endpoint fields
- Journey place normalization now prefers Place Catalog standard labels when a transport endpoint mapping exists
- aliases remain search-only fields
- airport / rail endpoint aliases should not be used as Journey display labels once mapped

## 20. Airport Mapping Rules

Current airport mapping is intentionally conservative and uses the existing generated airport metadata plus the Place Catalog:

1. explicit override if one is later added
2. direct generated airport `placeKey` if that exact key exists in the Place Catalog
3. duplicate-segment airport `placeKey` collapse only for obviously repeated patterns such as `cn-changsha-changsha -> cn-changsha`
4. `countryCode + normalized placeNameEn`
5. `countryCode + normalized municipality`
6. otherwise leave unmapped

Important rules:

- do not add broad served-city assumptions
- do not automatically convert disputed airports such as `NRT` into `Tokyo`
- use `countryCode` to avoid cross-country city collisions

## 21. Rail Mapping Rules

Current rail mapping uses the conservative rail-place layer from `RAIL-STATION-PLACE-001` plus the Place Catalog:

1. explicit override if one is later added
2. reviewed canonicalization to an existing Place Catalog key when a safe review row says `can_canonicalize_to_existing_catalog`
3. medium/high-confidence generated rail `placeKey` if that exact key exists in the Place Catalog
4. medium/high-confidence `countryCode + placeNameZh`
5. medium/high-confidence `countryCode + placeNameEn / pinyin`
6. low-confidence rail entries stay unmapped

Important rules:

- low-confidence station records are not forcibly merged into the Place Catalog
- current unmapped rail fallback still preserves the existing conservative station-derived display
- no exact rail station coordinates are added here

## 22. Endpoint Labels vs Place Labels

The repository now treats these as distinct layers:

- airport / rail endpoint catalogs:
  - search fields
  - endpoint names
  - exact airport coordinates
  - conservative rail metadata
- Place Catalog:
  - standard city/place identity
  - standard multilingual labels
  - city-level coordinates
- transport-place mapping:
  - endpoint -> `defaultJourneyPlaceKey`

This means:

- `Qingdao Jiaodong International Airport` can still appear as the raw ticket endpoint
- Journey destination / route normalization can now display the Place Catalog label `Qingdao` / `青岛市`
- `Qingdao North` and `TAO` can share the same stable place identity without pretending the station and airport are the same endpoint
