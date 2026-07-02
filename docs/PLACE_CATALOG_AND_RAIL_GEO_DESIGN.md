# PLACE CATALOG AND RAIL GEO DESIGN

## Status

- Task: `PLACE-CATALOG-AND-RAIL-GEO-DESIGN-001`
- Type: docs-only design / investigation
- Runtime integration: not started

## 1. Purpose

This document defines the next location architecture step after the current airport-first location-directory and conservative rail-place work.

The goal is to separate three concepts that are currently still partially mixed:

1. standard travel places such as cities
2. transport endpoints such as airports and rail stations
3. Journey-level meaning such as Stops, destinations, and map fallback points

This task does not:

- implement runtime code
- generate new datasets
- change the UI
- change database schema
- change Journey Stops runtime
- add exact rail station coordinates

## 2. Current Problem

Current Journey place behavior is better than before, but still unstable because:

- airport names, station names, aliases, municipalities, and travel places are still partially mixed
- frontend and backend do not use one formal shared Place Catalog yet
- exact endpoint coordinates and Journey-level place coordinates are not clearly separated concepts
- generated airport data already contains city-like metadata, while generated rail data only has a conservative place layer and no coordinates
- backend route-map resolution still depends on the small `locations.seed.json`-seeded `location_directory` plus generated-airport fallback and pseudo fallback

Examples of the desired direction:

- `TAO` / `Qingdao Jiaodong Airport` should usually map to `cn-qingdao`
- `QHK` / `青岛北` should map to the same `cn-qingdao`
- Journey Summary, Stops, and destination display should render the standard place label from a Place Catalog
- ticket detail can still show exact endpoint names

## 3. Repository Audit

### 3.1 Airport data today

Current airport generation path:

- source: OurAirports `airports.csv`
- generator: [scripts/generate-airports-data.mjs](C:/yx/00app/ticket/scripts/generate-airports-data.mjs)
- output: [src/data/airports.generated.json](C:/yx/00app/ticket/src/data/airports.generated.json)

Generated airport records already store:

- `id`
- `locationType = "airport"`
- `code`
- `nameEn`
- `municipality`
- `placeNameEn`
- `placeKey`
- `coordinatePrecision = "exact"`
- `aliases`
- `latitude`
- `longitude`
- `countryCode`

Important finding:

- generated airport records already have city-like place metadata through `municipality`, `placeNameEn`, and `placeKey`
- airport records are still endpoint records, not a formal standard Place Catalog
- Chinese display/timezone enrichment is still handled through [src/data/airport-aliases.zh-CN.ts](C:/yx/00app/ticket/src/data/airport-aliases.zh-CN.ts)

### 3.2 Rail station data today

Current rail generation path:

- source: 12306 `station_name.js`
- generator: [scripts/generate-rail-stations-data.mjs](C:/yx/00app/ticket/scripts/generate-rail-stations-data.mjs)
- place-rule helper: [scripts/lib/derive-rail-place.mjs](C:/yx/00app/ticket/scripts/lib/derive-rail-place.mjs)
- output: [src/data/rail-stations.generated.json](C:/yx/00app/ticket/src/data/rail-stations.generated.json)

Generated rail records now store:

- `id`
- `locationType = "station"`
- `code`
- `nameZh`
- `nameEn`
- `pinyin`
- `shortPinyin`
- `stationIndex`
- `aliases`
- `countryCode`
- `placeNameZh`
- `placeNameEn`
- `placeKey`
- `placeConfidence`
- `placeRule`

Important findings:

- rail records already have conservative place metadata
- rail records still do not have exact coordinates
- rail place metadata is derived only from station name + pinyin rules, not from a real city dataset
- the current place layer is useful for normalization, but not yet strong enough to serve as the only long-term city source of truth

### 3.3 Journey place normalization today

[src/lib/journeyPlace.ts](C:/yx/00app/ticket/src/lib/journeyPlace.ts):

- indexes generated airports and rail stations directly
- prefers airport `placeNameEn` / `municipality` and rail `placeNameZh` / `placeNameEn`
- uses airport alias overlay for Chinese airport naming
- derives airport display labels by stripping airport suffixes from Chinese labels
- returns normalized `JourneyPlace`
- falls back to raw endpoint name when no safe match exists

Important findings:

- Journey display already prefers normalized place labels when metadata exists
- the resolver still reads endpoint catalogs directly instead of reading a separate Place Catalog
- aliases are still mixed into matching and some display-adjacent logic in the same module

