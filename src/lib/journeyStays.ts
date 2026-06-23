import type { JourneyStop, JourneyStopInput, JourneyStopSource } from "../types/journey";
import type { TicketRecord } from "../types/ticket";
import type { Language } from "./i18n";
import {
  getTicketEndpointJourneyPlaces,
  normalizeJourneyPlaceFromLocation,
  type JourneyPlace,
  type JourneyPlaceNormalizationOptions,
} from "./journeyPlace";
import { joinJourneyDisplayLabels } from "./journeyDisplay";
import { sortTicketsByTripDate } from "./journeySummary";

interface JourneyStayAnchor {
  place: JourneyPlace;
  arrivalTicketId?: string;
  arrivalDateTime?: string;
  departureTicketId?: string;
  departureDateTime?: string;
}

export interface JourneyStaySuggestion {
  identity: string;
  placeName: string;
  placeKey?: string;
  countryCode?: string;
  arrivalDateTime?: string;
  departureDateTime?: string;
  arrivalTicketId?: string;
  departureTicketId?: string;
  orderHint: number;
  autoAdd: boolean;
  confidence: JourneyPlace["confidence"];
  kind: "destination" | "transfer";
}

export interface JourneyStayDraft {
  draftId: string;
  persistedId?: string;
  placeName: string;
  placeKey?: string;
  countryCode?: string;
  arrivalDateTime?: string;
  departureDateTime?: string;
  source: JourneyStopSource;
  userEdited: boolean;
  arrivalTicketId?: string;
  departureTicketId?: string;
  sortOrderHint: number;
  unknownOrder: number;
}

export interface JourneyStayOptions {
  preferredLanguage?: Language;
}

function normalizeStayIdentity(placeKey?: string, placeName?: string) {
  const normalizedKey = placeKey?.trim().toLowerCase();
  if (normalizedKey) {
    return `key:${normalizedKey}`;
  }

  const normalizedName = placeName?.trim().toLowerCase();
  return normalizedName ? `name:${normalizedName}` : "";
}

