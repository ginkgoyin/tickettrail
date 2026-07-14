import type { Journey } from "../types/journey";
import type { TicketRecord } from "../types/ticket";
import type { JourneySummaryBase } from "./journeySummary";

export type OverviewScope = "all" | TicketRecord["ticketType"];
export type OverviewYearFilter = "all" | string;

export interface OverviewScopedSnapshot {
  scope: OverviewScope;
  scopedTickets: TicketRecord[];
  scopedJourneys: Journey[];
}

export interface OverviewFavoritePlace {
  label: string;
  detail: string;
}

function collectOverviewYearFromValue(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 4) {
    return null;
  }

  const year = normalized.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function addCollectedOverviewYear(target: Set<string>, value: string | undefined) {
  const year = collectOverviewYearFromValue(value);
  if (year) {
    target.add(year);
  }
}

function collectTicketOverviewYears(ticket: TicketRecord) {
  const discoveredYears = new Set<string>();
  [ticket.departureTimeLocal, ticket.arrivalTimeLocal].forEach((value) => {
    addCollectedOverviewYear(discoveredYears, value);
  });
  return discoveredYears;
}

function collectJourneyOverviewYears(journey: Journey) {
  const discoveredYears = new Set<string>();
  [journey.startDate, journey.endDate].forEach((value) => {
    addCollectedOverviewYear(discoveredYears, value);
  });
  return discoveredYears;
}

function sortOverviewYears(years: Iterable<string>) {
  return [...years].sort((left, right) => right.localeCompare(left));
}

function ticketMatchesOverviewYear(ticket: TicketRecord, selectedYear: string) {
  return [...collectTicketOverviewYears(ticket)].some((year) => year === selectedYear);
}

function journeyDateRangeOverlapsOverviewYear(journey: Journey, selectedYear: string) {
  return collectJourneyOverviewYears(journey).has(selectedYear);
}

export function deriveAvailableOverviewYears(
  journeys: Journey[],
  tickets: TicketRecord[],
) {
  const availableYears = new Set<string>();

  tickets.forEach((ticket) => {
    collectTicketOverviewYears(ticket).forEach((year) => availableYears.add(year));
  });

  journeys.forEach((journey) => {
    collectJourneyOverviewYears(journey).forEach((year) => availableYears.add(year));
  });

  return sortOverviewYears(availableYears);
}

export function deriveDefaultOverviewYear(
  availableYears: string[],
  currentCalendarYear = String(new Date().getFullYear()),
) {
  if (availableYears.includes(currentCalendarYear)) {
    return currentCalendarYear;
  }

  return availableYears[0] ?? currentCalendarYear;
}

export function deriveActiveOverviewYear(
  journeys: Journey[],
  tickets: TicketRecord[],
  currentCalendarYear = String(new Date().getFullYear()),
) {
  const availableYears = deriveAvailableOverviewYears(journeys, tickets);
  return deriveDefaultOverviewYear(availableYears, currentCalendarYear);
}

export function filterTicketsByOverviewScope(tickets: TicketRecord[], scope: OverviewScope) {
  if (scope === "all") {
    return tickets;
  }

  return tickets.filter((ticket) => ticket.ticketType === scope);
}

export function journeyMatchesOverviewScope(
  journey: Journey,
  ticketsById: Map<string, TicketRecord>,
  scope: OverviewScope,
) {
  if (scope === "all") {
    return true;
  }

  return journey.ticketIds.some((ticketId) => ticketsById.get(ticketId)?.ticketType === scope);
}

function journeyMatchesOverviewYear(
  journey: Journey,
  ticketsById: Map<string, TicketRecord>,
  scope: OverviewScope,
  selectedYear: string,
) {
  const linkedTickets = journey.ticketIds
    .map((ticketId) => ticketsById.get(ticketId))
    .filter((ticket): ticket is TicketRecord => Boolean(ticket));

  const relevantTickets = scope === "all"
    ? linkedTickets
    : linkedTickets.filter((ticket) => ticket.ticketType === scope);

  if (!relevantTickets.length && scope !== "all") {
    return false;
  }

  if (relevantTickets.some((ticket) => ticketMatchesOverviewYear(ticket, selectedYear))) {
    return true;
  }

  if (!journeyDateRangeOverlapsOverviewYear(journey, selectedYear)) {
    return false;
  }

  if (scope === "all") {
    return true;
  }

  const datedRelevantTickets = relevantTickets.filter((ticket) => collectTicketOverviewYears(ticket).size > 0);
  return datedRelevantTickets.length === 0;
}

export function deriveOverviewScopedSnapshot(
  journeys: Journey[],
  tickets: TicketRecord[],
  scope: OverviewScope,
  selectedYear: OverviewYearFilter = "all",
): OverviewScopedSnapshot {
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const scopeMatchedTickets = filterTicketsByOverviewScope(tickets, scope);
  const scopedTickets = selectedYear === "all"
    ? scopeMatchedTickets
    : scopeMatchedTickets.filter((ticket) => ticketMatchesOverviewYear(ticket, selectedYear));
  const scopedJourneys = journeys.filter((journey) => {
    if (!journeyMatchesOverviewScope(journey, ticketsById, scope)) {
      return false;
    }

    if (selectedYear === "all") {
      return true;
    }

    return journeyMatchesOverviewYear(journey, ticketsById, scope, selectedYear);
  });

  return {
    scope,
    scopedTickets,
    scopedJourneys,
  };
}