### 3.4 Alias usage today

Aliases are currently used mainly for search/matching:

- airport aliases come from generated airport aliases plus curated Chinese overlay
- rail aliases come from 12306 Chinese name, station-name-with-站, code, pinyin, short pinyin
- `searchLocations(...)` in [src/lib/ticketService.ts](C:/yx/00app/ticket/src/lib/ticketService.ts) searches across code, English name, Chinese name, place names, municipality, and aliases

Important design rule going forward:

- aliases are good search-only fields
- aliases should not become Journey display names directly

### 3.5 Map coordinate resolution today

Frontend:

- `searchLocations(...)` merges generated airports, airport alias overlay, generated rail stations, and legacy station seed rows
- `resolveMapPoint(...)` is still flight-only in [src/lib/ticketService.ts](C:/yx/00app/ticket/src/lib/ticketService.ts)
- web/fallback map enrichment resolves airport coordinates only

Backend/Tauri:

- `location_directory` is seeded only from [src/data/locations.seed.json](C:/yx/00app/ticket/src/data/locations.seed.json)
- `resolve_coordinates(...)` in [src-tauri/src/db.rs](C:/yx/00app/ticket/src-tauri/src/db.rs) uses:
  1. `location_directory`
  2. generated airport coordinate lookup
  3. hardcoded cases
  4. pseudo deterministic fallback

Important findings:

- frontend and backend coordinate paths are duplicated
- backend route-map resolution still does not ingest the generated rail dataset
- rail maps therefore still lack a scalable exact-coordinate path
- there is no formal city-coordinate fallback layer yet

## 4. Rail Stations And City Mapping Without Exact Coordinates

## 4.1 Short answer

Yes. Rail stations can map to cities without exact station coordinates, as long as the mapping is explicitly treated as place normalization rather than exact geography.

This is safe for:

- Journey Stops
- Journey destination display
- Journey Summary destination aggregation
- future city-level map fallback

This is not enough for:

- exact ticket-detail rail station maps
- claiming a point is the real station position

## 4.2 Fields available today for rail -> city inference

Current rail records already provide useful inputs:

- `nameZh`
- `nameEn`
- `pinyin`
- `shortPinyin`
- `aliases`
- `placeNameZh`
- `placeNameEn`
- `placeKey`
- `placeConfidence`
- `placeRule`

That means the repository can already infer city/place identity for many stations even without coordinates.

## 4.3 Conservative rules that are safe

Current conservative rules are the right MVP direction:

- curated exact mapping for known hubs
- directional suffix stripping only when both Chinese and pinyin agree
- fallback to original station name when stripping is unsafe

Safe examples:

- `青岛北 -> 青岛`
- `长沙南 -> 长沙`
- `北京南 -> 北京`
- `上海虹桥 -> 上海`
- `广州东 -> 广州`

Unsafe examples:

- `淮北` must not become `淮`
- `南宁` must not become `南`
- `西安` must not become `西`

Additional caution examples:

- names that merely end with a character matching a directional suffix but are themselves complete city names should not be stripped
- names such as airport-adjacent railway stations, districts, counties, and scenic-area stations may need curated rules later

## 4.4 Recommended confidence model

- `high`
  - curated exact mapping
  - example: `上海虹桥 -> 上海`
- `medium`
  - conservative generated rule
  - example: `青岛北 -> 青岛`
- `low`
  - fallback to original station name
  - use when safe normalization is not available

Handling uncertain stations:

- keep the original station-derived place label
- do not guess exact coordinates
- do not silently merge into a city if confidence is low

## 5. Recommended Architecture

## 5.1 Layer 1: Place Catalog

The Place Catalog should store one standard city/place record once.

Example:

```ts
type PlaceCatalogEntry = {
  placeKey: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  aliases?: string[];
  source: string;
  sourceId?: string;
  coordinatePrecision: "exact" | "city" | "approximate" | "unknown";
  confidence: "high" | "medium" | "low";
  createdAt?: string;
  updatedAt?: string;
};
```

Rules:

- this is the standard city/place layer
- aliases are search-only fields
- Journey display should use `nameZh` / `nameEn`, not raw aliases
- Chinese UI should prefer `nameZh`
- English UI should prefer `nameEn`
- if one standard label is missing, fall back to the other

## 5.2 Layer 2: Transport Location Catalog

Endpoint records should remain separate from place records.

Example:

