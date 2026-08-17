import { describe, expect, it } from "vitest";
import placeCatalog from "../src/data/place-catalog.generated.json";
import railStations from "../src/data/rail-stations.generated.json";
import { readRailGeonamesCandidateReviewCsv } from "../scripts/lib/rail-geonames-review.mjs";
import { readRailStationPlaceOverrides } from "../scripts/lib/rail-station-place-overrides.mjs";
import type { PlaceCatalogEntry } from "../src/types/placeCatalog";
import type { LocationDirectoryEntry } from "../src/types/ticket";

const places = placeCatalog as PlaceCatalogEntry[];
const stations = railStations as LocationDirectoryEntry[];

describe("rail-needed China GeoNames expansion", () => {
  it("represents nearly all safe auto-add review candidates in the generated Place Catalog", async () => {
    const rows = await readRailGeonamesCandidateReviewCsv("data-sources/rail/rail-geonames-reviewed-safe-matches.json");
    const autoAddRows = rows.filter((row) => row.recommendedAction === "can_auto_add_place");
    const placesByGeonameId = new Map(places.map((place) => [String(place.geonameId), place]));

    const appliedCount = autoAddRows.filter((row) =>
      row.candidateGeonameIdList.every((geonameId) => placesByGeonameId.has(String(geonameId))),
    ).length;

    expect(appliedCount).toBeGreaterThanOrEqual(250);

    autoAddRows
      .flatMap((row) => row.candidateGeonameIdList)
      .filter((geonameId) => placesByGeonameId.has(String(geonameId)))
      .forEach((geonameId) => {
        const place = placesByGeonameId.get(String(geonameId));
        expect(place?.source).toBe("geonames");
        expect(place?.coordinatePrecision).toBe("city");
      });
  });

  it("applies every safe existing-catalog canonicalization review row to the generated rail stations", async () => {
    const rows = await readRailGeonamesCandidateReviewCsv("data-sources/rail/rail-geonames-reviewed-safe-matches.json");
    const overrides = await readRailStationPlaceOverrides("data-sources/rail/rail-station-place-overrides.json");
    const canonicalizeRows = rows.filter(
      (row) => row.recommendedAction === "can_canonicalize_to_existing_catalog",
    );
    const approvedTelecodeOverrides = new Map(
      overrides
        .filter((override) => override.reviewStatus === "approved" && override.scope === "telecode")
        .map((override) => [override.telecode, override.reviewedPlaceKey]),
    );

    expect(canonicalizeRows.length).toBeGreaterThan(0);

    canonicalizeRows.forEach((row) => {
      const expectedPlaceKey = row.candidateExistingPlaceKeyList?.[0] || row.candidateExistingPlaceKey;
      expect(expectedPlaceKey).toBeTruthy();

      row.sampleTelecodeList.forEach((telecode) => {
        const station = stations.find((entry) => entry.code === telecode);
        expect(station).toBeDefined();
        // Generator order is canonicalization followed by an approved, more
        // specific telecode repair. The latter must deliberately win.
        const expectedFinalPlaceKey = approvedTelecodeOverrides.get(telecode) || expectedPlaceKey;
        expect(station?.placeKey).toBe(expectedFinalPlaceKey);
      });
    });
  });
});
