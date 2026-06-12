import type { Journey, JourneyStop, JourneyStopInput } from "../types/journey";
import type { TicketRecord } from "../types/ticket";
import type { Language } from "./i18n";
import {
  getTicketEndpointJourneyPlaces,
  type JourneyPlace,
  type JourneyPlaceNormalizationOptions,
} from "./journeyPlace";
import { sortTicketsByTripDate } from "./journeySummary";

interface JourneyStopAutoAnchor {
  place: JourneyPlace;
  arrivalTicketId?: string;
  arrivalDateTime?: string;
  departureTicketId?: string;
  departureDateTime?: string;
}

export interface JourneyStopsAutoOptions {
  preferredLanguage?: Language;
}

function normalizeStopIdentity(placeKey?: string, placeName?: string) {
  const normalizedKey = placeKey?.trim().toLowerCase();
  if (normalizedKey) {
    return `key:${normalizedKey}`;
  }

  const normalizedName = placeName?.trim().toLowerCase();
  return normalizedName ? `name:${normalizedName}` : "";
}

function normalizeStopName(placeName?: string) {
  return placeName?.trim().toLowerCase() ?? "";
}

function isEquivalentPlace(
  left: Pick<JourneyStopInput | JourneyStopAutoAnchor["place"], "placeKey"> & { placeName?: string; displayName?: string },
  right: Pick<JourneyStopInput | JourneyStop | JourneyStopAutoAnchor["place"], "placeKey"> & { placeName?: string; displayName?: string },
) {
  const leftKey = left.placeKey?.trim().toLowerCase();
  const rightKey = right.placeKey?.trim().toLowerCase();
  if (leftKey && rightKey && leftKey === rightKey) {
    return true;
  }

  const leftName = normalizeStopName("displayName" in left ? left.displayName : left.placeName);
  const rightName = normalizeStopName("displayName" in right ? right.displayName : right.placeName);
  return Boolean(leftName) && leftName === rightName;
}

function isSameStopIdentity(
  left: Pick<JourneyStopInput, "placeKey" | "placeName">,
  right: Pick<JourneyStopInput | JourneyStop, "placeKey" | "placeName">,
) {
  return isEquivalentPlace(left, right);
}

function appendCollapsedAnchor(anchors: JourneyStopAutoAnchor[], place: JourneyPlace | null, contribution: {
  kind: "origin" | "destination";
  ticketId: string;
  dateTime?: string;
}) {
  if (!place) {
    return;
  }

  const nextIdentity = normalizeStopIdentity(place.placeKey, place.displayName);
  if (!nextIdentity) {
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
  const anchors: JourneyStopAutoAnchor[] = [];

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

function buildAutoStopFromAnchor(anchor: JourneyStopAutoAnchor, sortOrder: number): JourneyStopInput {
  return {
    placeName: anchor.place.displayName,
    placeKey: anchor.place.placeKey,
    countryCode: anchor.place.countryCode,
    arrivalDateTime: anchor.arrivalDateTime,
    departureDateTime: anchor.departureDateTime,
    lodging: undefined,
    notes: undefined,
    source: "auto",
    arrivalTicketId: anchor.arrivalTicketId,
    departureTicketId: anchor.departureTicketId,
    sortOrder,
    userEdited: false,
  };
}

function isManualJourneyStop(stop: JourneyStop) {
  return stop.userEdited || stop.source !== "auto";
}

function toJourneyStopInput(stop: JourneyStop): JourneyStopInput {
  return {
    id: stop.id,
    placeName: stop.placeName,
    placeKey: stop.placeKey,
    countryCode: stop.countryCode,
    arrivalDateTime: stop.arrivalDateTime,
    departureDateTime: stop.departureDateTime,
    lodging: stop.lodging,
    notes: stop.notes,
    source: stop.source,
    arrivalTicketId: stop.arrivalTicketId,
    departureTicketId: stop.departureTicketId,
    sortOrder: stop.sortOrder,
    userEdited: stop.userEdited,
  };
}

export function deriveAutoJourneyStops(
  journey: Journey,
  linkedTickets: TicketRecord[],
  options: JourneyStopsAutoOptions = {},
) {
  if (!journey.id || linkedTickets.length === 0) {
    return [] satisfies JourneyStopInput[];
  }

  const anchors = buildCollapsedRouteAnchors(linkedTickets, {
    preferredLanguage: options.preferredLanguage,
  });

  if (anchors.length < 2) {
    return [] satisfies JourneyStopInput[];
  }

  if (linkedTickets.length === 1) {
    const originAnchor = anchors[0];
    const destinationAnchor = anchors[anchors.length - 1];
    if (isEquivalentPlace(originAnchor.place, destinationAnchor.place)) {
      return [] satisfies JourneyStopInput[];
    }

    return [buildAutoStopFromAnchor(destinationAnchor, 0)];
  }

  return anchors
    .slice(1, -1)
    .map((anchor, index) => buildAutoStopFromAnchor(anchor, index));
}

export function mergeJourneyStopsWithDerivedAutoStops(
  existingStops: JourneyStop[],
  derivedAutoStops: JourneyStopInput[],
) {
  const mergedStops = [...derivedAutoStops];
  const manualStops = existingStops.filter(isManualJourneyStop);

  manualStops.forEach((manualStop) => {
    const manualInput = toJourneyStopInput(manualStop);
    const duplicateIndex = mergedStops.findIndex((stop) => isSameStopIdentity(stop, manualInput));

    if (duplicateIndex >= 0) {
      mergedStops[duplicateIndex] = manualInput;
      return;
    }

    mergedStops.push(manualInput);
  });

  return mergedStops.map((stop, index) => ({
    ...stop,
    sortOrder: index,
  }));
}

export function buildLinkedJourneyTickets(journey: Journey, tickets: TicketRecord[]) {
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return journey.ticketIds
    .map((ticketId) => ticketsById.get(ticketId))
    .filter((ticket): ticket is TicketRecord => Boolean(ticket));
}
