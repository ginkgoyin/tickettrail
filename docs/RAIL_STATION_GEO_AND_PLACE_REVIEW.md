# RAIL_STATION_GEO_AND_PLACE_REVIEW

## 1. Purpose

This document records the current airport / rail station data pipelines, current map coordinate resolution behavior, and the design implications for future Journey place normalization.

It is an investigation / planning checkpoint for:

- `TRAIN-STATION-GEO-SPIKE-001`
- `JOURNEY-PLACE-SPIKE-001`

It does not implement runtime behavior changes.

## 2. Files Inspected

Docs:

- [docs/DATA_SOURCES.md](C:/yx/00app/ticket/docs/DATA_SOURCES.md)
- [docs/JOURNEY_DESIGN.md](C:/yx/00app/ticket/docs/JOURNEY_DESIGN.md)
- [docs/ISSUE_CHECKLIST.md](C:/yx/00app/ticket/docs/ISSUE_CHECKLIST.md)
- [docs/TASKS.md](C:/yx/00app/ticket/docs/TASKS.md)

Data and generation:

- [scripts/generate-airports-data.mjs](C:/yx/00app/ticket/scripts/generate-airports-data.mjs)
- [scripts/generate-rail-stations-data.mjs](C:/yx/00app/ticket/scripts/generate-rail-stations-data.mjs)
- [src/data/airports.generated.json](C:/yx/00app/ticket/src/data/airports.generated.json)
- [src/data/rail-stations.generated.json](C:/yx/00app/ticket/src/data/rail-stations.generated.json)
- [src/data/airport-aliases.zh-CN.ts](C:/yx/00app/ticket/src/data/airport-aliases.zh-CN.ts)
- [src/data/locations.seed.json](C:/yx/00app/ticket/src/data/locations.seed.json)

Runtime data / map / suggestions:

- [src/lib/ticketService.ts](C:/yx/00app/ticket/src/lib/ticketService.ts)
- [src/components/TicketForm.tsx](C:/yx/00app/ticket/src/components/TicketForm.tsx)
- [src/components/RouteMap.tsx](C:/yx/00app/ticket/src/components/RouteMap.tsx)
- [src/types/ticket.ts](C:/yx/00app/ticket/src/types/ticket.ts)
- [src/lib/journeySummary.ts](C:/yx/00app/ticket/src/lib/journeySummary.ts)
- [src-tauri/src/db.rs](C:/yx/00app/ticket/src-tauri/src/db.rs)
- [src-tauri/src/commands.rs](C:/yx/00app/ticket/src-tauri/src/commands.rs)

## 3. Current Airport Data Pipeline

### Source

- Source is `OurAirports`, documented in [docs/DATA_SOURCES.md](C:/yx/00app/ticket/docs/DATA_SOURCES.md).
- Generator script: [scripts/generate-airports-data.mjs](C:/yx/00app/ticket/scripts/generate-airports-data.mjs)

### Generator behavior

The airport generator:

- reads `airports.csv`
- keeps `large_airport`
- keeps `medium_airport`
- keeps `small_airport` only when IATA exists
- excludes records without IATA
- deduplicates by IATA code
- prefers larger / scheduled airports when duplicates exist

### Generated airport fields

The generated airport file currently contains `8804` records.

The normalized output includes:

- `id`
- `locationType = "airport"`
- `code` (IATA)
- `nameEn`
- `aliases`
- `latitude`
- `longitude`
- `countryCode`

### What airport data does and does not preserve

The upstream OurAirports row includes richer source fields such as:

- airport name
- municipality
- country
- region
- coordinates

But the generated app dataset does **not** persist municipality/city as its own explicit field.

Current result:

- municipality/city may survive inside `aliases`
- there is no first-class `city`, `municipality`, or normalized place field in the generated output

### Chinese name / timezone overlay

The generated airport data is supplemented by [src/data/airport-aliases.zh-CN.ts](C:/yx/00app/ticket/src/data/airport-aliases.zh-CN.ts), which adds:

- curated Chinese names
- extra aliases
- curated timezones for common airports

This means airport suggestions are richer than the bare OurAirports export, but only for covered entries.

## 4. Current Rail / Train Station Data Pipeline

### Source

- Source format is the official 12306 `station_name.js` payload.
- Generator script: [scripts/generate-rail-stations-data.mjs](C:/yx/00app/ticket/scripts/generate-rail-stations-data.mjs)

### Generator behavior

The rail generator:

- optionally downloads the 12306 source file
- parses `station_names`
- extracts each `@...` station record
- deduplicates by telecode and normalized station name
- writes a normalized JSON file

### Generated station fields

The generated rail station file currently contains `3339` records.

Each normalized station record includes:

- `id`
- `locationType = "station"`
- `code` (12306 telecode)
- `nameZh`
- `nameEn` as pinyin slug
- `pinyin`
- `shortPinyin`
- `stationIndex`
- `aliases`
- `countryCode = "CN"`

### What rail station data does and does not provide

The generated rail station dataset does provide:

- telecode
- Chinese station name
- pinyin
- short pinyin
- station index
- aliases

It does **not** provide:

