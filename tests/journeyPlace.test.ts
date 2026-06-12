import { describe, expect, it } from "vitest";
import { getTicketEndpointPlaces, normalizeJourneyPlaceFromLocation } from "../src/lib/journeyPlace";
import type { TicketLocation, TicketRecord } from "../src/types/ticket";

function makeLocation(name: string, code?: string): TicketLocation {
  return {
    name,
    code,
    timezone: "Asia/Shanghai",
  };
}

function makeTicket(overrides: Partial<TicketRecord> & Pick<TicketRecord, "id" | "departure" | "arrival">): TicketRecord {
  return {
    id: overrides.id,
    ticketType: overrides.ticketType ?? "flight",
    carrierName: overrides.carrierName ?? "Carrier",
    code: overrides.code ?? overrides.id.toUpperCase(),
    departure: overrides.departure,
    arrival: overrides.arrival,
    departureTimeLocal: overrides.departureTimeLocal ?? "2026-01-01T08:00",
    arrivalTimeLocal: overrides.arrivalTimeLocal ?? "2026-01-01T10:00",
    classInfo: overrides.classInfo ?? "Economy",
    seatInfo: overrides.seatInfo ?? "",
    notes: overrides.notes ?? "",
    segments: overrides.segments ?? [],
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
    routeLabel: overrides.routeLabel ?? `${overrides.departure.name} -> ${overrides.arrival.name}`,
    status: overrides.status ?? "saved",
    segmentCount: overrides.segmentCount ?? overrides.segments?.length ?? 1,
    departureTerminal: overrides.departureTerminal,
    arrivalTerminal: overrides.arrivalTerminal,
  };
}

describe("journeyPlace", () => {
  it("normalizes airport endpoints to place labels when airport metadata is available", () => {
    const place = normalizeJourneyPlaceFromLocation(
      makeLocation("Kansai International Airport", "KIX"),
      { preferredLanguage: "en", ticketType: "flight" },
    );

    expect(place).toMatchObject({
      placeKey: "jp-osaka",
      displayName: "Osaka",
      displayNameEn: "Osaka",
      source: "airport",
      confidence: "high",
    });
  });

  it("removes parenthetical municipality and suburb qualifiers from airport place display labels", () => {
    const qingdao = normalizeJourneyPlaceFromLocation(
      makeLocation("Qingdao Jiaodong International Airport", "TAO"),
      { preferredLanguage: "en", ticketType: "flight" },
    );
    const hobart = normalizeJourneyPlaceFromLocation(
      makeLocation("Hobart International Airport", "HBA"),
      { preferredLanguage: "en", ticketType: "flight" },
    );

    expect(qingdao).toMatchObject({
      placeKey: "cn-qingdao-jiaozhou",
      displayName: "Qingdao",
      displayNameEn: "Qingdao",
    });
    expect(hobart).toMatchObject({
      placeKey: "au-hobart-cambridge",
      displayName: "Hobart",
      displayNameEn: "Hobart",
    });
  });

  it("does not add served-city overrides for airports such as Narita", () => {
    const narita = normalizeJourneyPlaceFromLocation(
      makeLocation("Narita International Airport", "NRT"),
      { preferredLanguage: "en", ticketType: "flight" },
    );

    expect(narita).toMatchObject({
      placeKey: "jp-narita",
      displayName: "Narita",
      displayNameEn: "Narita",
    });
  });

  it("normalizes rail endpoints to place labels and respects preferred language when metadata is available", () => {
    const englishPlace = normalizeJourneyPlaceFromLocation(
      makeLocation("Qingdao North", "QHK"),
      { preferredLanguage: "en", ticketType: "train" },
    );
    const chinesePlace = normalizeJourneyPlaceFromLocation(
      makeLocation("Qingdao North", "QHK"),
      { preferredLanguage: "zh", ticketType: "train" },
    );

    expect(englishPlace).toMatchObject({
      placeKey: "cn-qingdao",
      displayName: "Qingdao",
      displayNameEn: "Qingdao",
      source: "rail_station",
      confidence: "medium",
    });
    expect(chinesePlace?.displayName).toBe(chinesePlace?.displayNameZh);
    expect(chinesePlace?.displayNameZh).toBeTruthy();
  });

  it("falls back to the raw endpoint when no metadata match exists", () => {
    const place = normalizeJourneyPlaceFromLocation(
      makeLocation("Mystery Terminal"),
      { preferredLanguage: "en", ticketType: "flight" },
    );

    expect(place).toMatchObject({
      displayName: "Mystery Terminal",
      source: "fallback",
      confidence: "low",
    });
  });

  it("uses only the first and last segment endpoints for journey-level ticket places", () => {
    const ticket = makeTicket({
      id: "seg",
      departure: makeLocation("Sydney", "SYD"),
      arrival: makeLocation("Tokyo Haneda International Airport", "HND"),
      ticketType: "flight",
      segments: [
        {
          carrierName: "Carrier",
          code: "MU1",
          departure: makeLocation("Sydney", "SYD"),
          arrival: makeLocation("Kansai International Airport", "KIX"),
          departureTimeLocal: "2026-01-01T08:00",
          arrivalTimeLocal: "2026-01-01T12:00",
          classInfo: "Economy",
          seatInfo: "",
          notes: "",
        },
        {
          carrierName: "Carrier",
          code: "MU2",
          departure: makeLocation("Kansai International Airport", "KIX"),
          arrival: makeLocation("Tokyo Haneda International Airport", "HND"),
          departureTimeLocal: "2026-01-01T14:00",
          arrivalTimeLocal: "2026-01-01T16:00",
          classInfo: "Economy",
          seatInfo: "",
          notes: "",
        },
      ],
      segmentCount: 2,
    });

    const endpoints = getTicketEndpointPlaces(ticket, { preferredLanguage: "en" });
    expect(endpoints.origin).toMatchObject({ key: "au-sydney-mascot", label: "Sydney" });
    expect(endpoints.destination).toMatchObject({ key: "jp-tokyo", label: "Tokyo" });
  });
});