export function getOverviewScopeLabel(scope: OverviewScope) {
  if (scope === "flight") {
    return "Flights";
  }
  if (scope === "train") {
    return "Rail";
  }
  return "All";
}

export function countUniqueOverviewTicketPlaces(tickets: TicketRecord[]) {
  const seen = new Set<string>();

  tickets.forEach((ticket) => {
    [ticket.departure?.name, ticket.arrival?.name].forEach((name) => {
      const normalized = name?.trim().toLowerCase();
      if (normalized) {
        seen.add(normalized);
      }
    });
  });

  return seen.size;
}

export function getOverviewTicketDayCount(tickets: TicketRecord[]) {
  const dayKeys = new Set<string>();

  tickets.forEach((ticket) => {
    [ticket.departureTimeLocal, ticket.arrivalTimeLocal].forEach((value) => {
      const normalized = value?.trim();
      if (normalized && normalized.length >= 10) {
        dayKeys.add(normalized.slice(0, 10));
      }
    });
  });

  return dayKeys.size;
}

function formatOverviewCount(value: number) {
  return value.toLocaleString("en-AU");
}

export function buildOverviewFavoritePlaces(
  scope: OverviewScope,
  summaryBase: JourneySummaryBase | null,
  scopedTickets: TicketRecord[],
): OverviewFavoritePlace[] {
  if (scope === "all" && summaryBase?.topDestinations.length) {
    return summaryBase.topDestinations.slice(0, 4).map((item) => ({
      label: item.label,
      detail: `${formatOverviewCount(item.journeyCount)} journey${item.journeyCount === 1 ? "" : "s"}`,
    }));
  }

  const counter = new Map<string, number>();
  scopedTickets.forEach((ticket) => {
    [ticket.departure?.name, ticket.arrival?.name].forEach((name) => {
      const label = name?.trim();
      if (!label) {
        return;
      }
      counter.set(label, (counter.get(label) ?? 0) + 1);
    });
  });

  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      detail: `${formatOverviewCount(count)} touchpoint${count === 1 ? "" : "s"}`,
    }));
}

export function getOverviewEmptyStateCopy(
  scope: OverviewScope,
  kind: "records" | "journeys" | "tickets" | "map" | "focus" | "favorites",
  selectedYear: OverviewYearFilter = "all",
) {
  const hasSpecificYear = selectedYear !== "all";
  const yearSuffix = hasSpecificYear ? ` for ${selectedYear}.` : "";

  if (kind === "records") {
    if (scope === "flight") {
      return hasSpecificYear ? `No flight records${yearSuffix}` : "No flight records in this scope.";
    }
    if (scope === "train") {
      return hasSpecificYear ? `No rail records${yearSuffix}` : "No rail records in this scope.";
    }
    return hasSpecificYear ? `No records${yearSuffix}` : "No travel records yet.";
  }

  if (kind === "journeys") {
    if (scope === "flight") {
      return hasSpecificYear ? `No flight journeys${yearSuffix}` : "No flight journeys in this scope.";
    }
    if (scope === "train") {
      return hasSpecificYear ? `No rail journeys${yearSuffix}` : "No rail journeys in this scope.";
    }
    return hasSpecificYear ? `No journeys${yearSuffix}` : "No journeys yet.";
  }

  if (kind === "tickets") {
    if (scope === "flight") {
      return hasSpecificYear ? `No flight tickets${yearSuffix}` : "No flight tickets in this scope.";
    }
    if (scope === "train") {
      return hasSpecificYear ? `No rail tickets${yearSuffix}` : "No rail tickets in this scope.";
    }
    return hasSpecificYear ? `No tickets${yearSuffix}` : "No tickets yet.";
  }

  if (kind === "map") {
    if (scope === "flight") {
      return hasSpecificYear ? `No flight routes${yearSuffix}` : "No flight routes in this scope.";
    }
    if (scope === "train") {
      return hasSpecificYear ? `No rail routes${yearSuffix}` : "No rail routes in this scope.";
    }
    return hasSpecificYear ? `No routes${yearSuffix}` : "No travel records yet.";
  }

  if (kind === "focus") {
    if (scope === "flight") {
      return hasSpecificYear ? `No flight records${yearSuffix}` : "No flight records in this scope.";
    }
    if (scope === "train") {
      return hasSpecificYear ? `No rail records${yearSuffix}` : "No rail records in this scope.";
    }
    return hasSpecificYear ? `No records${yearSuffix}` : "No travel records yet.";
  }

  if (scope === "flight") {
    return hasSpecificYear ? `No flight places${yearSuffix}` : "No flight places in this scope.";
  }
  if (scope === "train") {
    return hasSpecificYear ? `No rail places${yearSuffix}` : "No rail places in this scope.";
  }
  return hasSpecificYear ? `No places${yearSuffix}` : "No favorite places yet.";
}