```ts
type TransportEndpointEntry = {
  endpointType: "airport" | "rail_station";
  endpointCode?: string;
  endpointName: string;
  endpointNameZh?: string;
  endpointNameEn?: string;
  defaultJourneyPlaceKey?: string;
  exactLatitude?: number;
  exactLongitude?: number;
  exactCoordinatePrecision: "exact" | "city" | "approximate" | "unknown";
  mappingSource: string;
  mappingConfidence: "high" | "medium" | "low";
  aliases?: string[];
};
```

Rules:

- airport/station exact coordinates are endpoint geometry
- `defaultJourneyPlaceKey` is Journey meaning
- do not replace exact airport coordinates with city coordinates
- do not invent exact rail coordinates
- if exact rail coordinates are missing, city coordinates are a separate fallback

### 5.2A Rail place granularity policy

Current problem:

- the current rail `placeKey` is overloaded
- it is used for rail station metadata
- it can feed backend route-map city fallback
- it can feed Journey place normalization
- it can be persisted into Journey Stops
- it can therefore influence Journey Summary aggregation

Accepted policy:

1. map / coordinate fallback should use the most specific reviewed place that is safe and supported by the Place Catalog
2. Journey / Summary grouping should use a separate city-level or prefecture-level grouping layer later
3. grouping needs should not force map fallback to become less accurate

This means a reviewed rail place may legitimately be:

- a district
- a county
- a county-level city
- a town
- a scenic/local place
- a prefecture-level city

if that is the safest reviewed place for map fallback.

## 5.3 Layer 3: Journey Stops / Destinations

Journey-level meaning should use `placeKey`.

Rules:

- Journey Stops should store/reference `placeKey`
- `placeName` may remain denormalized display/cache text
- Summary destination aggregation should eventually aggregate by `placeKey`
- raw ticket detail can still show exact endpoint names

Important refinement:

- current `placeKey` should be treated as the reviewed place meaning for Stops/map fallback
- future Journey/Summary cleanliness should come from a separate grouping layer, not by collapsing every rail mapping to city-level now
- direct-admin municipalities should group to the municipality
- prefecture-level cities, autonomous prefectures, leagues, and equivalent regional units are the preferred future grouping level

Examples:

- `横道河子东`
  - map place may later be a more specific reviewed local place
  - Journey/Summary grouping should eventually roll up to a Mudanjiang-level grouping
- `宝坻`
  - map place may remain `Baodi`
  - Journey/Summary grouping should eventually roll up to `Tianjin`
- `怀柔`
  - map place may remain `Huairou`
  - Journey/Summary grouping should eventually roll up to `Beijing`
- `太谷`
  - map place may remain `Taigu`
  - Journey/Summary grouping should eventually roll up to `Jinzhong`
- `丹阳`
  - map place may remain `Danyang`
  - Journey/Summary grouping should eventually roll up to `Zhenjiang`

## 6. Transport Endpoint -> Place Mapping Design

Recommended mapping strategy:

1. airport endpoints map to `defaultJourneyPlaceKey` using generated airport municipality/place metadata
2. rail stations map to `defaultJourneyPlaceKey` using:
   - curated rules first
   - conservative directional stripping second
   - fallback to original station-derived place when uncertain
3. Journey runtime reads the mapped `placeKey`
4. standard place labels come from Place Catalog, not endpoint aliases

Recommended implementation boundary:

- endpoint catalogs are responsible for search + endpoint facts + default place mapping
- Place Catalog is responsible for standard labels + place-level coordinates + timezone/country/admin metadata
- future grouping logic should be responsible for city-level Journey/Summary rollups

## 7. Map Coordinate Fallback Design

Priority order:

1. exact endpoint coordinates
2. mapped place city-level coordinates
3. unknown / no point
4. pseudo fallback only as an explicit last-resort internal legacy behavior that should be phased down

Recommended precision labels:

- `exact`
  - real airport coordinates
  - future curated real rail station coordinates
- `city`
  - place-level fallback from Place Catalog
- `approximate`
  - use only if a future source is approximate rather than exact
- `unknown`
  - no safe coordinate

Why city fallback is acceptable:

- city-level fallback is honest enough for Journey meaning
- it is often good enough for MVP route context when exact rail geometry is missing
- it must not pretend to be exact station geography

Important non-goal:

- city-level grouping needs must not be solved by mass-changing reviewed rail map places to city-level
- do not remove existing district/county/town Place Catalog entries just to make Summary grouping look cleaner
- do not apply reviewed rail station overrides until the grouping policy is documented and accepted

