import { describe, expect, it } from "vitest";
import generatedAirports from "../src/data/airports.generated.json";
import placeCatalog from "../src/data/place-catalog.generated.json";
import generatedRailStations from "../src/data/rail-stations.generated.json";
import transportPlaceMapping from "../src/data/transport-place.generated.json";
import { normalizeJourneyPlaceFromLocation } from "../src/lib/journeyPlace";
import { getTransportPlaceMapping } from "../src/lib/transportPlaceMapping";
import type { PlaceCatalogEntry } from "../src/types/placeCatalog";
import type { LocationDirectoryEntry, TicketLocation } from "../src/types/ticket";
import type { TransportPlaceMappingData } from "../src/types/transportPlace";

function makeLocation(name: string, code?: string): TicketLocation {
  return {
    name,
    code,
    timezone: "Asia/Shanghai",
  };
}

const AIRPORTS = generatedAirports as LocationDirectoryEntry[];
const RAIL_STATIONS = generatedRailStations as LocationDirectoryEntry[];
const PLACES = placeCatalog as PlaceCatalogEntry[];
const MAPPING = transportPlaceMapping as TransportPlaceMappingData;

describe("transportPlaceMapping", () => {
  it("references only existing place catalog keys", () => {
    const placeKeys = new Set(PLACES.map((place) => place.placeKey));

    Object.values(MAPPING.airports).forEach((mapping) => {
      expect(placeKeys.has(mapping.defaultJourneyPlaceKey)).toBe(true);
    });

    Object.values(MAPPING.railStations).forEach((mapping) => {
      expect(placeKeys.has(mapping.defaultJourneyPlaceKey)).toBe(true);
    });
  });

  it("maps common airport endpoints to stable place keys", () => {
    expect(MAPPING.airports.TAO).toMatchObject({
      defaultJourneyPlaceKey: "cn-qingdao",
    });
    expect(MAPPING.airports.CSX).toMatchObject({
      defaultJourneyPlaceKey: "cn-changsha",
    });
    expect(MAPPING.airports.KIX).toMatchObject({
      defaultJourneyPlaceKey: "jp-osaka",
    });
    expect(MAPPING.airports.HND).toMatchObject({
      defaultJourneyPlaceKey: "jp-tokyo",
    });
    expect(MAPPING.airports.NRT).toMatchObject({
      defaultJourneyPlaceKey: "jp-narita",
    });
    expect(getTransportPlaceMapping("airport", "TAO")).toMatchObject({
      defaultJourneyPlaceNameEn: "Qingdao",
      defaultJourneyPlaceNameZh: "青岛市",
    });
  });

  it("maps common rail endpoints to the same city place key as airport endpoints when supported", () => {
    expect(MAPPING.railStations.QHK).toMatchObject({
      defaultJourneyPlaceKey: "cn-qingdao",
    });
    expect(MAPPING.railStations.CWQ).toMatchObject({
      defaultJourneyPlaceKey: "cn-changsha",
    });
    expect(MAPPING.railStations.VAP).toMatchObject({
      defaultJourneyPlaceKey: "cn-beijing",
    });
    expect(MAPPING.railStations.AOH).toMatchObject({
      defaultJourneyPlaceKey: "cn-shanghai",
    });
    expect(MAPPING.railStations.IZQ).toMatchObject({
      defaultJourneyPlaceKey: "cn-guangzhou",
    });
  });

  it("leaves low-confidence rail endpoints unmapped instead of forcing a place-catalog merge", () => {
    expect(MAPPING.railStations.HRH).toBeUndefined();
    expect(MAPPING.railStations.NNZ).toBeUndefined();
    expect(MAPPING.railStations.XAY).toBeUndefined();
  });

  it("keeps low-confidence rail fallback display intact when no place-catalog mapping exists", () => {
    const huaibei = normalizeJourneyPlaceFromLocation(
      makeLocation("淮北", "HRH"),
      { preferredLanguage: "zh", ticketType: "train" },
    );
    const nanning = normalizeJourneyPlaceFromLocation(
      makeLocation("南宁", "NNZ"),
      { preferredLanguage: "zh", ticketType: "train" },
    );
    const xian = normalizeJourneyPlaceFromLocation(
      makeLocation("西安", "XAY"),
      { preferredLanguage: "zh", ticketType: "train" },
    );

    expect(huaibei).toMatchObject({ displayName: "淮北", placeKey: "cn-huaibei" });
    expect(nanning).toMatchObject({ displayName: "南宁", placeKey: "cn-nanning" });
    expect(xian).toMatchObject({ displayName: "西安", placeKey: "cn-xian" });
  });

  it("keeps endpoint metadata separate from standard place labels", () => {
    const tao = AIRPORTS.find((entry) => entry.code === "TAO");
    const qhk = RAIL_STATIONS.find((entry) => entry.code === "QHK");

    expect(tao?.placeKey).not.toBe(MAPPING.airports.TAO.defaultJourneyPlaceKey);
    expect(qhk?.placeKey).toBe(MAPPING.railStations.QHK.defaultJourneyPlaceKey);
    expect(qhk?.placeNameZh).toBe("青岛");
    expect(MAPPING.places[MAPPING.railStations.QHK.defaultJourneyPlaceKey]).toEqual({
      nameEn: "Qingdao",
      nameZh: "青岛市",
    });
  });
});