function extractDateKey(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function normalizeStopName(placeName?: string, displayName?: string) {
  return (displayName ?? placeName ?? "").trim().toLowerCase();
}

function isEquivalentPlace(
  left: Pick<JourneyPlace, "placeKey" | "displayName">,
  right: Pick<JourneyPlace, "placeKey" | "displayName">,
) {
  const leftKey = left.placeKey?.trim().toLowerCase();
  const rightKey = right.placeKey?.trim().toLowerCase();
  if (leftKey && rightKey && leftKey === rightKey) {
    return true;
  }

  const leftName = normalizeStopName(undefined, left.displayName);
  const rightName = normalizeStopName(undefined, right.displayName);
  return Boolean(leftName) && leftName === rightName;
}

function createJourneyStayDraftId() {
  return `stay-${Math.random().toString(36).slice(2, 10)}`;
}

function appendCollapsedAnchor(
  anchors: JourneyStayAnchor[],
  place: JourneyPlace | null,
  contribution: {
    kind: "origin" | "destination";
    ticketId: string;
    dateTime?: string;
  },
) {
  if (!place) {
    return;
  }

  const identity = normalizeStayIdentity(place.placeKey, place.displayName);
  if (!identity) {
    return;
  }

  const lastAnchor = anchors[anchors.length - 1];
  if (lastAnchor && isEquivalentPlace(lastAnchor.place, place)) {
    if (contribution.kind === "destination") {
      lastAnchor.arrivalTicketId = contribution.ticketId;
      lastAnchor.arrivalDateTime = contribution.dateTime;
    } else if (!lastAnchor.departureTicketId) {
      lastAnchor.departureTicketId = contribution.ticketId;
      lastAnchor.departureDateTime = contribution.dateTime;
    }
    return;
  }

  anchors.push({
    place,
    arrivalTicketId: contribution.kind === "destination" ? contribution.ticketId : undefined,
    arrivalDateTime: contribution.kind === "destination" ? contribution.dateTime : undefined,
    departureTicketId: contribution.kind === "origin" ? contribution.ticketId : undefined,
    departureDateTime: contribution.kind === "origin" ? contribution.dateTime : undefined,
  });
}

function buildCollapsedRouteAnchors(
  linkedTickets: TicketRecord[],
  options: JourneyPlaceNormalizationOptions,
) {
  const anchors: JourneyStayAnchor[] = [];

  sortTicketsByTripDate(linkedTickets).forEach((ticket) => {
    const endpointPlaces = getTicketEndpointJourneyPlaces(ticket, options);

    appendCollapsedAnchor(anchors, endpointPlaces.origin, {
      kind: "origin",
      ticketId: ticket.id,
      dateTime: ticket.departureTimeLocal || undefined,
    });
    appendCollapsedAnchor(anchors, endpointPlaces.destination, {
      kind: "destination",
      ticketId: ticket.id,
      dateTime: ticket.arrivalTimeLocal || undefined,
    });
  });

  return anchors;
}

function buildAutoSuggestionAnchors(anchors: JourneyStayAnchor[], linkedTicketCount: number) {
  if (anchors.length < 2) {
    return [] satisfies JourneyStayAnchor[];
  }

  if (linkedTicketCount === 1) {
    const originAnchor = anchors[0];
    const destinationAnchor = anchors[anchors.length - 1];
    if (!originAnchor || !destinationAnchor || isEquivalentPlace(originAnchor.place, destinationAnchor.place)) {
      return [] satisfies JourneyStayAnchor[];
    }

    return [destinationAnchor];
  }

  return anchors.slice(1, -1);
}

function toSuggestion(anchor: JourneyStayAnchor, orderHint: number): JourneyStaySuggestion {
  return {
    identity: normalizeStayIdentity(anchor.place.placeKey, anchor.place.displayName),
    placeName: anchor.place.displayName,
    placeKey: anchor.place.placeKey,
    countryCode: anchor.place.countryCode,
    arrivalDateTime: anchor.arrivalDateTime,
    departureDateTime: anchor.departureDateTime,
    arrivalTicketId: anchor.arrivalTicketId,
    departureTicketId: anchor.departureTicketId,
    orderHint,
    autoAdd: anchor.place.confidence !== "low",
    confidence: anchor.place.confidence,
    kind: "destination",
  };
}

function addOrMergeSuggestion(
  suggestions: Map<string, JourneyStaySuggestion>,
  suggestion: JourneyStaySuggestion,
) {
  if (!suggestion.identity) {
    return;
  }

  const existing = suggestions.get(suggestion.identity);
  if (!existing) {
    suggestions.set(suggestion.identity, suggestion);
    return;
  }

  suggestions.set(suggestion.identity, {
    ...existing,
    arrivalDateTime: existing.arrivalDateTime ?? suggestion.arrivalDateTime,
    departureDateTime: existing.departureDateTime ?? suggestion.departureDateTime,
    arrivalTicketId: existing.arrivalTicketId ?? suggestion.arrivalTicketId,
    departureTicketId: existing.departureTicketId ?? suggestion.departureTicketId,
    orderHint: Math.min(existing.orderHint, suggestion.orderHint),
    autoAdd: existing.autoAdd || suggestion.autoAdd,
    confidence:
      existing.confidence === "high" || suggestion.confidence === "high"
        ? "high"
        : existing.confidence === "medium" || suggestion.confidence === "medium"
          ? "medium"
          : "low",
    kind: existing.kind === "destination" || suggestion.kind === "destination" ? "destination" : "transfer",
  });
}

function buildTransferSuggestions(
  linkedTickets: TicketRecord[],
  options: JourneyPlaceNormalizationOptions,
) {
  const suggestions: JourneyStaySuggestion[] = [];
  let orderHint = 10000;

  sortTicketsByTripDate(linkedTickets).forEach((ticket) => {
    const segments = ticket.segments ?? [];
    if (segments.length < 2) {
      return;
    }

    segments.slice(0, -1).forEach((segment, index) => {
      const nextSegment = segments[index + 1];
      const place = normalizeJourneyPlaceFromLocation(segment.arrival, {
        ...options,
        ticketType: ticket.ticketType,
      });
      if (!place) {
        orderHint += 1;
        return;
      }

      suggestions.push({
        identity: normalizeStayIdentity(place.placeKey, place.displayName),
        placeName: place.displayName,
        placeKey: place.placeKey,
        countryCode: place.countryCode,
        arrivalDateTime: segment.arrivalTimeLocal || undefined,
        departureDateTime: nextSegment?.departureTimeLocal || undefined,
        arrivalTicketId: ticket.id,
        departureTicketId: ticket.id,
        orderHint,
        autoAdd: false,
        confidence: place.confidence,
        kind: "transfer",
      });
      orderHint += 1;
    });
  });

  return suggestions;
}

function getNextUnknownOrder(rows: JourneyStayDraft[]) {
  return rows.reduce((maxOrder, row) => {
    return !extractDateKey(row.departureDateTime) && row.unknownOrder > maxOrder
      ? row.unknownOrder
      : maxOrder;
  }, -1) + 1;
}

export function getJourneyStayIdentity(
  stay: Pick<JourneyStayDraft | JourneyStaySuggestion | JourneyStopInput | JourneyStop, "placeKey" | "placeName">,
) {
  return normalizeStayIdentity(stay.placeKey, stay.placeName);
}

export function buildJourneyStaySuggestions(
  linkedTickets: TicketRecord[],
  options: JourneyStayOptions = {},
) {
  if (linkedTickets.length === 0) {
    return [] satisfies JourneyStaySuggestion[];
  }

  const suggestions = new Map<string, JourneyStaySuggestion>();
  const collapsedAnchors = buildCollapsedRouteAnchors(linkedTickets, {
    preferredLanguage: options.preferredLanguage,
  });

  buildAutoSuggestionAnchors(collapsedAnchors, linkedTickets.length).forEach((anchor, index) => {
    addOrMergeSuggestion(suggestions, toSuggestion(anchor, index));
  });

  buildTransferSuggestions(linkedTickets, {
    preferredLanguage: options.preferredLanguage,
  }).forEach((suggestion) => addOrMergeSuggestion(suggestions, suggestion));

  return [...suggestions.values()].sort((left, right) => {
    return left.orderHint - right.orderHint
      || left.placeName.localeCompare(right.placeName)
      || left.identity.localeCompare(right.identity);
  });
}

export function buildJourneyStayDraftFromSuggestion(
  suggestion: JourneyStaySuggestion,
  options: {
    manual?: boolean;
    rows?: JourneyStayDraft[];
  } = {},
) {
  const rows = options.rows ?? [];
  const manual = options.manual ?? false;

  return {
    draftId: createJourneyStayDraftId(),
    placeName: suggestion.placeName,
    placeKey: suggestion.placeKey,
    countryCode: suggestion.countryCode,
    arrivalDateTime: suggestion.arrivalDateTime,
    departureDateTime: suggestion.departureDateTime,
    source: manual ? "manual" : "auto",
    userEdited: manual,
    arrivalTicketId: suggestion.arrivalTicketId,
    departureTicketId: suggestion.departureTicketId,
    sortOrderHint: suggestion.orderHint,
    unknownOrder: extractDateKey(suggestion.departureDateTime) ? suggestion.orderHint : getNextUnknownOrder(rows),
  } satisfies JourneyStayDraft;
}

export function buildJourneyStayDraftFromStop(stop: JourneyStop) {
  return {
    draftId: createJourneyStayDraftId(),
    persistedId: stop.id,
    placeName: stop.placeName,
    placeKey: stop.placeKey,
    countryCode: stop.countryCode,
    arrivalDateTime: stop.arrivalDateTime,
    departureDateTime: stop.departureDateTime,
    source: stop.source,
    userEdited: stop.userEdited,
    arrivalTicketId: stop.arrivalTicketId,
    departureTicketId: stop.departureTicketId,
    sortOrderHint: stop.sortOrder,
    unknownOrder: stop.sortOrder,
  } satisfies JourneyStayDraft;
}

export function createEmptyJourneyStayDraft(rows: JourneyStayDraft[] = []) {
  return {
    draftId: createJourneyStayDraftId(),
    placeName: "",
    placeKey: undefined,
    countryCode: undefined,
    arrivalDateTime: undefined,
    departureDateTime: undefined,
    source: "manual",
    userEdited: true,
    arrivalTicketId: undefined,
    departureTicketId: undefined,
    sortOrderHint: Number.MAX_SAFE_INTEGER,
    unknownOrder: getNextUnknownOrder(rows),
  } satisfies JourneyStayDraft;
}

export function sortJourneyStayDrafts(rows: JourneyStayDraft[]) {
  const sortedRows = [...rows].sort((left, right) => {
    const leftDate = extractDateKey(left.departureDateTime);
    const rightDate = extractDateKey(right.departureDateTime);

    if (leftDate && rightDate) {
      return leftDate.localeCompare(rightDate)
        || left.sortOrderHint - right.sortOrderHint
        || left.placeName.localeCompare(right.placeName)
        || left.draftId.localeCompare(right.draftId);
    }

    if (leftDate) {
      return -1;
    }

    if (rightDate) {
      return 1;
    }

    return left.unknownOrder - right.unknownOrder
      || left.sortOrderHint - right.sortOrderHint
      || left.placeName.localeCompare(right.placeName)
      || left.draftId.localeCompare(right.draftId);
  });

  let nextUnknownOrder = 0;
  return sortedRows.map((row) => {
    if (extractDateKey(row.departureDateTime)) {
      return row;
    }

    const normalizedRow = {
      ...row,
      unknownOrder: nextUnknownOrder,
    };
    nextUnknownOrder += 1;
    return normalizedRow;
  });
}

export function mergeAutoJourneyStayDrafts(
  existingRows: JourneyStayDraft[],
  suggestions: JourneyStaySuggestion[],
  dismissedSuggestionIdentities: string[] = [],
) {
  const dismissed = new Set(dismissedSuggestionIdentities);
  const preservedRows = existingRows.filter((row) => row.source !== "auto" || row.userEdited);
  const occupied = new Set(
    preservedRows.map((row) => getJourneyStayIdentity(row)).filter(Boolean),
  );
  const autoRows = suggestions
    .filter((suggestion) => suggestion.autoAdd && !dismissed.has(suggestion.identity))
    .filter((suggestion) => !occupied.has(suggestion.identity))
    .map((suggestion) => buildJourneyStayDraftFromSuggestion(suggestion, { rows: preservedRows }));

  return sortJourneyStayDrafts([...preservedRows, ...autoRows]);
}

export function addJourneyStayDraftFromSuggestion(
  rows: JourneyStayDraft[],
  suggestion: JourneyStaySuggestion,
) {
  if (!suggestion.identity) {
    return rows;
  }

  if (rows.some((row) => getJourneyStayIdentity(row) === suggestion.identity)) {
    return rows;
  }

  return sortJourneyStayDrafts([
    ...rows,
    buildJourneyStayDraftFromSuggestion(suggestion, {
      manual: true,
      rows,
    }),
  ]);
}

export function moveUnknownJourneyStayDraft(
  rows: JourneyStayDraft[],
  draftId: string,
  direction: -1 | 1,
) {
  const unknownRows = sortJourneyStayDrafts(rows).filter((row) => !extractDateKey(row.departureDateTime));
  const currentIndex = unknownRows.findIndex((row) => row.draftId === draftId);
  if (currentIndex < 0) {
    return sortJourneyStayDrafts(rows);
  }

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= unknownRows.length) {
    return sortJourneyStayDrafts(rows);
  }

  const reordered = [...unknownRows];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, moved);

  const nextOrders = new Map(reordered.map((row, index) => [row.draftId, index]));
  return sortJourneyStayDrafts(
    rows.map((row) =>
      extractDateKey(row.departureDateTime)
        ? row
        : {
            ...row,
            unknownOrder: nextOrders.get(row.draftId) ?? row.unknownOrder,
          },
    ),
  );
}

export function buildJourneyStayDisplay(
  stays: Array<Pick<JourneyStayDraft | JourneyStop | JourneyStopInput, "placeName">>,
  limit?: number,
) {
  return joinJourneyDisplayLabels(stays.map((stay) => stay.placeName), limit);
}

export function buildJourneyStopInputsFromDrafts(rows: JourneyStayDraft[]) {
  return sortJourneyStayDrafts(rows)
    .filter((row) => row.placeName.trim())
    .map((row, index) => ({
      id: row.persistedId,
      placeName: row.placeName.trim(),
      placeKey: row.placeKey,
      countryCode: row.countryCode,
      arrivalDateTime: row.arrivalDateTime,
      departureDateTime: row.departureDateTime,
      lodging: undefined,
      notes: undefined,
      source: row.source,
      arrivalTicketId: row.arrivalTicketId,
      departureTicketId: row.departureTicketId,
      sortOrder: index,
      userEdited: row.userEdited,
    }) satisfies JourneyStopInput);
}




