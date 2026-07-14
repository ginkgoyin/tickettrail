import type { Journey } from "../types/journey";
import type { TicketRecord } from "../types/ticket";
import type { JourneySummaryBase } from "./journeySummary";

export type OverviewScope = "all" | TicketRecord["ticketType"];

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

export function deriveActiveOverviewYear(
  journeys: Journey[],
  tickets: TicketRecord[],
  currentCalendarYear = String(new Date().getFullYear()),
) {
  const discoveredYears = new Set<string>();

  journeys.forEach((journey) => {
    [journey.startDate, journey.endDate, journey.updatedAt].forEach((value) => {
      const year = collectOverviewYearFromValue(value);
      if (year) {
        discoveredYears.add(year);
      }
    });
  });

  tickets.forEach((ticket) => {
    [ticket.departureTimeLocal, ticket.arrivalTimeLocal, ticket.createdAt].forEach((value) => {
      const year = collectOverviewYearFromValue(value);
      if (year) {
        discoveredYears.add(year);
      }
    });
  });

  if (discoveredYears.has(currentCalendarYear)) {
    return currentCalendarYear;
  }

  const sortedYears = [...discoveredYears].sort((left, right) => right.localeCompare(left));
  return sortedYears[0] ?? currentCalendarYear;
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

export function deriveOverviewScopedSnapshot(
  journeys: Journey[],
  tickets: TicketRecord[],
  scope: OverviewScope,
): OverviewScopedSnapshot {
  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const scopedTickets = filterTicketsByOverviewScope(tickets, scope);
  const scopedJourneys = journeys.filter((journey) => journeyMatchesOverviewScope(journey, ticketsById, scope));

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
) {
  if (kind === "records") {
    if (scope === "flight") {
      return "No flight records in this scope.";
    }
    if (scope === "train") {
      return "No rail records in this scope.";
    }
    return "No travel records yet.";
  }

  if (kind === "journeys") {
    if (scope === "flight") {
      return "No flight journeys in this scope.";
    }
    if (scope === "train") {
      return "No rail journeys in this scope.";
    }
    return "No journeys yet.";
  }

  if (kind === "tickets") {
    if (scope === "flight") {
      return "No flight tickets in this scope.";
    }
    if (scope === "train") {
      return "No rail tickets in this scope.";
    }
    return "No tickets yet.";
  }

  if (kind === "map") {
    if (scope === "flight") {
      return "No flight routes in this scope.";
    }
    if (scope === "train") {
      return "No rail routes in this scope.";
    }
    return "No travel records yet.";
  }

  if (kind === "focus") {
    if (scope === "flight") {
      return "No flight records in this scope.";
    }
    if (scope === "train") {
      return "No rail records in this scope.";
    }
    return "No travel records yet.";
  }

  if (scope === "flight") {
    return "No flight places in this scope.";
  }
  if (scope === "train") {
    return "No rail places in this scope.";
  }
  return "No favorite places yet.";
}
