import { describe, expect, it } from "vitest";
import placeCatalogData from "../src/data/place-catalog.generated.json";
import {
  getPlaceByGeoNameId,
  getPlaceByKey,
  getPlaceDisplayName,
  getPlaceDisplayNameByKey,
  searchPlaceCatalog,
} from "../src/lib/placeCatalog";
import type { PlaceCatalogEntry } from "../src/types/placeCatalog";

const places = placeCatalogData as PlaceCatalogEntry[];

function comparePlaceSortOrder(left: PlaceCatalogEntry, right: PlaceCatalogEntry) {
  return (
    left.countryCode.localeCompare(right.countryCode, "en") ||
    (left.nameEn || left.asciiName || left.nameZh || "").localeCompare(
      right.nameEn || right.asciiName || right.nameZh || "",
      "en",
    ) ||
    left.geonameId - right.geonameId
  );
}

describe("placeCatalog", () => {
  it("contains key representative places from the generated GeoNames catalog", () => {
    expect(getPlaceByKey("jp-tokyo")).toBeDefined();
    expect(getPlaceByKey("jp-osaka")).toBeDefined();
    expect(getPlaceByKey("cn-qingdao")).toBeDefined();
    expect(getPlaceByKey("cn-changsha")).toBeDefined();
    expect(getPlaceByKey("au-sydney")).toBeDefined();
    expect(getPlaceByKey("au-melbourne")).toBeDefined();
  });

  it("can look up places by key and geoname id", () => {
    const tokyo = getPlaceByKey("jp-tokyo");

    expect(tokyo).toBeDefined();
    expect(getPlaceByGeoNameId(tokyo!.geonameId)).toEqual(tokyo);
  });

  it("returns expected display names for representative places", () => {
    expect(getPlaceDisplayNameByKey("jp-tokyo", "en")).toBe("Tokyo");
    expect(getPlaceDisplayNameByKey("jp-tokyo", "zh")).toBeTruthy();
    expect(getPlaceDisplayNameByKey("jp-osaka", "en")).toBe("Osaka");
    expect(getPlaceDisplayNameByKey("cn-qingdao", "en")).toBe("Qingdao");
    expect(getPlaceDisplayNameByKey("cn-changsha", "en")).toBe("Changsha");
    expect(getPlaceDisplayNameByKey("au-sydney", "zh")).toBeTruthy();
    expect(getPlaceDisplayNameByKey("au-melbourne", "zh")).toBeTruthy();
  });

  it("uses only standard labels for display and never aliases directly", () => {
    const place: PlaceCatalogEntry = {
      placeKey: "test-place",
      geonameId: 1,
      nameEn: "Standard English",
      asciiName: "Standard English",
      countryCode: "AU",
      latitude: 1,
      longitude: 1,
      aliases: ["Alias only"],
      source: "geonames",
      sourceId: "1",
      coordinatePrecision: "city",
      confidence: "high",
    };

    expect(getPlaceDisplayName(place, "en")).toBe("Standard English");
    expect(getPlaceDisplayName(place, "zh")).toBe("Standard English");
  });

  it("falls back safely when a preferred language label is missing", () => {
    const place: PlaceCatalogEntry = {
      placeKey: "fallback-place",
      geonameId: 2,
      asciiName: "Fallback City",
      countryCode: "AU",
      latitude: 1,
      longitude: 1,
      source: "geonames",
      sourceId: "2",
      coordinatePrecision: "city",
      confidence: "medium",
    };

    expect(getPlaceDisplayName(place, "en")).toBe("Fallback City");
    expect(getPlaceDisplayName(place, "zh")).toBe("Fallback City");
  });

  it("keeps placeKey and geonameId unique across the generated catalog", () => {
    const placeKeys = new Set<string>();
    const geonameIds = new Set<number>();

    places.forEach((place) => {
      expect(placeKeys.has(place.placeKey)).toBe(false);
      expect(geonameIds.has(place.geonameId)).toBe(false);
      placeKeys.add(place.placeKey);
      geonameIds.add(place.geonameId);
    });
  });

  it("keeps the generated catalog in deterministic sort order", () => {
    for (let index = 1; index < places.length; index += 1) {
      expect(comparePlaceSortOrder(places[index - 1]!, places[index]!)).toBeLessThanOrEqual(0);
    }
  });

  it("can search by English and Chinese place names", () => {
    const tokyoResults = searchPlaceCatalog("Tokyo");
    const qingdaoResults = searchPlaceCatalog("\u9752\u5c9b");

    expect(tokyoResults.some((place) => place.placeKey === "jp-tokyo")).toBe(true);
    expect(qingdaoResults.some((place) => place.placeKey === "cn-qingdao")).toBe(true);
  });
});
