import { describe, expect, it } from "vitest";
import {
  addJourneyStayDraftFromSuggestion,
  buildJourneyStayDisplay,
  buildJourneyStayDraftFromSuggestion,
  buildJourneyStaySuggestions,
  mergeAutoJourneyStayDrafts,
  moveUnknownJourneyStayDraft,
  sortJourneyStayDrafts,
  type JourneyStayDraft,
} from "../src/lib/journeyStays";
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

function makeDraft(overrides: Partial<JourneyStayDraft> & Pick<JourneyStayDraft, "draftId" | "placeName" | "source" | "userEdited">): JourneyStayDraft {
  return {
    draftId: overrides.draftId,
    persistedId: overrides.persistedId,
    placeName: overrides.placeName,
    placeKey: overrides.placeKey,
    countryCode: overrides.countryCode,
    arrivalDateTime: overrides.arrivalDateTime,
    departureDateTime: overrides.departureDateTime,
    source: overrides.source,
    userEdited: overrides.userEdited,
    arrivalTicketId: overrides.arrivalTicketId,
    departureTicketId: overrides.departureTicketId,
    sortOrderHint: overrides.sortOrderHint ?? 0,
    unknownOrder: overrides.unknownOrder ?? 0,
  };
}

describe("journeyStays helpers", () => {
  it("builds confirmed destination suggestions and transfer tags without auto-adding transfers", () => {
    const ticket = makeTicket({
      id: "seg",
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

    const suggestions = buildJourneyStaySuggestions([ticket]);
    expect(suggestions.map((suggestion) => ({
      placeName: suggestion.placeName,
      autoAdd: suggestion.autoAdd,
      kind: suggestion.kind,
    }))).toEqual([
      {
        placeName: "Sydney",
        autoAdd: true,
        kind: "destination",
      },
      {
        placeName: "Xiamen",
        autoAdd: false,
        kind: "transfer",
      },
    ]);
  });

  it("sorts known departures before unknown rows and keeps unknown rows at the end", () => {
    const rows = sortJourneyStayDrafts([
      makeDraft({
        draftId: "unknown-1",
        placeName: "Unknown first",
        departureDateTime: undefined,
        source: "manual",
        userEdited: true,
        unknownOrder: 0,
      }),
      makeDraft({
        draftId: "known-late",
        placeName: "Late",
        departureDateTime: "2026-06-05T00:00:00",
        source: "manual",
        userEdited: true,
      }),
      makeDraft({
        draftId: "known-early",
        placeName: "Early",
        departureDateTime: "2026-06-03T00:00:00",
        source: "manual",
        userEdited: true,
      }),
      makeDraft({
        draftId: "unknown-2",
        placeName: "Unknown second",
        departureDateTime: undefined,
        source: "manual",
        userEdited: true,
        unknownOrder: 1,
      }),
    ]);

    expect(rows.map((row) => row.placeName)).toEqual([
      "Early",
      "Late",
      "Unknown first",
      "Unknown second",
    ]);
  });

  it("does not duplicate a stay when the same suggestion tag is clicked twice", () => {
    const suggestion = {
      identity: "key:jp-osaka",
      placeName: "Osaka",
      placeKey: "jp-osaka",
      countryCode: "JP",
      departureDateTime: "2026-06-04T00:00:00",
      orderHint: 0,
      autoAdd: true,
      confidence: "high" as const,
      kind: "destination" as const,
    };

    const once = addJourneyStayDraftFromSuggestion([], suggestion);
    const twice = addJourneyStayDraftFromSuggestion(once, suggestion);

    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0]?.source).toBe("manual");
  });

  it("merges auto suggestions without re-adding dismissed transfer-only rows", () => {
    const autoSuggestion = {
      identity: "key:jp-osaka",
      placeName: "Osaka",
      placeKey: "jp-osaka",
      countryCode: "JP",
      departureDateTime: undefined,
      orderHint: 0,
      autoAdd: true,
      confidence: "high" as const,
      kind: "destination" as const,
    };
    const transferSuggestion = {
      identity: "key:cn-xiamen",
      placeName: "Xiamen",
      placeKey: "cn-xiamen",
      countryCode: "CN",
      departureDateTime: "2026-06-04T12:00:00",
      orderHint: 1,
      autoAdd: false,
      confidence: "high" as const,
      kind: "transfer" as const,
    };

    const rows = mergeAutoJourneyStayDrafts([], [autoSuggestion, transferSuggestion], []);
    expect(rows.map((row) => row.placeName)).toEqual(["Osaka"]);
  });

  it("reorders unknown rows with simple move controls while keeping them after known dates", () => {
    const known = buildJourneyStayDraftFromSuggestion({
      identity: "key:jp-osaka",
      placeName: "Osaka",
      placeKey: "jp-osaka",
      countryCode: "JP",
      departureDateTime: "2026-06-04T00:00:00",
      orderHint: 0,
      autoAdd: true,
      confidence: "high",
      kind: "destination",
    });
    const unknownA = makeDraft({
      draftId: "unknown-a",
      placeName: "Narita",
      source: "manual",
      userEdited: true,
      unknownOrder: 0,
      sortOrderHint: 2,
    });
    const unknownB = makeDraft({
      draftId: "unknown-b",
      placeName: "Tokyo",
      source: "manual",
      userEdited: true,
      unknownOrder: 1,
      sortOrderHint: 3,
    });

    const moved = moveUnknownJourneyStayDraft([known, unknownA, unknownB], "unknown-b", -1);
    expect(moved.map((row) => row.placeName)).toEqual(["Osaka", "Tokyo", "Narita"]);
  });

  it("builds a display summary from ordered stays", () => {
    expect(buildJourneyStayDisplay([
      { placeName: "Osaka" },
      { placeName: "Nara" },
      { placeName: "Tokyo" },
    ])).toBe("Osaka ¡¤ Nara ¡¤ Tokyo");
  });
});
