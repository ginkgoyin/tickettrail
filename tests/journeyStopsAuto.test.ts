import { describe, expect, it } from "vitest";
import {
  deriveAutoJourneyStops,
  mergeJourneyStopsWithDerivedAutoStops,
} from "../src/lib/journeyStopsAuto";
import type { Journey, JourneyStop, JourneyStopInput } from "../src/types/journey";
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

function makePersistedStop(
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

describe("journeyStopsAuto", () => {
  it("derives the final destination stop for a single one-way ticket", () => {
    const ticket = makeTicket({
      id: "t1",
      departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
      arrival: makeLocation("Kansai International Airport", "KIX"),
      departureTimeLocal: "2026-01-01T08:00",
      arrivalTimeLocal: "2026-01-01T12:00",
    });
    const journey = makeJourney({
      id: "j1",
      title: "One way",
      ticketIds: ["t1"],
    });

    expect(deriveAutoJourneyStops(journey, [ticket])).toEqual([
      {
        placeName: "Osaka",
        placeKey: "jp-osaka",
        countryCode: "JP",
        arrivalDateTime: "2026-01-01T12:00",
        departureDateTime: undefined,
        lodging: undefined,
        notes: undefined,
        source: "auto",
        arrivalTicketId: "t1",
        departureTicketId: undefined,
        sortOrder: 0,
        userEdited: false,
      },
    ]);
  });

  it("uses only first and last segment endpoints for a multi-segment ticket and excludes internal transfers", () => {
    const ticket = makeTicket({
      id: "t-seg",
      departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
      arrival: makeLocation("Sydney Kingsford Smith Airport", "SYD"),
      departureTimeLocal: "2026-02-01T08:00",
      arrivalTimeLocal: "2026-02-01T20:00",
      segments: [
        makeSegment(
          "MU1",
          makeLocation("Changsha Huanghua International Airport", "CSX"),
          makeLocation("Xiamen Gaoqi International Airport", "XMN"),
          "2026-02-01T08:00",
          "2026-02-01T10:00",
        ),
        makeSegment(
          "MU2",
          makeLocation("Xiamen Gaoqi International Airport", "XMN"),
          makeLocation("Sydney Kingsford Smith Airport", "SYD"),
          "2026-02-01T12:00",
          "2026-02-01T20:00",
        ),
      ],
      segmentCount: 2,
    });
    const journey = makeJourney({
      id: "j-seg",
      title: "Australia",
      ticketIds: ["t-seg"],
    });

    const stops = deriveAutoJourneyStops(journey, [ticket]);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.placeName).toBe("Sydney");
    expect(stops[0]?.placeKey).toBe("au-sydney");
  });

  it("derives only intermediate stops for multi-ticket routes and excludes the final endpoint", () => {
    const tickets = [
      makeTicket({
        id: "t1",
        departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
        arrival: makeLocation("Sydney Kingsford Smith Airport", "SYD"),
        departureTimeLocal: "2026-03-01T08:00",
        arrivalTimeLocal: "2026-03-01T20:00",
      }),
      makeTicket({
        id: "t2",
        departure: makeLocation("Sydney Kingsford Smith Airport", "SYD"),
        arrival: makeLocation("Melbourne Airport", "MEL"),
        departureTimeLocal: "2026-03-03T09:00",
        arrivalTimeLocal: "2026-03-03T11:00",
      }),
      makeTicket({
        id: "t3",
        departure: makeLocation("Melbourne Airport", "MEL"),
        arrival: makeLocation("Perth Airport", "PER"),
        departureTimeLocal: "2026-03-05T10:00",
        arrivalTimeLocal: "2026-03-05T14:00",
      }),
      makeTicket({
        id: "t4",
        departure: makeLocation("Perth Airport", "PER"),
        arrival: makeLocation("Tianjin Binhai International Airport", "TSN"),
        departureTimeLocal: "2026-03-10T09:00",
        arrivalTimeLocal: "2026-03-10T20:00",
      }),
    ];
    const journey = makeJourney({
      id: "j2",
      title: "Multi stop",
      ticketIds: tickets.map((ticket) => ticket.id),
    });

    expect(deriveAutoJourneyStops(journey, tickets).map((stop) => stop.placeName)).toEqual([
      "Sydney",
      "Melbourne",
      "Perth",
    ]);
  });

  it("keeps partial dates only when the missing movement ticket cannot be inferred safely", () => {
    const outbound = makeTicket({
      id: "outbound",
      departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
      arrival: makeLocation("Kansai International Airport", "KIX"),
      departureTimeLocal: "2026-04-01T08:00",
      arrivalTimeLocal: "2026-04-01T12:00",
    });
    const inbound = makeTicket({
      id: "inbound",
      departure: makeLocation("Tokyo Haneda International Airport", "HND"),
      arrival: makeLocation("Changsha Huanghua International Airport", "CSX"),
      departureTimeLocal: "2026-04-08T10:00",
      arrivalTimeLocal: "2026-04-08T16:00",
    });
    const journey = makeJourney({
      id: "j3",
      title: "Japan split",
      ticketIds: ["outbound", "inbound"],
    });

    expect(deriveAutoJourneyStops(journey, [outbound, inbound])).toEqual([
      {
        placeName: "Osaka",
        placeKey: "jp-osaka",
        countryCode: "JP",
        arrivalDateTime: "2026-04-01T12:00",
        departureDateTime: undefined,
        lodging: undefined,
        notes: undefined,
        source: "auto",
        arrivalTicketId: "outbound",
        departureTicketId: undefined,
        sortOrder: 0,
        userEdited: false,
      },
      {
        placeName: "Tokyo",
        placeKey: "jp-tokyo",
        countryCode: "JP",
        arrivalDateTime: undefined,
        departureDateTime: "2026-04-08T10:00",
        lodging: undefined,
        notes: undefined,
        source: "auto",
        arrivalTicketId: undefined,
        departureTicketId: "inbound",
        sortOrder: 1,
        userEdited: false,
      },
    ]);
  });

  it("collapses adjacent duplicate places while keeping arrival and departure ticket references", () => {
    const tickets = [
      makeTicket({
        id: "t1",
        departure: makeLocation("Changsha Huanghua International Airport", "CSX"),
        arrival: makeLocation("Qingdao Jiaodong International Airport", "TAO"),
        departureTimeLocal: "2026-05-01T08:00",
        arrivalTimeLocal: "2026-05-01T10:00",
      }),
      makeTicket({
        id: "t2",
        ticketType: "train",
        departure: makeLocation("Qingdao North", "QHK"),
        arrival: makeLocation("Jinan West", "JGK"),
        departureTimeLocal: "2026-05-03T09:00",
        arrivalTimeLocal: "2026-05-03T11:00",
      }),
      makeTicket({
        id: "t3",
        ticketType: "train",
        departure: makeLocation("Jinan West", "JGK"),
        arrival: makeLocation("Changsha South", "CWQ"),
        departureTimeLocal: "2026-05-05T09:00",
        arrivalTimeLocal: "2026-05-05T14:00",
      }),
    ];
    const journey = makeJourney({
      id: "j4",
      title: "Qingdao",
      ticketIds: ["t1", "t2", "t3"],
    });

    expect(deriveAutoJourneyStops(journey, tickets)).toEqual([
      {
        placeName: "Qingdao",
        placeKey: "cn-qingdao",
        countryCode: "CN",
        arrivalDateTime: "2026-05-01T10:00",
        departureDateTime: "2026-05-03T09:00",
        lodging: undefined,
        notes: undefined,
        source: "auto",
        arrivalTicketId: "t1",
        departureTicketId: "t2",
        sortOrder: 0,
        userEdited: false,
      },
      {
        placeName: "Jinan",
        placeKey: "cn-jinan",
        countryCode: "CN",
        arrivalDateTime: "2026-05-03T11:00",
        departureDateTime: "2026-05-05T09:00",
        lodging: undefined,
        notes: undefined,
        source: "auto",
        arrivalTicketId: "t2",
        departureTicketId: "t3",
        sortOrder: 1,
        userEdited: false,
      },
    ]);
  });

  it("preserves user-edited stops, replaces existing auto stops, and avoids duplicate auto entries", () => {
    const derivedAutoStops: JourneyStopInput[] = [
      {
        placeName: "Sydney",
        placeKey: "au-sydney",
        countryCode: "AU",
        source: "auto",
        sortOrder: 0,
        userEdited: false,
        arrivalTicketId: "t1",
        departureTicketId: "t2",
      },
      {
        placeName: "Melbourne",
        placeKey: "au-melbourne",
        countryCode: "AU",
        source: "auto",
        sortOrder: 1,
        userEdited: false,
      },
    ];

    const existingStops = [
      makePersistedStop({
        id: "auto-old",
        journeyId: "j5",
        placeName: "Old auto",
        placeKey: "old-auto",
        source: "auto",
        sortOrder: 0,
        userEdited: false,
      }),
      makePersistedStop({
        id: "manual-sydney",
        journeyId: "j5",
        placeName: "Sydney",
        placeKey: "au-sydney",
        notes: "Stayed with family",
        source: "manual",
        sortOrder: 1,
        userEdited: true,
      }),
      makePersistedStop({
        id: "manual-canberra",
        journeyId: "j5",
        placeName: "Canberra",
        placeKey: "au-canberra",
        source: "manual",
        sortOrder: 2,
        userEdited: true,
      }),
    ];

    expect(mergeJourneyStopsWithDerivedAutoStops(existingStops, derivedAutoStops)).toEqual([
      {
        id: "manual-sydney",
        placeName: "Sydney",
        placeKey: "au-sydney",
        countryCode: undefined,
        arrivalDateTime: undefined,
        departureDateTime: undefined,
        lodging: undefined,
        notes: "Stayed with family",
        source: "manual",
        arrivalTicketId: undefined,
        departureTicketId: undefined,
        sortOrder: 0,
        userEdited: true,
      },
      {
        placeName: "Melbourne",
        placeKey: "au-melbourne",
        countryCode: "AU",
        source: "auto",
        sortOrder: 1,
        userEdited: false,
      },
      {
        id: "manual-canberra",
        placeName: "Canberra",
        placeKey: "au-canberra",
        countryCode: undefined,
        arrivalDateTime: undefined,
        departureDateTime: undefined,
        lodging: undefined,
        notes: undefined,
        source: "manual",
        arrivalTicketId: undefined,
        departureTicketId: undefined,
        sortOrder: 2,
        userEdited: true,
      },
    ]);
  });
});
