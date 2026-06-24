import { describe, expect, it } from "vitest";
import railStations from "../src/data/rail-stations.generated.json";
import placeCatalog from "../src/data/place-catalog.generated.json";
import transportPlaceData from "../src/data/transport-place.generated.json";
import {
  buildRailPlaceCatalogResolver,
  buildRailStationPlaceCoverageReport,
  resolveRailStationPlace,
} from "../scripts/lib/rail-station-place-coverage.mjs";

describe("rail station place coverage", () => {
  it("parses generated rail station and place catalog fixtures", () => {
    expect(Array.isArray(railStations)).toBe(true);
    expect(railStations.length).toBeGreaterThan(3000);
    expect(Array.isArray(placeCatalog)).toBe(true);
    expect(placeCatalog.length).toBeGreaterThan(1000);
    expect(Object.keys(transportPlaceData.railStations ?? {})).toHaveLength(
      Object.keys(transportPlaceData.railStations ?? {}).length,
    );
  });

  it("builds a full coverage report with unresolved review rows", () => {
    const report = buildRailStationPlaceCoverageReport(railStations, placeCatalog, { transportPlaceData });

    expect(report.summary.totalStations).toBe(railStations.length);
    expect(report.summary.withPlaceKey).toBeGreaterThan(0);
    expect(report.summary.validPlaceKeyCount).toBeGreaterThan(0);
    expect(report.summary.unresolvedReviewCount).toBeGreaterThan(0);
    expect(report.reviewRows.length).toBeGreaterThan(0);
    expect(report.topMissingPlaceKeys.length).toBeGreaterThan(0);
  });

  it("resolves a representative valid exact mapping for Tianjin West", () => {
    const resolver = buildRailPlaceCatalogResolver(placeCatalog);
    const station = railStations.find((entry) => entry.code === "TXP");
    expect(station).toBeDefined();

    const resolution = resolveRailStationPlace(station, resolver, { transportPlaceData });
    expect(resolution.status).toBe("resolved");
    expect(resolution.canonicalPlaceKey).toBe("cn-tianjin");
  });

  it("canonicalizes Harbin West to the canonical Harbin place key", () => {
    const resolver = buildRailPlaceCatalogResolver(placeCatalog);
    const station = railStations.find((entry) => entry.code === "VAB");
    expect(station).toBeDefined();

    const resolution = resolveRailStationPlace(station, resolver, { transportPlaceData });
    expect(resolution.status).toBe("resolved");
    expect(resolution.canonicalPlaceKey).toBe("cn-harbin");
  });

  it("keeps unresolved stations in the review flow when no place catalog city exists", () => {
    const resolver = buildRailPlaceCatalogResolver(placeCatalog);
    const station = railStations.find((entry) => entry.code === "KUX");
    expect(station).toBeDefined();

    const resolution = resolveRailStationPlace(station, resolver, { transportPlaceData });
    expect(resolution.status).toBe("unresolved");

    const report = buildRailStationPlaceCoverageReport(railStations, placeCatalog, { transportPlaceData });
    expect(report.reviewRows.some((row) => row.telecode === "KUX")).toBe(true);
  });
});
