import { describe, expect, it } from "vitest";
import {
  buildOverviewFavoritePlaces,
  countUniqueOverviewTicketPlaces,
  deriveActiveOverviewYear,
  deriveOverviewScopedSnapshot,
  getOverviewEmptyStateCopy,
} from "../src/lib/overviewData";
import type { Journey } from "../src/types/journey";
import type { JourneySummaryBase } from "../src/lib/journeySummary";
import type { TicketLocation, TicketRecord } from "../src/types/ticket";

function makeLocation(name: string, code?: string): TicketLocation {
  return {
    name,
    code,
    timezone: "Asia/Shanghai",
  };
}

function makeTicket(overrides: Partial<TicketRecord> & Pick<TicketRecord, "id" | "ticketType" | "departure" | "arrival">): TicketRecord {
  return {
    id: overrides.id,
    ticketType: overrides.ticketType,
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
    segmentCount: overrides.segmentCount ?? 1,
    departureTerminal: overrides.departureTerminal,
    arrivalTerminal: overrides.arrivalTerminal,
  };
}

function makeJourney(overrides: Partial<Journey> & Pick<Journey, "id" | "title" | "ticketIds">): Journey {
  return {
    id: overrides.id,
    title: overrides.title,
    destination: overrides.destination,
    dateMode: overrides.dateMode ?? "manual",
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    notes: overrides.notes,
    rating: overrides.rating,
    mood: overrides.mood,
    costAmount: overrides.costAmount,
    costCurrency: overrides.costCurrency,
    costExchangeRateToCny: overrides.costExchangeRateToCny,
    lodging: overrides.lodging,
    companions: overrides.companions ?? [],
    ticketIds: overrides.ticketIds,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

function makeSummaryBase(topDestinations: JourneySummaryBase["topDestinations"]): JourneySummaryBase {
  return {
    travelDayEntries: new Map(),
    allTravelDays: 0,
    availableYears: [],
    journeysByYear: new Map(),
    topDestinations,
    unresolvedStays: [],
    topCompanions: [],
    topCompanionGroups: [],
    costByCurrency: [],
    comparableCostCnyTotal: null,
    journeysWithoutCost: 0,
    missingExchangeRateCount: 0,
    longestJourney: null,
    busiestMonth: null,
    highestCostJourney: null,
  };
}

describe("overviewData helpers", () => {
  const flightTicket = makeTicket({
    id: "flight-1",
    ticketType: "flight",
    departure: makeLocation("Sydney", "SYD"),
    arrival: makeLocation("Tokyo", "HND"),
  });
  const railTicket = makeTicket({
    id: "rail-1",
    ticketType: "train",
    departure: makeLocation("Beijing South", "VNP"),
    arrival: makeLocation("Tianjin West", "TXP"),
  });
  const mixedRailTicket = makeTicket({
    id: "rail-2",
    ticketType: "train",
    departure: makeLocation("Osaka", "OSA"),
    arrival: makeLocation("Kyoto", "UKY"),
  });

  const flightJourney = makeJourney({
    id: "j-flight",
    title: "Flight journey",
    ticketIds: ["flight-1"],
  });
  const railJourney = makeJourney({
    id: "j-rail",
    title: "Rail journey",
    ticketIds: ["rail-1"],
  });
  const mixedJourney = makeJourney({
    id: "j-mixed",
    title: "Mixed journey",
    ticketIds: ["flight-1", "rail-2"],
  });

  const tickets = [flightTicket, railTicket, mixedRailTicket];
  const journeys = [flightJourney, railJourney, mixedJourney];

  it("includes all journeys and tickets in All scope", () => {
    const scoped = deriveOverviewScopedSnapshot(journeys, tickets, "all");

    expect(scoped.scopedTickets).toHaveLength(3);
    expect(scoped.scopedJourneys.map((journey) => journey.id)).toEqual(["j-flight", "j-rail", "j-mixed"]);
  });

  it("includes journeys containing flight tickets in Flights scope", () => {
    const scoped = deriveOverviewScopedSnapshot(journeys, tickets, "flight");

    expect(scoped.scopedTickets.map((ticket) => ticket.id)).toEqual(["flight-1"]);
    expect(scoped.scopedJourneys.map((journey) => journey.id)).toEqual(["j-flight", "j-mixed"]);
    expect(scoped.scopedJourneys.find((journey) => journey.id === "j-mixed")?.ticketIds).toEqual(["flight-1", "rail-2"]);
  });

  it("includes journeys containing rail tickets in Rail scope", () => {
    const scoped = deriveOverviewScopedSnapshot(journeys, tickets, "train");

    expect(scoped.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-1", "rail-2"]);
    expect(scoped.scopedJourneys.map((journey) => journey.id)).toEqual(["j-rail", "j-mixed"]);
  });

  it("uses summary destinations only in All scope and ticket-derived places in scoped views", () => {
    const summaryBase = makeSummaryBase([
      {
        label: "Osaka",
        journeyCount: 2,
        dedupedTravelDays: 5,
      },
    ]);

    const allFavorites = buildOverviewFavoritePlaces("all", summaryBase, tickets);
    const flightFavorites = buildOverviewFavoritePlaces("flight", summaryBase, [flightTicket]);

    expect(allFavorites).toEqual([
      {
        label: "Osaka",
        detail: "2 journeys",
      },
    ]);
    expect(flightFavorites.map((place) => place.label)).toEqual(["Sydney", "Tokyo"]);
  });

  it("counts unique ticket-derived places and exposes concise scoped empty copy", () => {
    expect(countUniqueOverviewTicketPlaces([flightTicket, mixedRailTicket])).toBe(4);
    expect(getOverviewEmptyStateCopy("all", "records")).toBe("No travel records yet.");
    expect(getOverviewEmptyStateCopy("flight", "journeys")).toBe("No flight journeys in this scope.");
    expect(getOverviewEmptyStateCopy("train", "favorites")).toBe("No rail places in this scope.");
  });

  it("prefers the current calendar year when scoped data exists for it, otherwise falls back to the latest data year", () => {
    expect(deriveActiveOverviewYear(journeys, tickets, "2026")).toBe("2026");

    const olderTicket = makeTicket({
      id: "flight-older",
      ticketType: "flight",
      departure: makeLocation("Melbourne", "MEL"),
      arrival: makeLocation("Singapore", "SIN"),
      departureTimeLocal: "2024-02-01T08:00",
      arrivalTimeLocal: "2024-02-01T14:00",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    const olderJourney = makeJourney({
      id: "j-older",
      title: "Older journey",
      ticketIds: ["flight-older"],
      startDate: "2024-02-01",
      endDate: "2024-02-03",
      updatedAt: "2024-02-04T00:00:00Z",
    });

    expect(deriveActiveOverviewYear([olderJourney], [olderTicket], "2026")).toBe("2024");
    expect(deriveActiveOverviewYear([], [], "2026")).toBe("2026");
  });
});
