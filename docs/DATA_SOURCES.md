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

## 8. Current Repository State For Rail Data

- The repository now includes:
  - the 12306 generator
  - the runtime wiring
  - a validation sample fixture
  - the full downloaded `station_name.js` source file
  - a generated nationwide rail-station dataset
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

Selection still requires a separate review for:

- pricing and quotas
- coverage for schedules vs. real-time status
- terminal/gate field availability
- commercial license terms
- acceptable redistribution/caching rules
- Tauri/backend secret handling

## 13. Why OpenSky Is Not The Primary Candidate Here

- [OpenSky FAQ](https://opensky-network.org/about/faq) states that its inferred flights are derived after the finished UTC day and that it has historical flight data for previous days, not commercial schedule/delay/cancellation data for the current day.
- [OpenSky terms](https://opensky-network.org/about/terms-of-use) also state that operational/live product API use requires a written license.

For this app's current lookup goal, that makes OpenSky a poor primary fit for:

- flight-number + date autofill during ticket entry
- terminal-aware commercial schedule lookup
- simple desktop operational use without a separate license review
