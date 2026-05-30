import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  buildMapSvgFromSegments,
  buildStubSvg,
  exportPng,
  exportSvg,
  type StubTheme,
  visualizationSizes,
} from "../lib/visualization";
import { getTicketDetail } from "../lib/ticketService";
import type {
  MapPointPayload,
  MapRoutePayload,
  MapSegmentPayload,
  TicketAttachment,
  TicketDetailPayload,
  TicketRecord,
} from "../types/ticket";

const RouteMap = lazy(async () => import("./RouteMap").then((module) => ({ default: module.RouteMap })));

export type DashboardMode = "overview" | "tickets" | "journeys" | "map";

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
  ticketsInView: TicketRecord[];
  totalCount: number;
  activeArchiveContext: {
    query: string;
    ticketType: "all" | "flight" | "train";
    status: "all" | "saved" | "used" | "archived";
    sort: string;
  };
  attachmentBusy: boolean;
  onAddAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onSelectTicket: (ticketId: string) => void;
  onApplyArchiveFilter: (query: string) => void;
  mode?: DashboardMode;
}

function isImageAttachment(attachment: TicketAttachment) {
  return safeText(attachment.mimeType).startsWith("image/");
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatDateTime(value: unknown) {
  const text = safeText(value).trim();
  if (!text) {
    return "--";
  }

  return text.replace("T", " ").slice(0, 16) || text;
}

function getTicketNumberLabel(ticketType: TicketRecord["ticketType"]) {
  return ticketType === "train" ? "Train No." : "Flight No.";
}

function formatCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";
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

function hasUsableMapRoute(route: MapRoutePayload | null | undefined): route is MapRoutePayload {
  return Boolean(
    route &&
      typeof route.lineLabel === "string" &&
      typeof route.directionHint === "string" &&
      isFiniteNumber(route.distanceHintKm) &&
      hasUsableMapPoint(route.origin) &&
      hasUsableMapPoint(route.destination) &&
      route.viewport &&
      isFiniteNumber(route.viewport.minLatitude) &&
      isFiniteNumber(route.viewport.maxLatitude) &&
      isFiniteNumber(route.viewport.minLongitude) &&
      isFiniteNumber(route.viewport.maxLongitude),
  );
}

function hasUsableMapSegment(segment: MapSegmentPayload | null | undefined): segment is MapSegmentPayload {
  return Boolean(
    segment &&
      typeof segment.lineLabel === "string" &&
      typeof segment.directionHint === "string" &&
      isFiniteNumber(segment.distanceHintKm) &&
      hasUsableMapPoint(segment.origin) &&
      hasUsableMapPoint(segment.destination),
  );
}

function hasRenderableStub(detail: TicketDetailPayload | null) {
  return Boolean(
    detail &&
      typeof detail.stub?.transportBadge === "string" &&
      typeof detail.stub?.carrierName === "string" &&
      typeof detail.stub?.departureLabel === "string" &&
      typeof detail.stub?.arrivalLabel === "string" &&
      typeof detail.stub?.departureTimeLocal === "string" &&
      typeof detail.stub?.arrivalTimeLocal === "string",
  );
}

function buildScopeMapPayload(details: TicketDetailPayload[]) {
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
  const minLatitude = Math.min(...allPoints.map((point) => point.latitude));
  const maxLatitude = Math.max(...allPoints.map((point) => point.latitude));
  const minLongitude = Math.min(...allPoints.map((point) => point.longitude));
  const maxLongitude = Math.max(...allPoints.map((point) => point.longitude));
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceHintKm, 0);
  const firstSegment = orderedDetails[0]?.segments[0] ?? segments[0];
  const lastSegments = orderedDetails[orderedDetails.length - 1]?.segments ?? [];
  const lastSegment = lastSegments[lastSegments.length - 1] ?? segments[segments.length - 1];

  const route: MapRoutePayload = {
    lineLabel: `${details.length} ticket scope`,
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
  };

  return {
    points: uniquePoints,
    route,
    segments,
  };
}