Override policy:

- a reviewed rail override should represent the reviewed map/coordinate place
- it must not be treated as the final Journey/Summary grouping key by default
- future city-level or prefecture-level grouping belongs in a separate Journey/Summary grouping layer

Future UI implication:

- Ticket Detail maps may later distinguish exact vs city fallback if needed
- Journey maps should be able to use place-level coordinates naturally
- lower-precision points can later use subtler styling or a label note

## 8. Data Source Investigation

## 8.1 Comparison table

| Source | Provides | Multilingual | Coordinates | License / attribution | Embedded app fit | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| GeoNames | populated places, alternate names, admin info, timezone-related fields in dataset ecosystem | strong alternate-name support | yes, WGS84 | CC BY, attribution required, commercial use allowed | good for embedded place catalog if attribution is manageable | best first Place Catalog candidate |
| Wikidata | rich entity graph, labels, aliases, linked identifiers | very strong | often yes, but completeness varies | CC0 for structured data | powerful but heavier integration/query logic | enrichment / runner-up |
| OpenStreetMap | broad geo features and coordinates | community-driven names | yes | ODbL with attribution + share-alike obligations | powerful but licensing/derived-db complexity is higher | avoid as first embedded place catalog source |
| OurAirports | airport endpoint data | weak for multilingual labels by itself | yes | public domain | excellent for airport endpoints | keep as airport endpoint source |
| 12306 `station_name.js` | rail endpoint names, telecodes, pinyin | Chinese + pinyin only | no | public endpoint, redistribution status unclear | good for rail suggestion / endpoint seed only | keep as rail endpoint source, not place/geo source of truth |
| Existing curated overrides in repo | targeted Chinese names, timezones, aliases, a few coordinates | selective | selective | internal repo content | good for overlays and corrections | keep as curated overlay only |

## 8.2 GeoNames

What it provides:

- downloadable place database
- many place names and alternate names
- populated places
- WGS84 coordinates
- multiple source integrations

Strengths:

- suitable city/place dataset
- multilingual names are a good fit for UI display
- coordinates are already city-level and explicit
- practical for generating an embedded Place Catalog

Concerns:

- attribution is required
- matching/import pipeline still needs design work

Recommendation:

- strongest first candidate for a Place Catalog seed

Sources:

- [GeoNames Download / Webservice](https://www.geonames.org/export/)
- [GeoNames About](https://www.geonames.org/about.html)

## 8.3 Wikidata

What it provides:

- multilingual entity labels and aliases
- linked-data access
- REST/API/query interfaces
- many place entities with coordinates and external IDs

Strengths:

- best multilingual enrichment candidate
- very flexible identifiers and linked entities
- CC0 licensing is simpler than attribution/share-alike data sources

Concerns:

- heavier entity-graph complexity
- less practical as the first simple embedded place dataset unless we build a dedicated extraction pipeline

Recommendation:

- use as an enrichment candidate or runner-up, not the first primary source

Sources:

- [Wikidata: Data access](https://www.wikidata.org/wiki/Wikidata:Data_access)
- [Wikidata: Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)

## 8.4 OpenStreetMap

What it provides:

- extremely broad geographic features and coordinates
- strong community-maintained global coverage

Strengths:

- very powerful for exact geo work
- useful in principle for rail stations and city features

Concerns:

- ODbL attribution and share-alike obligations need careful review
- derived-database obligations are more complex than GeoNames or OurAirports
- full-planet workflows are heavy for this app's current needs

Recommendation:

- avoid as the first embedded Place Catalog source
- revisit later if exact station geo requires it and licensing/derivative handling is fully understood

Sources:

- [OpenStreetMap Copyright and License](https://www.openstreetmap.org/copyright)
- [Planet.osm](https://wiki.openstreetmap.org/wiki/Planet.osm)

## 8.5 OurAirports

What it provides:

- airport endpoint names
- codes
- municipality
- country/region
- coordinates

Strengths:

- public-domain data
- easy regeneration
- already integrated in this repository
- very good endpoint dataset for airports

Limitations:

- not a true place catalog by itself
- does not provide app-ready multilingual city labels
- airport municipality strings are useful, but Journey place semantics still need a separate place layer

Recommendation:

- keep as airport endpoint source
- do not treat it as the only source of Journey place semantics

Source:

- [OurAirports data](https://ourairports.com/data/)

## 8.6 12306 `station_name.js`

What it provides:

- station telecodes
- Chinese station names
- pinyin / short pinyin

Strengths:

- excellent for rail suggestion search
- already wired into repository generation
- good base for conservative station -> place mapping

Limitations:

- no coordinates
- no explicit city dataset
- redistribution/license status remains unclear from the current repository review

Recommendation:

- keep as rail endpoint source
- do not use as the primary exact-geo or city-catalog source

Current repository source reference:

- [docs/DATA_SOURCES.md](C:/yx/00app/ticket/docs/DATA_SOURCES.md)

## 9. Recommended Source Strategy

Recommended first strategy:

- primary Place Catalog source: GeoNames or a similar city/place dataset
- multilingual enrichment / validation: Wikidata later if needed
- airport endpoint source: keep OurAirports
- rail endpoint source: keep 12306 `station_name.js`
- curated overlay: keep current repo overrides for special cases, Chinese airport labels, and future manual corrections

Why this is the safest next step:

- it cleanly separates place semantics from transport endpoint semantics
- it gives city-level coordinates without pretending rail stations are exactly geocoded
- it keeps exact rail coordinates as a later, independent task

## 10. Relationship To Journey Stops

Place Catalog should become the stable identity layer for Stops work.

Rules:

- `journey_stops.placeKey` should remain the stable identity
- `placeName` may remain denormalized cache/display text
- auto-derived stops should use endpoint -> `defaultJourneyPlaceKey`
- user-edited stops must continue to be preserved
- when linked tickets change, future UI should review/regenerate auto stops without overwriting user edits
- Summary top destinations should eventually aggregate by `placeKey`, not by raw string

## 11. TypeScript / Rust Compatibility Direction

Recommended future shared shape:

```ts
type PlaceKey = string;

type PlaceCatalogEntry = {
  placeKey: PlaceKey;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  aliases?: string[];
  source: string;
  sourceId?: string;
  coordinatePrecision: "exact" | "city" | "approximate" | "unknown";
  confidence: "high" | "medium" | "low";
  createdAt?: string;
  updatedAt?: string;
};

type TransportEndpointCatalogEntry = {
  endpointType: "airport" | "rail_station";
  endpointCode?: string;
  endpointName: string;
  endpointNameZh?: string;
  endpointNameEn?: string;
  defaultJourneyPlaceKey?: PlaceKey;
  exactLatitude?: number;
  exactLongitude?: number;
  exactCoordinatePrecision: "exact" | "city" | "approximate" | "unknown";
  mappingSource: string;
  mappingConfidence: "high" | "medium" | "low";
  aliases?: string[];
};
```

Rust direction:

- keep the same field semantics in `models.rs` when runtime work begins
- do not persist `createdAt` / `updatedAt` until a DB-backed Place Catalog is actually chosen

## 12. Recommended Implementation Sequence

Recommended next safe order:

1. `PLACE-CATALOG-AND-RAIL-GEO-DESIGN-001`
2. `PLACE-CATALOG-001`
   - add generated/curated Place Catalog model and initial seed/generation path
3. `TRANSPORT-PLACE-MAPPING-001`
   - map airport and rail endpoint catalogs to `defaultJourneyPlaceKey`
4. `MAP-CITY-FALLBACK-001`
   - allow map coordinate resolver to use Place Catalog city coordinates when exact endpoint coordinates are unavailable, with precision marked as `city`
5. `JOURNEY-STOPS-AUTO-002`
   - rebuild auto-stop derivation on stable `placeKey`
6. `JOURNEY-STOPS-UI-001`
   - let users review/edit stops
7. `JOURNEY-SUMMARY-STOPS-001`
   - aggregate destinations by persisted stops / `placeKey`
8. `TRAIN-STATION-GEO-001`
   - add exact rail station coordinates later

Why exact rail geo is later:

- city/place semantics unblock more product value first
- exact rail geo has higher source and licensing complexity
- current MVP can already improve Journey meaning before exact rail coordinates exist

## 13. Current Recommendation

The next implementation task should be `PLACE-CATALOG-001`.

Follow-up after that should be `TRANSPORT-PLACE-MAPPING-001`.

This order is safer than jumping directly into exact rail coordinates because:

- the repository already has partial place metadata fragments
- the bigger missing piece is a formal standard Place Catalog layer
- city-level coordinate fallback can provide honest, lower-precision map value before exact rail geometry is solved

