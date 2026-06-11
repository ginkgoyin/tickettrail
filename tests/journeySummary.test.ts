import { describe, expect, it } from "vitest";
import {
  buildJourneyRouteSummaryFromTickets,
  buildJourneySummaryBase,
  buildJourneySummaryCalendar,
  deriveVisitedDestinationsForJourney,
} from "../src/lib/journeySummary";
import type { Journey } from "../src/types/journey";
import type { TicketLocation, TicketRecord, TicketSegmentDraft } from "../src/types/ticket";

function makeLocation(name: string, code?: string): TicketLocation {
  return {
    name,
    code,
    timezone: "Australia/Sydney",
  };
}

function makeSegment(
  code: string,
  departure: TicketLocation,
  arrival: TicketLocation,
  departureTimeLocal: string,
  arrivalTimeLocal: string,
): TicketSegmentDraft {
  return {
    carrierName: "Carrier",
    code,
    departure,
    arrival,
    departureTimeLocal,
    arrivalTimeLocal,
    classInfo: "Economy",
    seatInfo: "",
    notes: "",
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

function makeJourney(overrides: Partial<Journey> & Pick<Journey, "id" | "title">): Journey {
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
    ticketIds: overrides.ticketIds ?? [],
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

describe("journeySummary helpers", () => {
  it("handles empty journeys safely", () => {
    const summary = buildJourneySummaryBase([], [], "2026");
    const calendar = buildJourneySummaryCalendar(summary, "2026", new Date("2026-06-01T00:00:00"));

    expect(summary.allTravelDays).toBe(0);
    expect(summary.topDestinations).toEqual([]);
    expect(summary.costByCurrency).toEqual([]);
    expect(summary.comparableCostCnyTotal).toBeNull();
    expect(calendar.selectedYearJourneys).toBe(0);
    expect(calendar.selectedYearTravelDays).toBe(0);
  });

  it("dedupes overlapping travel days and counts selected-year travel days only inside that year", () => {
    const journeys = [
      makeJourney({
        id: "j1",
        title: "Overlap one",
        startDate: "2025-12-31",
        endDate: "2026-01-02",
      }),
      makeJourney({
        id: "j2",
        title: "Overlap two",
        startDate: "2026-01-02",
        endDate: "2026-01-04",
      }),
      makeJourney({
        id: "j3",
        title: "Single day",
        startDate: "2026-01-04",
        endDate: "2026-01-04",
      }),
    ];

    const summary = buildJourneySummaryBase(journeys, [], "2026");
    const calendar2025 = buildJourneySummaryCalendar(summary, "2025", new Date("2026-01-04T00:00:00"));
    const calendar2026 = buildJourneySummaryCalendar(summary, "2026", new Date("2026-01-04T00:00:00"));

    expect(summary.allTravelDays).toBe(5);
    expect(calendar2025.selectedYearJourneys).toBe(1);
    expect(calendar2025.selectedYearTravelDays).toBe(1);
    expect(calendar2026.selectedYearJourneys).toBe(3);
    expect(calendar2026.selectedYearTravelDays).toBe(4);
    expect(summary.longestJourney?.durationDays).toBe(3);
    expect(summary.busiestMonth).toEqual({
      monthKey: "2026-01",
      dedupedTravelDays: 4,
    });
  });

  it("derives visited destinations and route summary from ticket-level endpoints while excluding transfer cities", () => {
    const changsha = makeLocation("Changsha", "CSX");
    const xiamen = makeLocation("Xiamen", "XMN");
    const sydney = makeLocation("Sydney", "SYD");
    const melbourne = makeLocation("Melbourne", "MEL");
    const shanghai = makeLocation("Shanghai", "PVG");
    const tianjin = makeLocation("Tianjin", "TSN");

    const multiSegmentOut = makeTicket({
      id: "t1",
      departure: changsha,
      arrival: sydney,
      departureTimeLocal: "2026-01-01T08:00",
      arrivalTimeLocal: "2026-01-01T18:00",
      segments: [
        makeSegment("MU100", changsha, xiamen, "2026-01-01T08:00", "2026-01-01T10:00"),
        makeSegment("MU200", xiamen, sydney, "2026-01-01T12:00", "2026-01-01T18:00"),
      ],
      segmentCount: 2,
    });
    const toMelbourne = makeTicket({
      id: "t2",
      departure: sydney,
      arrival: melbourne,
      departureTimeLocal: "2026-01-03T08:00",
      arrivalTimeLocal: "2026-01-03T10:00",
    });
    const multiSegmentReturn = makeTicket({
      id: "t3",
      departure: melbourne,
      arrival: tianjin,
      departureTimeLocal: "2026-01-05T08:00",
      arrivalTimeLocal: "2026-01-05T20:00",
      segments: [
        makeSegment("MU300", melbourne, shanghai, "2026-01-05T08:00", "2026-01-05T16:00"),
        makeSegment("MU400", shanghai, tianjin, "2026-01-05T18:00", "2026-01-05T20:00"),
      ],
      segmentCount: 2,
    });

    const journey = makeJourney({
      id: "j-route",
      title: "Australia trip",
      destination: "Fallback destination",
      ticketIds: ["t1", "t2", "t3"],
    });

    expect(buildJourneyRouteSummaryFromTickets([multiSegmentOut, toMelbourne, multiSegmentReturn])).toBe(
      "Changsha -> Sydney -> Melbourne -> Tianjin",
    );
    expect(deriveVisitedDestinationsForJourney(journey, [multiSegmentOut, toMelbourne, multiSegmentReturn])).toEqual([
      "Sydney",
      "Melbourne",
    ]);
  });

  it("falls back conservatively when linked-ticket route data is absent and uses one-way final destination when safe", () => {
    const journeyWithoutTickets = makeJourney({
      id: "j-fallback",
      title: "Fallback",
      destination: "Kyoto",
    });
    const noDestinationJourney = makeJourney({
      id: "j-none",
      title: "No destination",
    });
    const oneWayTicket = makeTicket({
      id: "t-oneway",
      departure: makeLocation("Changsha", "CSX"),
      arrival: makeLocation("Tokyo", "HND"),
    });
    const oneWayJourney = makeJourney({
      id: "j-oneway",
      title: "One way",
      ticketIds: ["t-oneway"],
    });

    expect(deriveVisitedDestinationsForJourney(journeyWithoutTickets, [])).toEqual(["Kyoto"]);
    expect(deriveVisitedDestinationsForJourney(noDestinationJourney, [])).toEqual([]);
    expect(deriveVisitedDestinationsForJourney(oneWayJourney, [oneWayTicket])).toEqual(["Tokyo"]);

    const summary = buildJourneySummaryBase([journeyWithoutTickets, noDestinationJourney], [], "2026");
    expect(summary.topDestinations.map((item) => item.label)).toEqual(["Kyoto", "No destination"]);
  });

  it("sorts top destinations by journey count then deduped travel days using derived destinations", () => {
    const tokyo = makeLocation("Tokyo", "HND");
    const osaka = makeLocation("Osaka", "ITM");
    const seoul = makeLocation("Seoul", "ICN");

    const tickets = [
      makeTicket({ id: "t1", departure: makeLocation("Changsha", "CSX"), arrival: tokyo }),
      makeTicket({ id: "t2", departure: makeLocation("Tokyo", "HND"), arrival: osaka }),
      makeTicket({ id: "t3", departure: makeLocation("Shanghai", "PVG"), arrival: tokyo }),
      makeTicket({ id: "t4", departure: makeLocation("Beijing", "PEK"), arrival: seoul }),
    ];

    const journeys = [
      makeJourney({
        id: "j1",
        title: "Japan one",
        startDate: "2026-01-01",
        endDate: "2026-01-03",
        ticketIds: ["t1", "t2"],
      }),
      makeJourney({
        id: "j2",
        title: "Japan two",
        startDate: "2026-02-01",
        endDate: "2026-02-05",
        ticketIds: ["t3"],
      }),
      makeJourney({
        id: "j3",
        title: "Korea",
        startDate: "2026-03-01",
        endDate: "2026-03-04",
        ticketIds: ["t4"],
      }),
    ];

    const summary = buildJourneySummaryBase(journeys, tickets, "2026");

    expect(summary.topDestinations.slice(0, 2)).toEqual([
      { label: "Tokyo", journeyCount: 2, dedupedTravelDays: 8 },
      { label: "Seoul", journeyCount: 1, dedupedTravelDays: 4 },
    ]);
  });

  it("groups top companions, keeps only top five, and aggregates cost comparison safely", () => {
    const journeys = [
      makeJourney({
        id: "j1",
        title: "One",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        companions: [
          { id: "c1", journeyId: "j1", name: "Dad", createdAt: "" },
          { id: "c2", journeyId: "j1", name: "Mum", createdAt: "" },
          { id: "c3", journeyId: "j1", name: "Yue", createdAt: "" },
        ],
        costAmount: 1000,
        costCurrency: "CNY",
      }),
      makeJourney({
        id: "j2",
        title: "Two",
        startDate: "2026-01-03",
        endDate: "2026-01-05",
        companions: [
          { id: "c4", journeyId: "j2", name: "Dad", createdAt: "" },
          { id: "c5", journeyId: "j2", name: "Mum", createdAt: "" },
          { id: "c6", journeyId: "j2", name: "Yang", createdAt: "" },
        ],
        costAmount: 500,
        costCurrency: "AUD",
        costExchangeRateToCny: 4.5,
      }),
      makeJourney({
        id: "j3",
        title: "Three",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        companions: [
          { id: "c7", journeyId: "j3", name: "Dad", createdAt: "" },
          { id: "c8", journeyId: "j3", name: "Mum", createdAt: "" },
          { id: "c9", journeyId: "j3", name: "Yue", createdAt: "" },
          { id: "c10", journeyId: "j3", name: "Friend", createdAt: "" },
        ],
        costAmount: 30000,
        costCurrency: "JPY",
      }),
      makeJourney({
        id: "j4",
        title: "Four",
        startDate: "2026-03-01",
        endDate: "2026-03-04",
        companions: [{ id: "c11", journeyId: "j4", name: "Friend", createdAt: "" }],
      }),
    ];

    const summary = buildJourneySummaryBase(journeys, [], "2026");

    expect(summary.topCompanions.map((item) => item.label)).toEqual(["Dad", "Mum", "Friend", "Yue", "Yang"]);
    expect(summary.topCompanionGroups).toEqual([
      { journeyCount: 3, labels: ["Dad", "Mum"] },
      { journeyCount: 2, labels: ["Friend", "Yue"] },
      { journeyCount: 1, labels: ["Yang"] },
    ]);
    expect(summary.costByCurrency).toEqual([
      { currency: "JPY", totalAmount: 30000, journeyCount: 1 },
      { currency: "CNY", totalAmount: 1000, journeyCount: 1 },
      { currency: "AUD", totalAmount: 500, journeyCount: 1 },
    ]);
    expect(summary.comparableCostCnyTotal).toBe(3250);
    expect(summary.missingExchangeRateCount).toBe(1);
    expect(summary.highestCostJourney).toEqual({
      title: "Two",
      amountLabel: "AUD 500",
      convertedCny: 2250,
      convertedLabel: "2,250",
    });
    expect(summary.journeysWithoutCost).toBe(1);
  });
});
