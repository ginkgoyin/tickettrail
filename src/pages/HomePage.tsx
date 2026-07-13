import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { listJourneys } from "../lib/journeyService";
import {
  buildJourneySummaryBase,
  buildJourneySummaryCalendar,
  sortJourneysByStartDate,
  type JourneySummaryBase,
} from "../lib/journeySummary";
import { getTicketDetail } from "../lib/ticketService";
import type { Journey } from "../types/journey";
import type {
  MapPointPayload,
  MapRoutePayload,
  MapSegmentPayload,
  TicketDetailPayload,
  TicketRecord,
} from "../types/ticket";

const RouteMap = lazy(async () => import("../components/RouteMap").then((module) => ({ default: module.RouteMap })));

type OverviewScope = "all" | TicketRecord["ticketType"];

const OVERVIEW_SCOPE_OPTIONS: Array<{ label: string; value: OverviewScope }> = [
  { label: "All", value: "all" },
  { label: "Flights", value: "flight" },
  { label: "Rail", value: "train" },
];

interface HomePageProps {
  tickets: TicketRecord[];
  onOpenTicket: (ticketId: string) => void;
}

interface OverviewMapPayload {
  points: MapPointPayload[];
  route: MapRoutePayload;
  segments: MapSegmentPayload[];
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasUsableMapPoint(point: MapPointPayload | null | undefined): point is MapPointPayload {
  return Boolean(
    point &&
      typeof point.label === "string" &&
      point.label.trim().length > 0 &&
      typeof point.timezone === "string" &&
      point.timezone.trim().length > 0 &&
      isFiniteNumber(point.latitude) &&
      isFiniteNumber(point.longitude),
  );
}

function hasUsableMapSegment(segment: MapSegmentPayload | null | undefined): segment is MapSegmentPayload {
  return Boolean(
    segment &&
      typeof segment.lineLabel === "string" &&
      typeof segment.directionHint === "string" &&
      hasUsableMapPoint(segment.origin) &&
      hasUsableMapPoint(segment.destination),
  );
}

function buildOverviewMapPayload(details: TicketDetailPayload[]): OverviewMapPayload | null {
  const segments = details
    .flatMap((detail) =>
      detail.segments.map((segment) => ({
        ...segment,
        ticketId: detail.ticket.id,
      })),
    )
    .filter(hasUsableMapSegment)
    .map((segment, index) => ({
      ...segment,
      segmentIndex: index,
    }));

  if (!segments.length) {
    return null;
  }

  const allPoints = segments.flatMap((segment) => [segment.origin, segment.destination]);
  const uniquePoints = Array.from(
    allPoints.reduce((counter, point) => {
      const key = `${point.code || point.label}-${point.latitude}-${point.longitude}`;
      if (!counter.has(key)) {
        counter.set(key, point);
      }
      return counter;
    }, new Map<string, MapPointPayload>()),
  ).map((entry) => entry[1]);
  const orderedDetails = [...details].sort((left, right) =>
    safeText(left.ticket.departureTimeLocal).localeCompare(safeText(right.ticket.departureTimeLocal)),
  );
  const firstSegment = orderedDetails[0]?.segments[0] ?? segments[0];
  const lastDetail = orderedDetails[orderedDetails.length - 1];
  const lastSegment = lastDetail?.segments[lastDetail.segments.length - 1] ?? segments[segments.length - 1];
  const minLatitude = Math.min(...allPoints.map((point) => point.latitude!));
  const maxLatitude = Math.max(...allPoints.map((point) => point.latitude!));
  const minLongitude = Math.min(...allPoints.map((point) => point.longitude!));
  const maxLongitude = Math.max(...allPoints.map((point) => point.longitude!));
  const totalDistanceKm = segments.reduce((sum, segment) => sum + (segment.distanceHintKm ?? 0), 0);

  return {
    points: uniquePoints,
    route: {
      lineLabel: `${details.length} ticket archive`,
      directionHint: `${firstSegment.origin.label} -> ${lastSegment.destination.label}`,
      distanceHintKm: totalDistanceKm,
      origin: firstSegment.origin,
      destination: lastSegment.destination,
      viewport: {
        minLatitude,
        maxLatitude,
        minLongitude,
        maxLongitude,
      },
    },
    segments,
  };
}

function formatDisplayDate(value?: string) {
  const normalized = safeText(value).trim();
  if (!normalized) {
    return "No date yet";
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00`)
    : new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatJourneyDateRange(journey: Journey) {
  const start = formatDisplayDate(journey.startDate);
  const end = formatDisplayDate(journey.endDate);

  if (journey.startDate && journey.endDate) {
    return start === end ? start : `${start} ~ ${end}`;
  }

  return start !== "No date yet" ? start : end;
}

function formatTicketDate(ticket: TicketRecord) {
  return formatDisplayDate(ticket.departureTimeLocal || ticket.arrivalTimeLocal || ticket.createdAt);
}

function formatCount(value: number) {
  return value.toLocaleString("en-AU");
}

function formatCurrencyValue(value: number) {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatJourneyCost(journey: Journey) {
  if (typeof journey.costAmount !== "number" || !Number.isFinite(journey.costAmount)) {
    return null;
  }

  if (journey.costCurrency) {
    return `${journey.costCurrency.toUpperCase()} ${formatCurrencyValue(journey.costAmount)}`;
  }

  return formatCurrencyValue(journey.costAmount);
}

function buildArchiveCostLabel(summaryBase: JourneySummaryBase | null) {
  if (!summaryBase) {
    return null;
  }

  if (typeof summaryBase.comparableCostCnyTotal === "number" && Number.isFinite(summaryBase.comparableCostCnyTotal)) {
    return `Approx. CNY ${formatCurrencyValue(summaryBase.comparableCostCnyTotal)}`;
  }

  if (summaryBase.costByCurrency.length === 1) {
    const entry = summaryBase.costByCurrency[0]!;
    return `${entry.currency} ${formatCurrencyValue(entry.totalAmount)}`;
  }

  if (summaryBase.costByCurrency.length > 1) {
    return "Mixed currencies";
  }

  return null;
}

function countUniqueTicketPlaces(tickets: TicketRecord[]) {
  const seen = new Set<string>();

  tickets.forEach((ticket) => {
    [ticket.departure?.name, ticket.arrival?.name].forEach((name) => {
      const normalized = safeText(name).trim();
      if (normalized) {
        seen.add(normalized.toLowerCase());
      }
    });
  });

  return seen.size;
}

function getTicketDayCount(tickets: TicketRecord[]) {
  const dayKeys = new Set<string>();

  tickets.forEach((ticket) => {
    [ticket.departureTimeLocal, ticket.arrivalTimeLocal].forEach((value) => {
      const normalized = safeText(value).trim();
      if (normalized.length >= 10) {
        dayKeys.add(normalized.slice(0, 10));
      }
    });
  });

  return dayKeys.size;
}

function isUpcomingJourney(journey: Journey, todayKey: string) {
  const comparisonDate = journey.startDate ?? journey.endDate ?? "";
  return comparisonDate >= todayKey;
}

function buildUpcomingJourneys(journeys: Journey[], todayKey: string) {
  return journeys
    .filter((journey) => isUpcomingJourney(journey, todayKey))
    .sort((left, right) => {
      const leftDate = left.startDate ?? left.endDate ?? "9999-99-99";
      const rightDate = right.startDate ?? right.endDate ?? "9999-99-99";
      return leftDate.localeCompare(rightDate) || right.updatedAt.localeCompare(left.updatedAt);
    });
}

function buildUpcomingTickets(tickets: TicketRecord[], nowIso: string) {
  return [...tickets]
    .filter((ticket) => ticket.status !== "archived")
    .filter((ticket) => {
      const dateValue = safeText(ticket.departureTimeLocal).trim() || safeText(ticket.arrivalTimeLocal).trim();
      return dateValue ? dateValue >= nowIso : false;
    })
    .sort((left, right) => {
      const leftDate = safeText(left.departureTimeLocal).trim() || safeText(left.arrivalTimeLocal).trim();
      const rightDate = safeText(right.departureTimeLocal).trim() || safeText(right.arrivalTimeLocal).trim();
      return leftDate.localeCompare(rightDate) || left.createdAt.localeCompare(right.createdAt);
    });
}

function buildRecentTickets(tickets: TicketRecord[]) {
  return [...tickets].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildFavoritePlaces(summaryBase: JourneySummaryBase | null, tickets: TicketRecord[]) {
  if (summaryBase?.topDestinations.length) {
    return summaryBase.topDestinations.slice(0, 4).map((item) => ({
      label: item.label,
      detail: `${formatCount(item.journeyCount)} journey${item.journeyCount === 1 ? "" : "s"}`,
    }));
  }

  const counter = new Map<string, number>();
  tickets.forEach((ticket) => {
    [ticket.departure?.name, ticket.arrival?.name].forEach((name) => {
      const label = safeText(name).trim();
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
      detail: `${formatCount(count)} touchpoint${count === 1 ? "" : "s"}`,
    }));
}

function filterTicketsByScope(tickets: TicketRecord[], scope: OverviewScope) {
  if (scope === "all") {
    return tickets;
  }

  return tickets.filter((ticket) => ticket.ticketType === scope);
}

function journeyMatchesScope(
  journey: Journey,
  ticketsById: Map<string, TicketRecord>,
  scope: OverviewScope,
) {
  if (scope === "all") {
    return true;
  }

  return journey.ticketIds.some((ticketId) => ticketsById.get(ticketId)?.ticketType === scope);
}

function getScopeLabel(scope: OverviewScope) {
  if (scope === "flight") {
    return "Flights";
  }
  if (scope === "train") {
    return "Rail";
  }
  return "All";
}

export function HomePage({ tickets, onOpenTicket }: HomePageProps) {
  const [scope, setScope] = useState<OverviewScope>("all");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  const [journeyError, setJourneyError] = useState("");
  const [mapDetails, setMapDetails] = useState<TicketDetailPayload[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadJourneys = async () => {
      setJourneysLoading(true);
      try {
        const storedJourneys = await listJourneys();
        if (!isMounted) {
          return;
        }
        setJourneys(storedJourneys);
        setJourneyError("");
      } catch (error) {
        if (isMounted) {
          setJourneys([]);
          setJourneyError(error instanceof Error ? error.message : "Failed to load journeys.");
        }
      } finally {
        if (isMounted) {
          setJourneysLoading(false);
        }
      }
    };

    void loadJourneys();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMapDetails = async () => {
      if (!tickets.length) {
        setMapDetails([]);
        return;
      }

      setMapLoading(true);
      try {
        const detailPayloads = await Promise.all(
          tickets.map(async (ticket) => {
            try {
              return await getTicketDetail(ticket.id);
            } catch {
              return null;
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        setMapDetails(detailPayloads.filter((detail): detail is TicketDetailPayload => Boolean(detail)));
      } finally {
        if (isMounted) {
          setMapLoading(false);
        }
      }
    };

    void loadMapDetails();

    return () => {
      isMounted = false;
    };
  }, [tickets]);

  const currentYear = String(new Date().getFullYear());
  const todayKey = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString().slice(0, 16);

  const ticketsById = useMemo(() => new Map(tickets.map((ticket) => [ticket.id, ticket])), [tickets]);
  const scopedTickets = useMemo(() => filterTicketsByScope(tickets, scope), [scope, tickets]);
  const scopedTicketIds = useMemo(() => new Set(scopedTickets.map((ticket) => ticket.id)), [scopedTickets]);
  const scopedMapDetails = useMemo(
    () => mapDetails.filter((detail) => scopedTicketIds.has(detail.ticket.id)),
    [mapDetails, scopedTicketIds],
  );
  const scopedJourneys = useMemo(
    () => journeys.filter((journey) => journeyMatchesScope(journey, ticketsById, scope)),
    [journeys, scope, ticketsById],
  );

  const sortedJourneys = useMemo(() => sortJourneysByStartDate(scopedJourneys), [scopedJourneys]);
  const upcomingJourneys = useMemo(() => buildUpcomingJourneys(scopedJourneys, todayKey), [scopedJourneys, todayKey]);
  const upcomingTickets = useMemo(() => buildUpcomingTickets(scopedTickets, nowIso), [scopedTickets, nowIso]);
  const recentTickets = useMemo(() => buildRecentTickets(scopedTickets), [scopedTickets]);
  const overviewMap = useMemo(() => buildOverviewMapPayload(scopedMapDetails), [scopedMapDetails]);

  const summaryBase = useMemo(() => {
    if (!scopedJourneys.length) {
      return null;
    }

    return buildJourneySummaryBase(scopedJourneys, scopedTickets, currentYear);
  }, [currentYear, scopedJourneys, scopedTickets]);

  const yearSummary = useMemo(() => {
    if (!summaryBase) {
      return null;
    }

    return buildJourneySummaryCalendar(summaryBase, currentYear);
  }, [currentYear, summaryBase]);

  const focusJourney = upcomingJourneys[0] ?? sortedJourneys[0] ?? null;
  const focusTicket = focusJourney ? null : upcomingTickets[0] ?? recentTickets[0] ?? null;
  const recentJourneys = sortedJourneys.slice(0, 4);
  const recentScopedTickets = (upcomingTickets.length ? upcomingTickets : recentTickets).slice(0, 4);
  const favoritePlaces = useMemo(
    () => buildFavoritePlaces(scope === "all" ? summaryBase : null, scopedTickets),
    [scope, scopedTickets, summaryBase],
  );

  const archiveSnapshot = {
    journeyCount: scopedJourneys.length,
    ticketCount: scopedTickets.length,
    travelDays: summaryBase?.allTravelDays ?? getTicketDayCount(scopedTickets),
    destinationCount: scope === "all"
      ? (summaryBase?.topDestinations.length ?? countUniqueTicketPlaces(scopedTickets))
      : countUniqueTicketPlaces(scopedTickets),
    totalCostLabel: buildArchiveCostLabel(summaryBase),
  };

  const thisYearHighlights = {
    journeyCount: yearSummary?.selectedYearJourneys ?? 0,
    travelDays: yearSummary?.selectedYearTravelDays ?? 0,
    ticketCount: scopedTickets.filter((ticket) => {
      const dateValue = safeText(ticket.departureTimeLocal).trim() || safeText(ticket.createdAt).trim();
      return dateValue.startsWith(`${currentYear}-`);
    }).length,
    busiestMonth: summaryBase?.busiestMonth?.monthKey ?? "--",
  };

  return (
    <section className="overview-home">
      <div className="overview-topbar">
        <h2>Overview</h2>
        <div aria-label="Overview transport scope" className="overview-scope-toggle analytics-toggle-group" role="tablist">
          {OVERVIEW_SCOPE_OPTIONS.map((option) => (
            <button
              aria-selected={scope === option.value}
              className={`theme-chip ${scope === option.value ? "active" : ""}`}
              key={option.value}
              onClick={() => setScope(option.value)}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="panel overview-section overview-snapshot-section">
        <div className="overview-title-row">
          <h3>Total overview</h3>
          <span className="overview-scope-note">{getScopeLabel(scope)}</span>
        </div>
        <div className="overview-stat-strip">
          <article className="overview-stat-cell">
            <span>Journeys</span>
            <strong>{formatCount(archiveSnapshot.journeyCount)}</strong>
          </article>
          <article className="overview-stat-cell">
            <span>Tickets</span>
            <strong>{formatCount(archiveSnapshot.ticketCount)}</strong>
          </article>
          <article className="overview-stat-cell">
            <span>Travel days</span>
            <strong>{archiveSnapshot.travelDays ? formatCount(archiveSnapshot.travelDays) : "--"}</strong>
          </article>
          <article className="overview-stat-cell">
            <span>Places</span>
            <strong>{archiveSnapshot.destinationCount ? formatCount(archiveSnapshot.destinationCount) : "--"}</strong>
          </article>
          <article className="overview-stat-cell overview-stat-cell-wide">
            <span>Total cost</span>
            <strong>{archiveSnapshot.totalCostLabel ?? "Not available yet"}</strong>
          </article>
        </div>
      </section>

      <section className="panel overview-section overview-map-section">
        <div className="overview-title-row">
          <h3>Travel map</h3>
          {overviewMap ? <span className="overview-section-meta">{formatCount(overviewMap.segments.length)} legs</span> : null}
        </div>
        {overviewMap ? (
          <>
            <div className="overview-map-shell">
              <Suspense fallback={<p className="detail-loading">Loading archive map...</p>}>
                <RouteMap
                  points={overviewMap.points}
                  route={overviewMap.route}
                  segments={overviewMap.segments}
                  variant="summary"
                />
              </Suspense>
            </div>
            <div className="overview-map-meta">
              <span>{`${formatCount(scopedTickets.length)} tickets`}</span>
              <span>{`${formatCount(overviewMap.points.length)} places`}</span>
              <span>{scope === "all" ? "Flights and rail" : scope === "flight" ? "Flights only" : "Rail only"}</span>
            </div>
          </>
        ) : mapLoading ? (
          <div className="overview-empty-state compact">
            <strong>Loading map...</strong>
          </div>
        ) : scopedTickets.length ? (
          <div className="overview-empty-state compact">
            <strong>Travel map is unavailable</strong>
            <p>Not enough safe route data is available in the current scope.</p>
          </div>
        ) : (
          <div className="overview-empty-state compact">
            <strong>No tickets in this scope</strong>
            <p>Switch back to All or add more tickets.</p>
          </div>
        )}
      </section>

      <section className="panel overview-section overview-focus-section">
        <div className="overview-title-row">
          <h3>What matters next</h3>
        </div>
        {focusJourney ? (
          <article className="overview-focus-card">
            <div className="overview-focus-meta">
              <span className="status-pill">{upcomingJourneys[0]?.id === focusJourney.id ? "Next journey" : "Recent journey"}</span>
              {formatJourneyCost(focusJourney) ? <span className="overview-muted-inline">{formatJourneyCost(focusJourney)}</span> : null}
            </div>
            <h4>{focusJourney.title}</h4>
            <p className="overview-focus-range">{formatJourneyDateRange(focusJourney)}</p>
            <div className="overview-focus-tags">
              <span>{`${formatCount(focusJourney.ticketIds.length)} linked ticket${focusJourney.ticketIds.length === 1 ? "" : "s"}`}</span>
              <span>{focusJourney.destination?.trim() || "Destination from stays and linked tickets"}</span>
            </div>
          </article>
        ) : focusTicket ? (
          <article className="overview-focus-card">
            <div className="overview-focus-meta">
              <span className="status-pill">{upcomingTickets[0]?.id === focusTicket.id ? "Next ticket" : "Recent ticket"}</span>
              <span className="overview-muted-inline">{focusTicket.ticketType === "flight" ? "Flight" : "Rail"}</span>
            </div>
            <h4>{focusTicket.routeLabel}</h4>
            <p className="overview-focus-range">{formatTicketDate(focusTicket)}</p>
            <div className="overview-focus-actions">
              <span className="overview-focus-tags-single">{safeText(focusTicket.carrierName, "Carrier pending")}</span>
              <button className="ghost-button compact-button" onClick={() => onOpenTicket(focusTicket.id)} type="button">
                Open ticket
              </button>
            </div>
          </article>
        ) : (
          <div className="overview-empty-state compact">
            <strong>Nothing to focus on yet</strong>
            <p>{scope === "all" ? "Create a journey or add a ticket to start building the archive." : `No ${scope === "flight" ? "flight" : "rail"} journeys or tickets match this scope yet.`}</p>
          </div>
        )}
      </section>

      <section className="overview-two-column-grid">
        <section className="panel overview-section overview-list-panel">
          <div className="overview-title-row">
            <h3>Recent journeys</h3>
            {scope !== "all" ? <span className="overview-section-meta">Whole journeys in scope</span> : null}
          </div>
          {recentJourneys.length ? (
            <div className="overview-list-shell">
              {recentJourneys.map((journey) => (
                <article className="overview-list-row" key={journey.id}>
                  <div>
                    <strong>{journey.title}</strong>
                    <p>{formatJourneyDateRange(journey)}</p>
                  </div>
                  <div className="overview-list-side">
                    <span>{journey.destination?.trim() || `${formatCount(journey.ticketIds.length)} tickets`}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : journeysLoading ? (
            <div className="overview-empty-state compact">
              <strong>Loading journeys...</strong>
            </div>
          ) : (
            <div className="overview-empty-state compact">
              <strong>No journeys yet</strong>
              <p>{journeyError || "Journeys will appear here once tickets are grouped into trips."}</p>
            </div>
          )}
        </section>

        <section className="panel overview-section overview-list-panel">
          <div className="overview-title-row">
            <h3>Tickets</h3>
            <span className="overview-section-meta">{upcomingTickets.length ? "Upcoming first" : "Recent first"}</span>
          </div>
          {recentScopedTickets.length ? (
            <div className="overview-list-shell">
              {recentScopedTickets.map((ticket) => (
                <button className="overview-list-row overview-list-row-button" key={ticket.id} onClick={() => onOpenTicket(ticket.id)} type="button">
                  <div>
                    <strong>{ticket.routeLabel}</strong>
                    <p>{formatTicketDate(ticket)}</p>
                  </div>
                  <div className="overview-list-side">
                    <span>{ticket.ticketType === "flight" ? "Flight" : "Rail"}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="overview-empty-state compact">
              <strong>No tickets in this scope</strong>
              <p>Switch back to All or save a ticket in this transport type.</p>
            </div>
          )}
        </section>
      </section>

      <section className="overview-two-column-grid overview-highlights-grid">
        <section className="panel overview-section overview-list-panel">
          <div className="overview-title-row">
            <h3>This year</h3>
          </div>
          <div className="overview-highlight-strip">
            <article className="overview-highlight-chip">
              <span>Journeys</span>
              <strong>{formatCount(thisYearHighlights.journeyCount)}</strong>
            </article>
            <article className="overview-highlight-chip">
              <span>Travel days</span>
              <strong>{formatCount(thisYearHighlights.travelDays)}</strong>
            </article>
            <article className="overview-highlight-chip">
              <span>Tickets</span>
              <strong>{formatCount(thisYearHighlights.ticketCount)}</strong>
            </article>
            <article className="overview-highlight-chip">
              <span>Busiest month</span>
              <strong>{thisYearHighlights.busiestMonth}</strong>
            </article>
          </div>
        </section>

        <section className="panel overview-section overview-list-panel">
          <div className="overview-title-row">
            <h3>Favorite places</h3>
            {scope !== "all" ? <span className="overview-section-meta">Ticket-derived in scoped view</span> : null}
          </div>
          {favoritePlaces.length ? (
            <div className="overview-favorites-list">
              {favoritePlaces.map((place) => (
                <article className="overview-favorite-row" key={place.label}>
                  <strong>{place.label}</strong>
                  <span>{place.detail}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="overview-empty-state compact">
              <strong>No favorite places yet</strong>
              <p>Places will gather here once the archive has journeys or mapped ticket endpoints.</p>
            </div>
          )}
        </section>
      </section>
    </section>
  );
}
