import { describe, expect, it } from "vitest";
import {
  buildOverviewFavoritePlaces,
  countUniqueOverviewTicketPlaces,
  deriveActiveOverviewYear,
  deriveAvailableOverviewYears,
  deriveDefaultOverviewYear,
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
    departureTimeLocal: "2026-03-01T08:00",
    arrivalTimeLocal: "2026-03-01T16:00",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
  });
  const railTicket = makeTicket({
    id: "rail-1",
    ticketType: "train",
    departure: makeLocation("Beijing South", "VNP"),
    arrival: makeLocation("Tianjin West", "TXP"),
    departureTimeLocal: "2025-05-01T08:00",
    arrivalTimeLocal: "2025-05-01T10:00",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  });
  const mixedRailTicket = makeTicket({
    id: "rail-2",
    ticketType: "train",
    departure: makeLocation("Osaka", "OSA"),
    arrival: makeLocation("Kyoto", "UKY"),
    departureTimeLocal: "2026-04-01T09:00",
    arrivalTimeLocal: "2026-04-01T10:00",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  });

  const flightJourney = makeJourney({
    id: "j-flight",
    title: "Flight journey",
    ticketIds: ["flight-1"],
    startDate: "2026-03-01",
    endDate: "2026-03-04",
  });
  const railJourney = makeJourney({
    id: "j-rail",
    title: "Rail journey",
    ticketIds: ["rail-1"],
    startDate: "2025-05-01",
    endDate: "2025-05-02",
  });
  const mixedJourney = makeJourney({
    id: "j-mixed",
    title: "Mixed journey",
    ticketIds: ["flight-1", "rail-2"],
    startDate: "2026-04-01",
    endDate: "2026-04-05",
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

  it("derives available years per scope and prefers the current year when present", () => {
    expect(deriveAvailableOverviewYears(journeys, tickets)).toEqual(["2026", "2025"]);
    expect(deriveDefaultOverviewYear(["2026", "2025"], "2026")).toBe("2026");
    expect(deriveDefaultOverviewYear(["2025", "2024"], "2026")).toBe("2025");
  });

  it("combines year and transport scope without splitting mixed journeys", () => {
    const flights2026 = deriveOverviewScopedSnapshot(journeys, tickets, "flight", "2026");
    const rail2025 = deriveOverviewScopedSnapshot(journeys, tickets, "train", "2025");
    const rail2026 = deriveOverviewScopedSnapshot(journeys, tickets, "train", "2026");

    expect(flights2026.scopedTickets.map((ticket) => ticket.id)).toEqual(["flight-1"]);
    expect(flights2026.scopedJourneys.map((journey) => journey.id)).toEqual(["j-flight", "j-mixed"]);
    expect(rail2025.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-1"]);
    expect(rail2025.scopedJourneys.map((journey) => journey.id)).toEqual(["j-rail"]);
    expect(rail2026.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-2"]);
    expect(rail2026.scopedJourneys.map((journey) => journey.id)).toEqual(["j-mixed"]);
  });

  it("treats a concrete year as narrower than All years even when records were created later", () => {
    const allYearsRail = deriveOverviewScopedSnapshot(journeys, tickets, "train", "all");
    const year2026Rail = deriveOverviewScopedSnapshot(journeys, tickets, "train", "2026");
    const year2025Rail = deriveOverviewScopedSnapshot(journeys, tickets, "train", "2025");

    expect(allYearsRail.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-1", "rail-2"]);
    expect(year2026Rail.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-2"]);
    expect(year2025Rail.scopedTickets.map((ticket) => ticket.id)).toEqual(["rail-1"]);
    expect(year2026Rail.scopedTickets.map((ticket) => ticket.id)).not.toEqual(allYearsRail.scopedTickets.map((ticket) => ticket.id));
  });

  it("keeps a concrete year empty instead of falling back to all records when scope has no matches", () => {
    const flights2025 = deriveOverviewScopedSnapshot(journeys, tickets, "flight", "2025");

    expect(flights2025.scopedTickets).toHaveLength(0);
    expect(flights2025.scopedJourneys).toHaveLength(0);
    expect(getOverviewEmptyStateCopy("flight", "records", "2025")).toBe("No flight records for 2025.");
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
    expect(getOverviewEmptyStateCopy("flight", "records", "2026")).toBe("No flight records for 2026.");
    expect(getOverviewEmptyStateCopy("all", "records", "2025")).toBe("No records for 2025.");
  });

  it("falls back to the latest available year when current-year scoped data is missing", () => {
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
