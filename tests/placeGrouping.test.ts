import { describe, expect, it } from "vitest";
import { buildPlaceGroupingEntries } from "../scripts/lib/place-grouping-data.mjs";
import { getSummaryGroupingForPlaceKey, resolveSummaryPlaceKey } from "../src/lib/placeGrouping";

describe("place grouping data layer", () => {
  it("returns reviewed summary grouping for a seeded place key", () => {
    expect(getSummaryGroupingForPlaceKey("cn-danyang")).toMatchObject({
      placeKey: "cn-danyang",
      summaryPlaceKey: "cn-zhenjiang",
      groupingLevel: "prefecture",
      groupingSource: "reviewed",
    });
    expect(resolveSummaryPlaceKey("cn-hailin")).toBe("cn-mudanjiang");
  });

  it("returns null safely when no summary grouping exists", () => {
    expect(getSummaryGroupingForPlaceKey("cn-harbin")).toBeNull();
    expect(resolveSummaryPlaceKey("cn-harbin")).toBeNull();
  });

  it("fails validation for duplicate place keys", () => {
    const placeCatalogIndex = new Map([
      ["cn-danyang", { placeKey: "cn-danyang", nameZh: "??", nameEn: "Danyang" }],
      ["cn-zhenjiang", { placeKey: "cn-zhenjiang", nameZh: "??", nameEn: "Zhenjiang" }],
    ]);

    expect(() =>
      buildPlaceGroupingEntries(
        [
          { placeKey: "cn-danyang", summaryPlaceKey: "cn-zhenjiang", groupingLevel: "prefecture" },
          { placeKey: "cn-danyang", summaryPlaceKey: "cn-zhenjiang", groupingLevel: "prefecture" },
        ],
        placeCatalogIndex,
      ),
    ).toThrow(/Duplicate place grouping placeKey/);
  });

  it("fails validation when summary place is invalid or self-referential", () => {
    const placeCatalogIndex = new Map([
      ["cn-danyang", { placeKey: "cn-danyang", nameZh: "??", nameEn: "Danyang" }],
      ["cn-zhenjiang", { placeKey: "cn-zhenjiang", nameZh: "??", nameEn: "Zhenjiang" }],
    ]);

    expect(() =>
      buildPlaceGroupingEntries(
        [{ placeKey: "cn-danyang", summaryPlaceKey: "cn-danyang", groupingLevel: "prefecture" }],
        placeCatalogIndex,
      ),
    ).toThrow(/cannot group cn-danyang to itself/);

    expect(() =>
      buildPlaceGroupingEntries(
        [{ placeKey: "cn-danyang", summaryPlaceKey: "cn-missing", groupingLevel: "prefecture" }],
        placeCatalogIndex,
      ),
    ).toThrow(/unknown summaryPlaceKey: cn-missing/);
  });
});