- city/place metadata
- country/region beyond `CN`
- latitude/longitude
- station -> city normalization
- bilingual display labels beyond raw Chinese + pinyin

## 5. Suggestion Pipeline Today

### Frontend location suggestions

The active location suggestion path in [src/components/TicketForm.tsx](C:/yx/00app/ticket/src/components/TicketForm.tsx) calls `searchLocations(...)` from [src/lib/ticketService.ts](C:/yx/00app/ticket/src/lib/ticketService.ts).

Important finding:

- `searchLocations(...)` currently uses `loadLocationSeed()` directly
- it does **not** call the Tauri `search_locations` command even when Tauri is available

### What `loadLocationSeed()` merges

`loadLocationSeed()` merges:

- generated airports
- airport Chinese alias overlay
- generated rail stations
- legacy station seed entries from `locations.seed.json`

This means the UI suggestion list is currently broader than the desktop-side `location_directory` database seed.

### Ticket-type filtering

In [src/components/TicketForm.tsx](C:/yx/00app/ticket/src/components/TicketForm.tsx):

- flight forms filter suggestions to `locationType === "airport"`
- train/rail forms filter suggestions to `locationType === "station"`

This is good for input UX, but it does not solve map/place normalization.

## 6. Current Map Coordinate Resolution

### Desktop/Tauri path

Desktop map coordinates are resolved in [src-tauri/src/db.rs](C:/yx/00app/ticket/src-tauri/src/db.rs):

- `resolve_map_point(...)`
- `resolve_coordinates(...)`
- `lookup_coordinates(...)`

Resolution order:

1. query `location_directory` by code / exact English name / exact Chinese name / alias match
2. if missing, try several hardcoded special cases such as `PVG`, `SHA`, `SYD`, `SHH`, `NKH`
3. if still missing, use `fallback_coordinates(...)`

`fallback_coordinates(...)` is pseudo/deterministic coordinate generation from a string seed, not real geography.

### Critical limitation: desktop location seed is tiny

The desktop-side `location_directory` is seeded by [src-tauri/src/db.rs](C:/yx/00app/ticket/src-tauri/src/db.rs) from:

- [src/data/locations.seed.json](C:/yx/00app/ticket/src/data/locations.seed.json)

Current `locations.seed.json` size:

- total records: `16`
- airports: `12`
- stations: `4`

This is much smaller than:

- `8804` generated airports
- `3339` generated rail stations

So today the desktop-side coordinate resolver does **not** have the full generated airport/rail datasets available in `location_directory`.

### Frontend/web fallback map path

The web/fallback map enrichment path in [src/lib/ticketService.ts](C:/yx/00app/ticket/src/lib/ticketService.ts):

- resolves airports only
- uses generated airport data
- does not resolve train stations

Important rule in code:

- `resolveMapPoint(ticketType, location)` returns `null` for non-flight tickets

So the frontend fallback path is explicitly flight-only for coordinate resolution.

## 7. What Happens For Train / Rail Route Maps Today

### Desktop/Tauri

Train/rail coordinates can resolve only when the station exists in `location_directory` with real coordinates.

Today that mostly means:

- a few legacy seeded stations
- a few hardcoded station cases in `resolve_coordinates(...)`

If a train station is not covered there:

- the desktop app falls through to pseudo `fallback_coordinates(...)`
- the map still renders, but the coordinates are not reliable real geography

### Frontend/web fallback

Train/rail map resolution is not supported by generated station data in the fallback path.

Result:

- no real station-coordinate resolution from the generated `rail-stations.generated.json`
- train fallback map data remains unresolved / unusable for real geography

### Mixed flight/train Journey routes

The current repository does not yet implement a real Journey-level route map that mixes flight and train segments as a stable user-facing feature.

Even if a future mixed Journey map were added immediately, current data would be inconsistent because:

- airports have a rich generated suggestion dataset
- desktop map resolution only knows the tiny `locations.seed.json` subset plus hardcoded cases
- rail stations have national suggestion coverage but no generated coordinates/place metadata

## 8. Why Train/Rail Suggestions Cannot Yet Safely Resolve Coordinates

Main reasons:

1. The generated rail station dataset has no coordinates.
2. The generated rail station dataset has no explicit city/place normalization field.
3. Desktop map resolution does not ingest the generated rail dataset into `location_directory`.
4. Frontend fallback map resolution is flight-only.
5. Existing desktop rail map success depends on a tiny legacy seed or hardcoded cases, not a scalable rail geo pipeline.

## 9. Options For Connecting Train/Rail Stations To Maps

### Option A

Add a generated rail station geo dataset with station code/name -> city/place + latitude/longitude.

Accuracy:

- best option for exact station-level map points

Implementation complexity:

- high

Licensing / redistribution risk:

- medium to high, because the coordinate source would need separate review

Maintenance / regeneration risk:

- medium to high

Effect on route maps:

- strongest result for exact rail maps

Effect on `JOURNEY-PLACE-001`:

- strong, because station -> place normalization can be first-class

MVP safety:

- not the smallest safe next step

### Option B

Keep 12306 station suggestions as-is and add a separate local metadata overlay for coordinates/place labels.

