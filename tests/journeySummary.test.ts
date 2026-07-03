import { describe, expect, it } from "vitest";
import {
  buildJourneyRouteSummaryFromTickets,
  buildJourneySummaryBase,
  buildJourneySummaryCalendar,
  deriveVisitedDestinationsForJourney,
} from "../src/lib/journeySummary";
import type { Journey, JourneyStop } from "../src/types/journey";
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

function makeStop(
  overrides: Partial<JourneyStop> & Pick<JourneyStop, "id" | "journeyId" | "placeName" | "source" | "sortOrder" | "userEdited">,
): JourneyStop {
  return {
    id: overrides.id,
    journeyId: overrides.journeyId,
    placeName: overrides.placeName,
    placeKey: overrides.placeKey,
    countryCode: overrides.countryCode,
    arrivalDateTime: overrides.arrivalDateTime,
    departureDateTime: overrides.departureDateTime,
    lodging: overrides.lodging,
    notes: overrides.notes,
    source: overrides.source,
    arrivalTicketId: overrides.arrivalTicketId,
    departureTicketId: overrides.departureTicketId,
    sortOrder: overrides.sortOrder,
    userEdited: overrides.userEdited,
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
    const osaka = makeLocation("Kansai International Airport", "KIX");
    const xiamen = makeLocation("Xiamen", "XMN");
    const sydney = makeLocation("Sydney", "SYD");
    const melbourne = makeLocation("Melbourne", "MEL");
    const shanghai = makeLocation("Shanghai", "PVG");
    const tianjin = makeLocation("Tianjin Binhai International Airport", "TSN");

    const multiSegmentOut = makeTicket({
      id: "t1",
      departure: osaka,
      arrival: sydney,
      departureTimeLocal: "2026-01-01T08:00",
      arrivalTimeLocal: "2026-01-01T18:00",
      segments: [
        makeSegment("MU100", osaka, xiamen, "2026-01-01T08:00", "2026-01-01T10:00"),
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
      "Osaka -> Sydney -> Melbourne -> Tianjin",
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
      departure: makeLocation("Kansai International Airport", "KIX"),
      arrival: makeLocation("Tokyo Haneda International Airport", "HND"),
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
    expect(summary.topDestinations.map((item) => item.label)).toEqual(["Kyoto"]);
  });

  it("sorts top destinations by journey count then deduped travel days using derived destinations", () => {
    const tokyo = makeLocation("Tokyo Haneda International Airport", "HND");
    const osaka = makeLocation("Kansai International Airport", "KIX");
    const seoul = makeLocation("Seoul", "ICN");

    const tickets = [
      makeTicket({ id: "t1", departure: makeLocation("Kansai International Airport", "KIX"), arrival: tokyo }),
      makeTicket({ id: "t2", departure: makeLocation("Tokyo Haneda International Airport", "HND"), arrival: osaka }),
      makeTicket({ id: "t3", departure: makeLocation("Seoul", "ICN"), arrival: tokyo }),
      makeTicket({ id: "t4", departure: makeLocation("Tokyo Haneda International Airport", "HND"), arrival: seoul }),
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

  it("dedupes journey destinations by final display label when airport and rail places share the same visible city", () => {
    const flightIn = makeTicket({
      id: "t-qingdao-flight",
      departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
      arrival: makeLocation("Qingdao Jiaodong International Airport", "TAO"),
      departureTimeLocal: "2026-07-03T08:00",
      arrivalTimeLocal: "2026-07-03T11:00",
    });
    const railOut = makeTicket({
      id: "t-qingdao-rail",
      ticketType: "train",
      departure: makeLocation("Qingdao North", "QHK"),
      arrival: makeLocation("Changsha South", "CWQ"),
      departureTimeLocal: "2026-07-07T08:00",
      arrivalTimeLocal: "2026-07-07T14:00",
    });

    const journey = makeJourney({
      id: "j-qingdao",
      title: "Qingdao trip",
      ticketIds: ["t-qingdao-flight", "t-qingdao-rail"],
    });

    expect(buildJourneyRouteSummaryFromTickets([flightIn, railOut])).toBe(
      "Changsha -> Qingdao -> Changsha",
    );
    expect(deriveVisitedDestinationsForJourney(journey, [flightIn, railOut])).toEqual(["Qingdao"]);
  });

  it("prefers persisted stays over legacy route inference and uses stay-specific day windows", () => {
    const ticket = makeTicket({
      id: "t-stay-priority",
      departure: makeLocation("Sydney", "SYD"),
      arrival: makeLocation("Tokyo Haneda International Airport", "HND"),
      arrivalTimeLocal: "2026-06-01T10:00",
    });
    const journey = makeJourney({
      id: "j-stay-priority",
      title: "Manual stays",
      startDate: "2026-06-01",
      endDate: "2026-06-04",
      destination: "Tokyo",
      ticketIds: ["t-stay-priority"],
    });
    const stopsByJourneyId = {
      "j-stay-priority": [
        makeStop({
          id: "s-osaka",
          journeyId: "j-stay-priority",
          placeName: "Osaka",
          placeKey: "jp-osaka",
          departureDateTime: "2026-06-04T00:00:00",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
      ],
    };

    const summary = buildJourneySummaryBase([journey], [ticket], "2026", { stopsByJourneyId });

    expect(summary.topDestinations).toEqual([
      { label: "Osaka", journeyCount: 1, dedupedTravelDays: 4 },
    ]);
    expect(summary.unresolvedStays).toEqual([]);
  });

  it("groups grouped stays under the summary place key when a reviewed grouping exists", () => {
    const ticket = makeTicket({
      id: "t-danyang",
      departure: makeLocation("Shanghai", "PVG"),
      arrival: makeLocation("Danyang", "DYH"),
      arrivalTimeLocal: "2026-05-01T10:00",
    });
    const journey = makeJourney({
      id: "j-danyang",
      title: "Danyang stay",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
      ticketIds: ["t-danyang"],
    });
    const stopsByJourneyId = {
      "j-danyang": [
        makeStop({
          id: "s-danyang",
          journeyId: "j-danyang",
          placeName: "Danyang",
          placeKey: "cn-danyang",
          departureDateTime: "2026-05-03T00:00:00",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
      ],
    };

    const summary = buildJourneySummaryBase([journey], [ticket], "2026", { stopsByJourneyId });

    expect(summary.topDestinations).toEqual([
      { label: "Zhenjiang", journeyCount: 1, dedupedTravelDays: 3 },
    ]);
    expect(stopsByJourneyId["j-danyang"][0].placeKey).toBe("cn-danyang");
  });

  it("combines grouped and already-group-level stays under the same summary destination", () => {
    const tickets = [
      makeTicket({
        id: "t-hailin",
        departure: makeLocation("Harbin", "VAB"),
        arrival: makeLocation("Hailin", "HLN"),
        arrivalTimeLocal: "2026-02-01T10:00",
      }),
      makeTicket({
        id: "t-mudanjiang",
        departure: makeLocation("Harbin", "VAB"),
        arrival: makeLocation("Mudanjiang", "MDG"),
        arrivalTimeLocal: "2026-03-01T10:00",
      }),
    ];

    const journeys = [
      makeJourney({
        id: "j-hailin",
        title: "Hailin stay",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        ticketIds: ["t-hailin"],
      }),
      makeJourney({
        id: "j-mudanjiang",
        title: "Mudanjiang stay",
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        ticketIds: ["t-mudanjiang"],
      }),
    ];

    const stopsByJourneyId = {
      "j-hailin": [
        makeStop({
          id: "s-hailin",
          journeyId: "j-hailin",
          placeName: "Hailin",
          placeKey: "cn-hailin",
          departureDateTime: "2026-02-03T00:00:00",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
      ],
      "j-mudanjiang": [
        makeStop({
          id: "s-mudanjiang",
          journeyId: "j-mudanjiang",
          placeName: "Mudanjiang",
          placeKey: "cn-mudanjiang",
          departureDateTime: "2026-03-02T00:00:00",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
      ],
    };

    const summary = buildJourneySummaryBase(journeys, tickets, "2026", { stopsByJourneyId });

    expect(summary.topDestinations).toEqual([
      { label: "Mudanjiang", journeyCount: 2, dedupedTravelDays: 5 },
    ]);
  });

  it("counts a repeated stay place only once per journey while combining its stay-specific days", () => {
    const ticket = makeTicket({
      id: "t-repeat",
      departure: makeLocation("Melbourne", "MEL"),
      arrival: makeLocation("Hobart", "HBA"),
      arrivalTimeLocal: "2026-01-01T09:00",
    });
    const journey = makeJourney({
      id: "j-repeat",
      title: "Repeat stay",
      startDate: "2026-01-01",
      endDate: "2026-01-04",
      ticketIds: ["t-repeat"],
    });
    const stopsByJourneyId = {
      "j-repeat": [
        makeStop({
          id: "s-hobart-1",
          journeyId: "j-repeat",
          placeName: "Hobart",
          placeKey: "au-hobart",
          departureDateTime: "2026-01-02T00:00:00",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
        makeStop({
          id: "s-sydney",
          journeyId: "j-repeat",
          placeName: "Sydney",
          placeKey: "au-sydney",
          departureDateTime: "2026-01-03T00:00:00",
          source: "manual",
          sortOrder: 1,
          userEdited: true,
        }),
        makeStop({
          id: "s-hobart-2",
          journeyId: "j-repeat",
          placeName: "Hobart",
          placeKey: "au-hobart",
          departureDateTime: "2026-01-04T00:00:00",
          source: "manual",
          sortOrder: 2,
          userEdited: true,
        }),
      ],
    };

    const summary = buildJourneySummaryBase([journey], [ticket], "2026", { stopsByJourneyId });

    expect(summary.topDestinations).toEqual([
      { label: "Hobart", journeyCount: 1, dedupedTravelDays: 4 },
      { label: "Sydney", journeyCount: 1, dedupedTravelDays: 2 },
    ]);
  });

  it("groups unknown stay rows with the next known departure into unresolved stays", () => {
    const ticket = makeTicket({
      id: "t-unresolved",
      departure: makeLocation("Kyoto", "UKY"),
      arrival: makeLocation("Nara", "UNR"),
      arrivalTimeLocal: "2026-04-01T09:00",
    });
    const journey = makeJourney({
      id: "j-unresolved",
      title: "Unresolved stay block",
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      ticketIds: ["t-unresolved"],
    });
    const stopsByJourneyId = {
      "j-unresolved": [
        makeStop({
          id: "s-nara",
          journeyId: "j-unresolved",
          placeName: "Nara",
          placeKey: "jp-nara",
          source: "manual",
          sortOrder: 0,
          userEdited: true,
        }),
        makeStop({
          id: "s-tokyo",
          journeyId: "j-unresolved",
          placeName: "Tokyo",
          placeKey: "jp-tokyo",
          departureDateTime: "2026-04-03T00:00:00",
          source: "manual",
          sortOrder: 1,
          userEdited: true,
        }),
      ],
    };

    const summary = buildJourneySummaryBase([journey], [ticket], "2026", { stopsByJourneyId });

    expect(summary.topDestinations).toEqual([]);
    expect(summary.unresolvedStays).toEqual([
      { label: "Nara + Tokyo", journeyCount: 1, dedupedTravelDays: 3 },
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
