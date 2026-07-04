import { describe, expect, it } from "vitest";
import placeCatalog from "../src/data/place-catalog.generated.json";
import railStations from "../src/data/rail-stations.generated.json";
import {
  applyRailStationPlaceOverrides,
  validateRailStationPlaceOverrides,
} from "../scripts/lib/rail-station-place-overrides.mjs";
import {
  buildRailPlaceCatalogResolver,
  resolveRailStationPlace,
} from "../scripts/lib/rail-station-place-coverage.mjs";
import transportPlaceData from "../src/data/transport-place.generated.json";
import type { LocationDirectoryEntry } from "../src/types/ticket";
import type { PlaceCatalogEntry } from "../src/types/placeCatalog";

const stations = railStations as LocationDirectoryEntry[];
const places = placeCatalog as PlaceCatalogEntry[];

describe("rail station place overrides", () => {
  it("does not apply needs_review or disabled overrides", () => {
    const sampleStation = {
      code: "ZZ1",
      nameZh: "测试东",
      placeKey: "cn-test-city",
      placeNameZh: "测试城",
      placeNameEn: "Testcity",
      placeConfidence: "low",
      placeRule: "fallback:original-station-name",
    };
    const samplePlaceCatalog = [
      {
        placeKey: "cn-reviewed-city",
        nameZh: "已审核城",
        nameEn: "Reviewedcity",
      },
    ];
    const overrides = [
      {
        id: "pending-1",
        enabled: true,
        scope: "telecode",
        telecode: "ZZ1",
        reviewedPlaceKey: "cn-reviewed-city",
        reviewStatus: "needs_review",
      },
      {
        id: "disabled-1",
        enabled: false,
        scope: "telecode",
        telecode: "ZZ1",
        reviewedPlaceKey: "cn-reviewed-city",
        reviewStatus: "approved",
      },
    ];

    const result = applyRailStationPlaceOverrides([sampleStation], overrides, samplePlaceCatalog);
    expect(result.appliedCount).toBe(0);
    expect(result.stations[0].placeKey).toBe("cn-test-city");
  });

  it("applies an approved override to an existing place key", () => {
    const sampleStation = {
      code: "ZZ2",
      nameZh: "测试西",
      placeKey: "cn-test-west",
      placeNameZh: "测试西",
      placeNameEn: "Testwest",
      placeConfidence: "low",
      placeRule: "fallback:original-station-name",
    };
    const samplePlaceCatalog = [
      {
        placeKey: "cn-reviewed-west",
        nameZh: "审核西城",
        nameEn: "Reviewedwest",
      },
    ];
    const overrides = [
      {
        id: "approved-1",
        enabled: true,
        scope: "telecode",
        telecode: "ZZ2",
        reviewedPlaceKey: "cn-reviewed-west",
        reviewStatus: "approved",
      },
    ];

    const result = applyRailStationPlaceOverrides([sampleStation], overrides, samplePlaceCatalog);
    expect(result.appliedCount).toBe(1);
    expect(result.stations[0].placeKey).toBe("cn-reviewed-west");
    expect(result.stations[0].placeNameZh).toBe("审核西城");
    expect(result.stations[0].placeRule).toContain("reviewed-override");
  });

  it("rejects approved overrides pointing to missing place keys", () => {
    const sampleStation = {
      code: "ZZ3",
      nameZh: "测试南",
      placeKey: "cn-test-south",
      placeNameZh: "测试南",
      placeNameEn: "Testsouth",
      placeConfidence: "low",
      placeRule: "fallback:original-station-name",
    };
    const result = validateRailStationPlaceOverrides(
      [
        {
          id: "bad-place",
          enabled: true,
          scope: "telecode",
          telecode: "ZZ3",
          reviewedPlaceKey: "cn-missing",
          reviewStatus: "approved",
        },
      ],
      [sampleStation],
      [],
    );

    expect(result.errors.some((error) => error.includes("missing Place Catalog key"))).toBe(true);
  });

  it("detects conflicting approved overrides for the same station", () => {
    const sampleStation = {
      code: "ZZ4",
      nameZh: "测试北",
      placeKey: "cn-test-north",
      placeNameZh: "测试北",
      placeNameEn: "Testnorth",
      placeConfidence: "low",
      placeRule: "fallback:original-station-name",
    };
    const samplePlaceCatalog = [
      { placeKey: "cn-place-a", nameZh: "城市A", nameEn: "CityA" },
      { placeKey: "cn-place-b", nameZh: "城市B", nameEn: "CityB" },
    ];
    const result = validateRailStationPlaceOverrides(
      [
        {
          id: "override-a",
          enabled: true,
          scope: "telecode",
          telecode: "ZZ4",
          reviewedPlaceKey: "cn-place-a",
          reviewStatus: "approved",
        },
        {
          id: "override-b",
          enabled: true,
          scope: "stationNameZh",
          stationNameZh: "测试北",
          reviewedPlaceKey: "cn-place-b",
          reviewStatus: "approved",
        },
      ],
      [sampleStation],
      samplePlaceCatalog,
    );

    expect(result.errors.some((error) => error.includes("matches multiple approved overrides"))).toBe(true);
  });

  it("keeps KUX unresolved without an approved override", () => {
    const resolver = buildRailPlaceCatalogResolver(places);
    const station = stations.find((entry) => entry.code === "KUX");
    expect(station).toBeDefined();

    const resolution = resolveRailStationPlace(station, resolver, { transportPlaceData });
    expect(resolution.status).toBe("unresolved");
  });

  it("keeps representative resolved stations stable", () => {
    const resolver = buildRailPlaceCatalogResolver(places);
    const vab = stations.find((entry) => entry.code === "VAB");
    const txp = stations.find((entry) => entry.code === "TXP");

    expect(resolveRailStationPlace(vab, resolver, { transportPlaceData }).canonicalPlaceKey).toBe("cn-harbin");
    expect(resolveRailStationPlace(txp, resolver, { transportPlaceData }).canonicalPlaceKey).toBe("cn-tianjin");
  });

  it("applies reviewed mixed-row repairs to exact telecodes only", () => {
    const paW = stations.find((entry) => entry.code === "PAW");
    const fdt = stations.find((entry) => entry.code === "FDT");
    const fey = stations.find((entry) => entry.code === "FEY");
    const kyt = stations.find((entry) => entry.code === "KYT");

    expect(paW?.placeKey).toBe("cn-nanchong");
    expect(fdt?.placeKey).toBe("cn-fengcheng-19");
    expect(fey?.placeKey).toBe("cn-yan-an");
    expect(kyt?.placeKey).toBe("cn-kaiyuan-19");
  });
});
