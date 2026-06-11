# LOCATION DIRECTORY DESIGN

## Status

- Task: `LOCATION-DIRECTORY-DESIGN-001`
- Type: docs-only architecture/design
- Runtime integration: not started

## 1. Purpose

This document defines the future unified location-directory direction for airports, rail stations, place normalization, and coordinate resolution.

It exists to prevent the project from drifting into separate frontend and backend location behaviors before the following tasks begin:

- `JOURNEY-PLACE-001`
- `TRAIN-STATION-GEO-001`
- future Journey Stops runtime work
- future rail map improvements

No provider, runtime, schema, or UI changes are introduced by this document.

## 2. Current Problem Summary

The repository currently resolves location data through multiple partially overlapping paths:

- frontend generated airport/station data for search suggestions
- frontend airport-only fallback coordinate lookup
- backend `location_directory` rows seeded from the small `locations.seed.json`
- backend hardcoded coordinate special cases
- backend pseudo/fallback coordinates when no real match exists

This means the same airport or station can behave differently depending on whether the user is:

- searching in `TicketForm`
- saving a ticket
- loading a route map through Tauri
- deriving future Journey-level places

Current airport behavior is better only because airports already have generated latitude/longitude data plus multiple fallback paths.
Current rail behavior is weaker because the generated rail dataset has no coordinates and no city/place metadata.

## 3. Current Coordinate Paths

### 3.1 Frontend suggestion path

`src/lib/ticketService.ts` loads location suggestions from frontend data files:

- `src/data/airports.generated.json`
- `src/data/rail-stations.generated.json`
- `src/data/airport-aliases.zh-CN.ts`
- `src/data/locations.seed.json`

This path powers `TicketForm` search and filtering.

### 3.2 Frontend coordinate fallback path

`resolveMapPoint(...)` in `src/lib/ticketService.ts` currently resolves coordinates only for flight/airport endpoints.
Rail endpoints return `null` here.

### 3.3 Backend/Tauri coordinate path

`src-tauri/src/db.rs` resolves map coordinates through:

1. `location_directory` lookup
2. hardcoded code/name special cases
3. pseudo/fallback coordinates

The backend `location_directory` is seeded from `src/data/locations.seed.json`, which is currently only a small starter dataset and not the same thing as the generated airport or rail datasets.

### 3.4 RouteMap responsibility

`src/components/RouteMap.tsx` renders already resolved `MapPointPayload` data.
It should not be responsible for guessing, normalizing, or inventing coordinates.

## 4. Current Data Reality

### 4.1 Airports

Generated airport data already includes:

- `code`
- `nameEn`
- `aliases`
- `latitude`
- `longitude`
- `countryCode`

However, municipality/city is not persisted as a first-class generated field even though upstream airport source data contains municipality values.

### 4.2 Rail stations

Generated rail station data currently includes:

- telecode / `code`
- `nameZh`
- pinyin / `nameEn`
- `shortPinyin`
- `aliases`
- `countryCode`

It currently does not include:

- latitude/longitude
- city/place metadata
- normalized `placeKey`

This is the main reason rail suggestions are broad while rail mapping and Journey-place normalization remain weak.

## 5. Recommended Source Of Truth Direction

The long-term source of truth should be one shared location-directory pipeline used by both:

- frontend suggestion/search UX
- backend/Tauri coordinate resolution and future place normalization

Recommended direction:

1. Keep generated airport and rail source files as upstream inputs, not as separate runtime truths.
2. Build a unified derived location-directory artifact or generation path from those inputs plus small curated overlays.
3. Use the same normalized location records for:
   - frontend suggestions
   - backend lookup
   - Journey place normalization
   - future rail/airport map improvements
4. Treat `locations.seed.json` as a temporary bootstrap/curated overlay, not the final primary runtime directory.

### 5.1 How `locations.seed.json` should evolve

Recommended future role:

- small curated overlay for manual corrections, aliases, or edge cases
- possible fixture/bootstrap source for tests or migration support
- not the only backend runtime source of coordinate truth

In other words, the backend should eventually stop depending on a tiny manual seed while the frontend depends on much larger generated datasets.

## 6. Frontend vs Backend Responsibilities

### 6.1 Frontend responsibilities

Frontend should own:

- search suggestions
- user-facing labels
- form selection UX
- lightweight filtering by transport type
- `RouteMap` rendering from already resolved map payloads

Frontend should not own:

- authoritative coordinate resolution
- durable place normalization logic
- guessed route coordinates for rail endpoints

### 6.2 Backend/Tauri responsibilities

Backend/Tauri should own:

- desktop coordinate resolution
- route map payload generation
- `location_directory` lookup
- fallback behavior
- future durable coordinate/place metadata use

### 6.3 Important boundaries

- `RouteMap` should not guess coordinates.
- Tickets do not need to store latitude/longitude by default.
- Future map payloads should prefer backend-resolved coordinates whenever desktop runtime is available.

## 7. Ticket Location Persistence Direction

Current `TicketLocation` fields are still acceptable for now:

- `name`
- optional `code`
- optional `timezone`

Recommended future direction:

- keep raw endpoint data unchanged for ticket fidelity
- do not replace user-entered/stored endpoint text with normalized place labels at save time
- consider adding optional stable references later only when the location directory is ready

Potential future optional reference fields:

- `locationType`
- `source`
- `code`
- `placeKey`

These should remain optional future metadata, not a prerequisite for current ticket CRUD.

## 8. Airport Data Improvement Plan