export function Dashboard({
  detail,
  isLoading,
  ticket,
  ticketsInView,
  totalCount,
  activeArchiveContext,
  attachmentBusy,
  onAddAttachment,
  onDeleteAttachment,
  onSelectTicket,
  onApplyArchiveFilter,
  mode = "tickets",
}: DashboardProps) {
  const [exportMessage, setExportMessage] = useState("");
  const [stubTheme, setStubTheme] = useState<StubTheme>("boarding");
  const [scopeDetails, setScopeDetails] = useState<TicketDetailPayload[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scopeDetailCacheRef = useRef(new Map<string, TicketDetailPayload>());
  const activeDetail = ticket && detail?.ticket.id === ticket.id ? detail : null;
  const isTrainTicket = ticket?.ticketType === "train";
  const canRenderActiveMap =
    Boolean(activeDetail) &&
    hasUsableMapRoute(activeDetail?.map) &&
    (activeDetail?.segments ?? []).every(hasUsableMapSegment);
  const canRenderActiveStub = hasRenderableStub(activeDetail);

  useEffect(() => {
    if (!detail) {
      return;
    }

    scopeDetailCacheRef.current.set(`${detail.ticket.id}:${detail.ticket.updatedAt}`, detail);
  }, [detail]);

  useEffect(() => {
    if (!ticket) {
      return;
    }

    setStubTheme(isTrainTicket ? "ledger" : "boarding");
  }, [isTrainTicket, ticket]);

  useEffect(() => {
    let isMounted = true;

    const loadScopeDetails = async () => {
      const visibleScopeTickets = ticketsInView.slice(0, 24);
      if (!visibleScopeTickets.length) {
        setScopeDetails([]);
        return;
      }

      setScopeLoading(true);

      try {
        const nextDetails = await Promise.all(
          visibleScopeTickets.map(async (item) => {
            const cacheKey = `${item.id}:${item.updatedAt}`;
            const cachedDetail = scopeDetailCacheRef.current.get(cacheKey);
            if (cachedDetail) {
              return cachedDetail;
            }

            const fetchedDetail = await getTicketDetail(item.id);
            scopeDetailCacheRef.current.set(
              `${fetchedDetail.ticket.id}:${fetchedDetail.ticket.updatedAt}`,
              fetchedDetail,
            );
            return fetchedDetail;
          }),
        );

        if (isMounted) {
          setScopeDetails(nextDetails);
        }
      } catch {
        if (isMounted) {
          setScopeDetails([]);
        }
      } finally {
        if (isMounted) {
          setScopeLoading(false);
        }
      }
    };

    void loadScopeDetails();

    return () => {
      isMounted = false;
    };
  }, [ticketsInView]);

  const mapSvg = useMemo(
    () =>
      activeDetail && canRenderActiveMap
        ? buildMapSvgFromSegments(activeDetail.map, activeDetail.segments)
        : "",
    [activeDetail, canRenderActiveMap],
  );
  const stubSvg = useMemo(
    () =>
      activeDetail && canRenderActiveStub
        ? buildStubSvg(activeDetail.stub, stubTheme, activeDetail.segments)
        : "",
    [activeDetail, canRenderActiveStub, stubTheme],
  );
  const itinerarySummary = useMemo(() => {
    if (!activeDetail) {
      return null;
    }

    const segmentCount = activeDetail.segments.length;
    const totalDistanceKm = activeDetail.segments.reduce(
      (sum, segment) => sum + segment.distanceHintKm,
      0,
    );
    const firstSegment = activeDetail.segments[0];
    const lastSegment = activeDetail.segments[segmentCount - 1];

    return {
      segmentCount,
      totalDistanceKm,
      startLabel: firstSegment?.origin.label || activeDetail.ticket.departure.name,
      endLabel: lastSegment?.destination.label || activeDetail.ticket.arrival.name,
      firstDeparture: formatDateTime(activeDetail.ticket.departureTimeLocal),
      lastArrival: formatDateTime(activeDetail.ticket.arrivalTimeLocal),
    };
  }, [activeDetail]);
  const scopeSummary = useMemo(() => {
    if (ticketsInView.length === 0) {
      return null;
    }

    const totalSegments = ticketsInView.reduce((sum, item) => sum + Math.max(item.segmentCount, 1), 0);
    const topCarriers = Array.from(
      ticketsInView.reduce((counter, item) => {
        counter.set(item.carrierName, (counter.get(item.carrierName) ?? 0) + 1);
        return counter;
      }, new Map<string, number>()),
    )
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3);
    const topRoutes = Array.from(
      ticketsInView.reduce((counter, item) => {
        counter.set(item.routeLabel, (counter.get(item.routeLabel) ?? 0) + 1);
        return counter;
      }, new Map<string, number>()),
    )
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5);
    const departures = ticketsInView
      .map((item) => safeText(item.departureTimeLocal))
      .sort((left, right) => left.localeCompare(right));

    return {
      totalSegments,
      flightCount: ticketsInView.filter((item) => item.ticketType === "flight").length,
      trainCount: ticketsInView.filter((item) => item.ticketType === "train").length,
      topCarriers,
      topRoutes,
      firstDeparture: departures[0],
      lastDeparture: departures[departures.length - 1],
    };
  }, [ticketsInView]);
  const scopeMap = useMemo(() => buildScopeMapPayload(scopeDetails), [scopeDetails]);
  const scopeMapSvg = useMemo(
    () => (scopeMap ? buildMapSvgFromSegments(scopeMap.route, scopeMap.segments) : ""),
    [scopeMap],
  );
  const activeContextBadges = useMemo(() => {
    const badges: string[] = [];

    if (activeArchiveContext.query.trim()) {
      badges.push(`Query: ${activeArchiveContext.query.trim()}`);
    }
    if (activeArchiveContext.ticketType !== "all") {
      badges.push(
        activeArchiveContext.ticketType === "flight" ? "Type: Flight" : "Type: Rail",
      );
    }
    if (activeArchiveContext.status !== "all") {
      badges.push(`Status: ${activeArchiveContext.status}`);
    }

    return badges;
  }, [activeArchiveContext]);

  const handleExportSvg = (kind: "map" | "stub") => {
    if (!activeDetail) {
      return;
    }

    if (kind === "map") {
      if (!mapSvg) {
        setExportMessage("Route map data is incomplete.");
        return;
      }
      exportSvg(`${activeDetail.ticket.code}-route-map.svg`, mapSvg);
      setExportMessage("路线 SVG 已导出。");
      return;
    }

    if (!stubSvg) {
      setExportMessage("Ticket stub data is incomplete.");
      return;
    }
    exportSvg(`${activeDetail.ticket.code}-ticket-stub.svg`, stubSvg);
    setExportMessage("票根 SVG 已导出。");
  };

  const handleExportPng = async () => {
    if (!activeDetail) {
      return;
    }

    if (!stubSvg) {
      setExportMessage("Ticket stub data is incomplete.");
      return;
    }

    try {
      await exportPng(
        `${activeDetail.ticket.code}-ticket-stub.png`,
        stubSvg,
        visualizationSizes.stub.width,
        visualizationSizes.stub.height,
      );
      setExportMessage("票根 PNG 已导出。");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "PNG 导出失败。");
    }
  };

  const handleExportScopeMap = () => {
    if (!scopeMap) {
      return;
    }

    exportSvg(`tickettrail-scope-${ticketsInView.length}-routes.svg`, scopeMapSvg);
    setExportMessage("当前筛选范围路线 SVG 已导出。");
  };

  const handleSelectScopeSegment = (segment: MapSegmentPayload) => {
    if (!segment.ticketId) {
      return;
    }

    onSelectTicket(segment.ticketId);
    setExportMessage(`已切换到 ${segment.lineLabel} 对应票据。`);
  };

  const handleSelectScopePoint = (point: MapPointPayload) => {
    const nextQuery = point.code || point.label;
    onApplyArchiveFilter(nextQuery);
    setExportMessage(`已按 ${point.label}${point.code ? ` (${point.code})` : ""} 筛选票据。`);
  };

  const handleChooseAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await onAddAttachment(file);
  };

  const themeOptions: StubTheme[] = isTrainTicket
    ? ["ledger", "boarding", "night"]
    : ["boarding", "ledger", "night"];
  const showsScopeContent = mode === "overview" || mode === "map";
  const showsSelectedSummary = mode === "tickets" || mode === "journeys";
  const showsActiveRoute = mode === "tickets" || mode === "journeys" || mode === "map";
  const showsStubPreview = mode === "tickets";
  const showsAttachments = mode === "tickets";
  const showsTicketMeta = mode === "tickets" || mode === "journeys";
  const showsSelectedHeading = mode === "tickets" || mode === "journeys";
  const mapModuleLabel = mode === "map" ? "Selected route" : "Route map";
  const stubModuleLabel = "Ticket stub preview";
  const detailModuleLabel = mode === "journeys" ? "Journey detail" : "Ticket detail";
  const showsScopeFallback = showsScopeContent && !scopeSummary && !scopeMap && !scopeLoading;

  if (!ticket && !showsScopeContent) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  return (
    <section className="panel dashboard">
      {ticket && showsSelectedHeading ? (
        <div className="panel-heading">
          <div>
            <span className="ticket-kind">Selected ticket</span>
            <h3>{ticket.routeLabel}</h3>
          </div>
          <span className="status-pill">{`${ticket.status} | ${ticket.segmentCount} segment(s)`}</span>
        </div>
      ) : null}
      {ticket && showsTicketMeta ? (
        <article className="detail-card detail-facts-card">
          <div className="panel-heading">
            <div>
              <span>Ticket information</span>
              <strong>{ticket.routeLabel}</strong>
            </div>
          </div>
          <div className="detail-grid detail-facts-grid">
            <div className="detail-card">
              <span>Carrier / Operator</span>
              <strong>{safeText(ticket.carrierName, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{getTicketNumberLabel(ticket.ticketType)}</span>
              <strong>{safeText(ticket.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Status</span>
              <strong>{safeText(ticket.status, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Segments</span>
              <strong>{ticket.segmentCount}</strong>
            </div>
            <div className="detail-card">
              <span>Departure</span>
              <strong>{safeText(ticket.departure?.name, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Departure code</span>
              <strong>{safeText(ticket.departure?.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Departure time</span>
              <strong>{formatDateTime(ticket.departureTimeLocal)}</strong>
            </div>
            <div className="detail-card">
              <span>Departure timezone</span>
              <strong>{safeText(ticket.departure?.timezone, "Unknown")}</strong>
            </div>
            <div className="detail-card">
              <span>Arrival</span>
              <strong>{safeText(ticket.arrival?.name, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Arrival code</span>
              <strong>{safeText(ticket.arrival?.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Arrival time</span>
              <strong>{formatDateTime(ticket.arrivalTimeLocal)}</strong>
            </div>
            <div className="detail-card">
              <span>Arrival timezone</span>
              <strong>{safeText(ticket.arrival?.timezone, "Unknown")}</strong>
            </div>
            <div className="detail-card">
              <span>Cabin / Class</span>
              <strong>{safeText(ticket.classInfo, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>Seat</span>
              <strong>{safeText(ticket.seatInfo, "--")}</strong>
            </div>
            <div className="detail-card detail-card-wide">
              <span>Notes</span>
              <strong>{safeText(ticket.notes, "No notes yet") || "No notes yet"}</strong>
            </div>
          </div>
        </article>
      ) : null}

      {isLoading ? <p className="detail-loading">正在加载路线、票根和附件数据...</p> : null}

      {itinerarySummary && showsSelectedSummary ? (
        <article className="detail-card itinerary-overview-card">
          <span>{detailModuleLabel}</span>
          <strong>{`${itinerarySummary.startLabel} -> ${itinerarySummary.endLabel}`}</strong>
          <div className="detail-grid itinerary-overview-grid">
            <div>
              <span>Segments</span>
              <strong>{itinerarySummary.segmentCount}</strong>
            </div>
            <div>
              <span>Total distance</span>
              <strong>{`${itinerarySummary.totalDistanceKm} km`}</strong>
            </div>
            <div>
              <span>First departure</span>
              <strong>{itinerarySummary.firstDeparture}</strong>
            </div>
            <div>
              <span>Last arrival</span>
              <strong>{itinerarySummary.lastArrival}</strong>
            </div>
          </div>
        </article>
      ) : null}

      {scopeSummary && showsScopeContent ? (
        <article className="detail-card scope-overview-card">
          <div className="panel-heading">
            <div>
              <span>Current filtered scope</span>
              <strong>{`${ticketsInView.length} ticket(s) in context`}</strong>
            </div>
            <span className="status-pill">{`${ticketsInView.length} / ${totalCount}`}</span>
          </div>
          {activeContextBadges.length ? (
            <div className="context-chip-row">
              {activeContextBadges.map((badge) => (
                <span className="field-meta-chip context-chip" key={badge}>
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
          <div className="detail-grid itinerary-overview-grid">
            <div>
              <span>Total segments</span>
              <strong>{scopeSummary.totalSegments}</strong>
            </div>
            <div>
              <span>Flights / rail</span>
              <strong>{`${scopeSummary.flightCount} / ${scopeSummary.trainCount}`}</strong>
            </div>
            <div>
              <span>First departure</span>
              <strong>{formatDateTime(scopeSummary.firstDeparture)}</strong>
            </div>
            <div>
              <span>Latest departure</span>
              <strong>{formatDateTime(scopeSummary.lastDeparture)}</strong>
            </div>
          </div>
          <div className="scope-grid">
            <div className="detail-card scope-card">
              <span>Top carriers in scope</span>
              {scopeSummary.topCarriers.length ? (
                <div className="scope-list">
                  {scopeSummary.topCarriers.map(([carrier, count]) => (
                    <div className="scope-list-item" key={carrier}>
                      <strong>{carrier}</strong>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <strong>No carrier data</strong>
              )}
            </div>
            <div className="detail-card scope-card">
              <span>Route collection view</span>
              {scopeSummary.topRoutes.length ? (
                <div className="scope-list">
                  {scopeSummary.topRoutes.map(([route, count]) => (
                    <div className="scope-list-item" key={route}>
                      <strong>{route}</strong>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <strong>No route data</strong>
              )}
            </div>
          </div>
        </article>
      ) : null}

      {scopeMap && showsScopeContent ? (
        <article className="map-preview scope-map-preview">
          <div className="panel-heading">
            <div>
              <span>Route collection map</span>
              <strong>{`${scopeMap.segments.length} segment(s) across ${scopeDetails.length} ticket(s)`}</strong>
            </div>
            <span className="status-pill">{`${scopeMap.points.length} points`}</span>
          </div>
          {activeContextBadges.length ? (
            <div className="context-chip-row">
              {activeContextBadges.map((badge) => (
                <span className="field-meta-chip context-chip" key={`map-${badge}`}>
                  {badge}
                </span>
              ))}
            </div>
          ) : (
            <p className="detail-loading scope-context-copy">
              Showing the full visible archive on the collection map.
            </p>
          )}
          <Suspense fallback={<p className="detail-loading">正在加载筛选范围路线地图...</p>}>
            <RouteMap
              onPointSelect={handleSelectScopePoint}
              onSegmentSelect={handleSelectScopeSegment}
              points={scopeMap.points}
              route={scopeMap.route}
              segments={scopeMap.segments}
              variant="summary"
            />
          </Suspense>
          <div className="map-summary">
            <span>{scopeMap.route.directionHint}</span>
            <span>{scopeMap.route.distanceHintKm} km total</span>
            <span>{`${scopeMap.points.length} mapped stops`}</span>
          </div>
          <div className="export-row">
            <button className="ghost-button" onClick={handleExportScopeMap} type="button">
              导出范围路线 SVG
            </button>
          </div>
        </article>
      ) : scopeLoading && showsScopeContent ? (
        <article className="map-preview scope-map-preview">
          <p className="detail-loading">正在汇总当前筛选范围的路线地图...</p>
        </article>
      ) : null}

      {showsScopeFallback ? (
        <article className="detail-card">
          <span>Route overview</span>
          <strong>No route data in the current view</strong>
          <p className="detail-loading">
            Add tickets or broaden the current filters to populate the route overview for this section.
          </p>
        </article>
      ) : null}

      {ticket && showsActiveRoute ? (
      <article className="map-preview">
        <div className="panel-heading">
          <div>
            <span>{mapModuleLabel}</span>
            <strong>{activeDetail?.map.directionHint || ticket.routeLabel}</strong>
          </div>
          {activeDetail && canRenderActiveMap ? (
            <span className="status-pill">{`${activeDetail.map.distanceHintKm} km`}</span>
          ) : null}
        </div>
        {activeDetail ? (
          canRenderActiveMap ? (
            <>
            <Suspense fallback={<p className="detail-loading">正在加载真实地图组件...</p>}>
              <RouteMap route={activeDetail.map} segments={activeDetail.segments} variant="detail" />
            </Suspense>
            {activeDetail.segments.length > 1 ? (
              <div className="segment-stack">
                {activeDetail.segments.map((segment) => (
                  <article className="segment-card" key={`${segment.code}-${segment.segmentIndex}`}>
                    <div className="segment-card-top">
                      <div>
                        <span className="ticket-kind">{`Segment ${segment.segmentIndex + 1}`}</span>
                        <strong>{segment.lineLabel}</strong>
                      </div>
                      <span className="status-pill">{segment.distanceHintKm} km</span>
                    </div>
                    <div className="ticket-meta">
                      <span>{segment.code || "--"}</span>
                      <span>{segment.carrierName}</span>
                      <span>{segment.directionHint}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            </>
          ) : (
            <div className="empty-state">
              <strong>Route preview is unavailable</strong>
              <p>The saved ticket data is incomplete, so the route preview was skipped safely.</p>
            </div>
          )
        ) : (
          <div className="map-grid">
            <div className="map-node">
              <span>FROM</span>
              <strong>{ticket.departure.code || "--"}</strong>
              <p>{ticket.departure.name}</p>
            </div>
            <div className="map-line">
              <span className="line-dot" />
              <span className="line-path" />
              <span className="line-arrow">{"->"}</span>
            </div>
            <div className="map-node">
              <span>TO</span>
              <strong>{ticket.arrival.code || "--"}</strong>
              <p>{ticket.arrival.name}</p>
            </div>
          </div>
        )}
        {activeDetail && canRenderActiveMap ? (
          <div className="map-summary">
            <span>{activeDetail.map.directionHint}</span>
            <span>{activeDetail.map.distanceHintKm} km</span>
            <span>
              {formatCoordinate(activeDetail.map.viewport.minLatitude)} /{" "}
              {formatCoordinate(activeDetail.map.viewport.maxLatitude)} lat
            </span>
          </div>
        ) : null}
      </article>
      ) : null}

      {ticket && showsStubPreview ? (
      <article className="stub-preview">
        <div className="panel-heading">
          <div>
            <span>{stubModuleLabel}</span>
            <strong>{safeText(ticket.code, "--")}</strong>
          </div>
          <span className="status-pill">{safeText(ticket.ticketType, "ticket").toUpperCase()}</span>
        </div>
        {activeDetail && canRenderActiveStub ? (
          <>
            <div className="theme-switcher">
              {themeOptions.map((theme) => (
                <button
                  key={theme}
                  className={stubTheme === theme ? "theme-chip active" : "theme-chip"}
                  onClick={() => setStubTheme(theme)}
                  type="button"
                >
                  {theme === "boarding"
                    ? "登机牌"
                    : theme === "ledger"
                      ? "报销凭证"
                      : "夜间霓虹"}
                </button>
              ))}
            </div>
            <div className="svg-frame stub-canvas" dangerouslySetInnerHTML={{ __html: stubSvg }} />
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("stub")} type="button">
                导出票根 SVG
              </button>
              <button className="primary-button" onClick={() => void handleExportPng()} type="button">
                导出票根 PNG
              </button>
            </div>
          </>
        ) : activeDetail ? (
          <div className="empty-state">
            <strong>Ticket stub preview is unavailable</strong>
            <p>The saved ticket data is incomplete, so the stub preview was skipped safely.</p>
          </div>
        ) : (
          <>
            <div className="stub-body">
              <div>
                <span>{safeText(ticket.departure?.name, "Departure")}</span>
                <strong>{formatDateTime(ticket.departureTimeLocal)}</strong>
              </div>
              <div>
                <span>{safeText(ticket.arrival?.name, "Arrival")}</span>
                <strong>{formatDateTime(ticket.arrivalTimeLocal)}</strong>
              </div>
            </div>
            <footer>
              <span>{safeText(ticket.carrierName, "Carrier")}</span>
              <span>{`${safeText(ticket.classInfo, "TBD") || "TBD"} / ${safeText(ticket.seatInfo, "TBD") || "TBD"}`}</span>
            </footer>
          </>
        )}
      </article>
      ) : null}

      {showsAttachments ? (
      <article className="attachments-panel">
        <div className="panel-heading">
          <div>
            <h3>Original ticket files</h3>
          </div>
          <span className="status-pill">{activeDetail?.attachments?.length ?? 0} files</span>
        </div>
        <input
          accept="image/*,application/pdf"
          className="hidden-file-input"
          onChange={(event) => void handleFileChange(event)}
          ref={fileInputRef}
          type="file"
        />
        <div className="export-row">
          <button
            className="primary-button"
            disabled={!activeDetail || attachmentBusy}
            onClick={handleChooseAttachment}
            type="button"
          >
            {attachmentBusy ? "正在处理附件..." : "添加附件"}
          </button>
        </div>
        {activeDetail?.attachments?.length ? (
          <div className="attachment-grid">
            {(activeDetail.attachments ?? []).map((attachment) => (
              <article className="attachment-card" key={attachment.id}>
                {isImageAttachment(attachment) && attachment.previewUrl ? (
                  <img
                    alt={attachment.fileName}
                    className="attachment-preview"
                    src={attachment.previewUrl}
                  />
                ) : (
                  <div className="attachment-fallback">
                    <strong>{safeText(attachment.mimeType).includes("pdf") ? "PDF" : "FILE"}</strong>
                  </div>
                )}
                <div className="attachment-meta">
                  <strong>{safeText(attachment.fileName, "Attachment")}</strong>
                  <span>{Math.max(1, Math.round(attachment.fileSize / 1024))} KB</span>
                  <span>{formatDateTime(attachment.createdAt)}</span>
                </div>
                <div className="attachment-actions">
                  {attachment.previewUrl ? (
                    <a className="ghost-button compact-button" href={attachment.previewUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                  <button
                    className="ghost-button compact-button danger-button"
                    disabled={attachmentBusy}
                    onClick={() => void onDeleteAttachment(attachment.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No attachments yet</strong>
            <p>Upload screenshots, scanned tickets, or PDF reimbursement files for this record.</p>
          </div>
        )}
      </article>
      ) : null}

      {exportMessage ? <p className="detail-loading">{exportMessage}</p> : null}

      {ticket?.segments?.length && showsTicketMeta ? (
        <article className="detail-card">
          <span>Onward itinerary</span>
          <strong>{`${ticket.segments.length} saved onward segment(s)`}</strong>
          <p className="map-summary">
            {ticket.segments.map((segment, index) => (
              <span key={`${segment.code}-${index}`}>
                {`${index + 2}. ${segment.departure.name} -> ${segment.arrival.name} (${segment.code || "--"})`}
              </span>
            ))}
          </p>
        </article>
      ) : null}

      {ticket && showsTicketMeta ? (
      <article className="detail-grid">
        <div className="detail-card">
          <span>Departure timezone</span>
          <strong>{safeText(ticket.departure?.timezone, "Unknown")}</strong>
        </div>
        <div className="detail-card">
          <span>Arrival timezone</span>
          <strong>{safeText(ticket.arrival?.timezone, "Unknown")}</strong>
        </div>
        <div className="detail-card">
          <span>Notes</span>
          <strong>{safeText(activeDetail?.stub.notes || ticket.notes, "No notes yet") || "No notes yet"}</strong>
        </div>
        <div className="detail-card">
          <span>起点坐标</span>
          <strong>
            {activeDetail && hasUsableMapRoute(activeDetail.map)
              ? `${formatCoordinate(activeDetail.map.origin.latitude)}, ${formatCoordinate(activeDetail.map.origin.longitude)}`
              : "Pending"}
          </strong>
        </div>
      </article>
      ) : null}
    </section>
  );
}