Accuracy:

- moderate to high depending on overlay quality

Implementation complexity:

- medium

Licensing / redistribution risk:

- better isolated than replacing the whole dataset, but still depends on overlay provenance

Maintenance / regeneration risk:

- medium

Effect on route maps:

- good for covered stations only

Effect on `JOURNEY-PLACE-001`:

- useful, because normalization can be layered without rewriting the 12306 parser

MVP safety:

- viable if we intentionally accept partial coverage

### Option C

Use city/place-level coordinates instead of exact station coordinates for Journey-level maps and place normalization.

Accuracy:

- lower for exact station maps
- often sufficient for Journey-level place semantics

Implementation complexity:

- medium

Licensing / redistribution risk:

- lower than exact station-geo if place metadata comes from a simpler curated/local source

Maintenance / regeneration risk:

- medium

Effect on route maps:

- weaker for exact ticket-level rail route maps
- good enough for Journey-level place maps

Effect on `JOURNEY-PLACE-001`:

- very strong, because Journey places care more about visited city/place than exact station geometry

MVP safety:

- safest design direction for the Journey place layer

### Option D

Support only manual/curated coordinates for frequently used stations first.

Accuracy:

- high for covered stations
- poor long-tail coverage

Implementation complexity:

- low to medium

Licensing / redistribution risk:

- low if curated manually

Maintenance / regeneration risk:

- manual and ongoing

Effect on route maps:

- acceptable for demos and narrow personal usage

Effect on `JOURNEY-PLACE-001`:

- limited; helps only for manually covered stations

MVP safety:

- safe as a temporary bridge, but not scalable

## 10. Recommended MVP Approach

Recommended practical direction:

1. Treat exact rail station coordinates and Journey place normalization as two related but separate layers.
2. Prioritize place normalization first for `JOURNEY-PLACE-001`.
3. Use conservative place-level fallback rules before exact rail station geo is solved globally.

Recommended shape:

- airports normalize to city/place labels when metadata supports it
- rail stations normalize to city/place labels when metadata supports it
- if normalization is unsafe, keep the original endpoint label
- Journey-level Stops and destination summaries should prefer place-level labels
- exact ticket-detail rail station coordinates can stay a separate later task

For rail geo specifically, the safest MVP path is:

- Option C as the primary design direction for Journey place work
- Option B as the likely implementation strategy for future rail metadata enrichment

This means:

- do not block `JOURNEY-PLACE-001` on perfect national station coordinates
- do design a future rail metadata layer that can map station -> normalized place -> optional coordinates

## 11. Implications For JOURNEY-PLACE-001

Future normalized Journey place design should support:

- raw ticket endpoint remains unchanged on tickets
- Journey-level display uses normalized place label
- system language controls preferred display label
- future bilingual display remains possible
- normalization can unify different transport endpoints into one place
- fallback remains safe when confidence is low

Suggested conceptual output:

```ts
type JourneyPlace = {
  placeKey: string;
  displayName: string;
  displayNameZh?: string;
  displayNameEn?: string;
  countryCode?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  source: "airport" | "rail_station" | "manual" | "fallback";
  confidence: "high" | "medium" | "low";
};
```

### PlaceKey implication

`placeKey` should be designed so that:

- one airport and one rail station in the same city can normalize to the same Journey place when metadata supports it
- different raw endpoints remain separate when normalization confidence is low

Example goal:

- Qingdao Jiaodong Airport
- a Qingdao rail station

can become one Journey place only when the metadata layer safely supports that merge.

### Current repo implication

Current generated airport data is not enough by itself because it lacks an explicit city field.
Current generated rail station data is not enough by itself because it lacks both place metadata and coordinates.

So `JOURNEY-PLACE-001` should not be implemented as a quick label-only heuristic over today's raw datasets without a clearer normalization source.

## 12. Recommended Future Task Order

Smallest safe next steps:

1. `TRAIN-STATION-GEO-DESIGN-001`
   - document the exact rail metadata layer shape and whether it is station-level or place-level first
2. `JOURNEY-PLACE-001`
   - define and implement the first normalized Journey place resolver with conservative fallback behavior
3. `TRAIN-STATION-GEO-001`
   - add the first usable rail metadata dataset / overlay and connect it to normalization and map resolution
4. `JOURNEY-STOPS-DATA-001`
5. `JOURNEY-STOPS-AUTO-001`
6. `JOURNEY-STOPS-UI-001`
7. `JOURNEY-SUMMARY-STOPS-001`

Why this order:

- the design gap is not only coordinates, but also place semantics
- Journey Stops and Summary destination rules depend on normalized places more than on exact station geometry
- exact rail map points can evolve later without blocking the Stop model

## 13. Summary Findings

- Airport suggestions use a rich generated dataset, but desktop map resolution does not fully share that dataset today.
- Rail suggestions are nationwide and good for input search, but they do not yet carry geo/place metadata.
- Desktop train/rail map resolution currently works only for a tiny seeded subset plus hardcoded cases; otherwise it falls back to pseudo coordinates.
- The smallest safe next direction is to design a normalization layer first, then add a rail metadata layer that can support both place labels and optional coordinates.