The airport pipeline should be improved before Journey-level place normalization depends on it.

Recommended future generated airport fields:

- `municipality` or equivalent city/place field
- optional `displayNameZh`
- optional `displayNameEn`
- optional normalized `placeKey`
- optional normalized place labels
- optional timezone only if safely sourced or derived later

Recommended rule:

- airport coordinates remain transport-endpoint precision
- airport municipality/place metadata supports Journey-level place normalization

This allows airports such as Qingdao Jiaodong to map both to:

- exact airport coordinates for ticket route maps
- shared city/place identity for Journey destinations and Stops

## 9. Rail Station Place / Geo Plan

Rail should be staged instead of trying to solve place metadata and exact coordinates in one step.

### 9.1 Stage A: place metadata first

Add a station-to-place metadata layer that can support:

- normalized `placeKey`
- city/place labels
- bilingual display labels where available later
- Journey destination and Stop normalization

This stage does not require exact station coordinates.

### 9.2 Stage B: coordinates later

After place normalization is stable, add safe rail coordinates through a curated source or overlay.

Coordinate options may include:

- station-level exact coordinates where confidently sourced
- city/place-level coordinates when exact station coordinates are unavailable

### 9.3 Rules

- do not invent fake nationwide exact rail coordinates
- keep licensing and redistribution review documented
- keep low-confidence station metadata visibly distinct from high-confidence airport metadata

## 10. Coordinate Precision Rules

Different features need different precision levels.

### 10.1 Exact coordinates

Use for:

- airport route maps
- rail endpoint maps only when real station coordinates are available

### 10.2 City/place-level coordinates

Use for:

- Journey Stops
- Journey destination normalization
- future Journey map layers where place meaning matters more than exact terminal/station placement

### 10.3 Fallback pseudo coordinates

Fallback pseudo coordinates should remain last resort only.

Recommended rules:

- do not treat them as accurate geography
- do not use them as the desired long-term rail solution
- prefer showing no precise rail point over pretending a guessed point is exact

## 11. Proposed Future Unified Record Shape

Documentation-only conceptual shape:

```ts
type LocationDirectoryEntry = {
  id: string;
  locationType: "airport" | "rail_station" | "city_place" | "manual";
  code?: string;
  name: string;
  nameZh?: string;
  nameEn?: string;
  aliases?: string[];
  placeKey?: string;
  placeNameZh?: string;
  placeNameEn?: string;
  countryCode?: string;
  regionName?: string;
  latitude?: number;
  longitude?: number;
  coordinatePrecision?: "exact" | "city" | "fallback" | "unknown";
  source: string;
};
```

Notes:

- This is a design target, not a code change.
- `source` should record where the record comes from, such as generated airport data, rail overlay, or manual curated override.
- `coordinatePrecision` is important because airport exact points and city-level rail points should not be treated as equivalent.

## 12. Relationship To `JOURNEY-PLACE-001`

`JOURNEY-PLACE-001` should depend on the future location-directory layer rather than hardcoding airport/station normalization separately.

Recommended rules:

- raw ticket endpoint data stays unchanged
- Journey display uses normalized place labels
- UI language controls the preferred label
- future bilingual display can remain optional
- airports normalize through municipality/city/place metadata
- rail stations normalize through station-to-place metadata
- when confidence is low, fall back to the original endpoint label

Target outcome example:

- Qingdao Jiaodong Airport
- Qingdao North Railway Station

should be able to share:

- `placeKey = qingdao`

once the metadata layer supports that mapping.

## 13. Relationship To Journey Stops

Future Journey Stops work should build on normalized place identities, not raw transport endpoint strings alone.

That means:

- `JOURNEY-STOPS-DATA-001` should depend on accepted place normalization rules
- auto-derived Stops should consume shared place keys/labels
- Journey Summary destination logic should eventually move toward normalized Stops instead of raw endpoint heuristics

This reduces the risk that airport names, rail station names, and mixed-language labels all fragment into different pseudo-destinations.

## 14. Recommended Future Task Sequence

Smallest safe sequence:

1. `LOCATION-DIRECTORY-DESIGN-001`
2. `LOCATION-DIRECTORY-001`
   - preserve airport municipality/city/place metadata
   - move desktop coordinate resolution toward the shared generated directory path
3. `RAIL-STATION-PLACE-001`
   - add station-to-place metadata without promising exact rail coordinates yet
4. `JOURNEY-PLACE-001`
   - normalize airport/station endpoints into Journey-level place labels
5. `TRAIN-STATION-GEO-001`
   - add safe rail coordinates for map use after place metadata is accepted
6. `JOURNEY-STOPS-DATA-001`
7. `JOURNEY-STOPS-AUTO-001`
8. `JOURNEY-STOPS-UI-001`
9. `JOURNEY-SUMMARY-STOPS-001`

## 15. Explicit Non-Goals Of This Task

This task does not:

- implement runtime location-directory changes
- change Tauri commands
- change database schema
- add a new dataset
- download new data
- change the UI
- solve train station coordinates immediately

## 16. Current Recommendation

The next safest implementation task is `LOCATION-DIRECTORY-001`.

Why this should come before `JOURNEY-PLACE-001`:

- airport municipality/place metadata is still missing from the generated first-class record shape
- backend coordinate resolution still does not share the same main runtime source as frontend suggestions
- Journey normalization should not be built on top of today's split data model

After that, `RAIL-STATION-PLACE-001` should define the first usable rail place layer before exact rail coordinates are attempted.
