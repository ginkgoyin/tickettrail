import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useI18n } from "../lib/i18n";
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
  TicketStatus,
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
  busyTicketId?: string;
  attachmentBusy: boolean;
  onAddAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onUpdateStatus?: (ticketId: string, status: Exclude<TicketStatus, "draft">) => Promise<void>;
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

function getTicketNumberLabel(ticketType: TicketRecord["ticketType"], flightLabel: string, trainLabel: string) {
  return ticketType === "train" ? trainLabel : flightLabel;
}

function getOperatorLabel(ticketType: TicketRecord["ticketType"], flightLabel: string, trainLabel: string) {
  return ticketType === "train" ? trainLabel : flightLabel;
}

function getDepartureLabel(ticketType: TicketRecord["ticketType"], flightLabel: string, trainLabel: string) {
  return ticketType === "train" ? trainLabel : flightLabel;
}

function getArrivalLabel(ticketType: TicketRecord["ticketType"], flightLabel: string, trainLabel: string) {
  return ticketType === "train" ? trainLabel : flightLabel;
}

function formatLocationWithTerminal(
  ticketType: TicketRecord["ticketType"],
  locationName: unknown,
  terminal: unknown,
) {
  const base = safeText(locationName, "--");
  const normalizedTerminal = safeText(terminal).trim();

  if (ticketType !== "flight" || !normalizedTerminal) {
    return base;
  }

  return `${base} · ${normalizedTerminal}`;
}

function getStatusLabel(status: TicketStatus, upcomingLabel: string, completedLabel: string, archivedLabel: string) {
  switch (status) {
    case "saved":
      return upcomingLabel;
    case "used":
      return completedLabel;
    case "archived":
      return archivedLabel;
    default:
      return status;
  }
}

function getAutoDerivedStatus(ticket: TicketRecord, currentTimeMs: number, upcomingLabel: string, completedLabel: string) {
  const candidate = safeText(ticket.arrivalTimeLocal).trim() || safeText(ticket.departureTimeLocal);
  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) {
    return upcomingLabel;
  }

  return timestamp < currentTimeMs ? completedLabel : upcomingLabel;
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "--";
  }

  const totalMinutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function getTravelDurationLabel(departureTimeLocal: unknown, arrivalTimeLocal: unknown) {
  const departureTimestamp = Date.parse(safeText(departureTimeLocal));
  const arrivalTimestamp = Date.parse(safeText(arrivalTimeLocal));

  if (!Number.isFinite(departureTimestamp) || !Number.isFinite(arrivalTimestamp)) {
    return "--";
  }

  if (arrivalTimestamp < departureTimestamp) {
    return "--";
  }

  return formatDuration(arrivalTimestamp - departureTimestamp);
}

function getStatusDisplayMeta(
  ticket: TicketRecord,
  currentTimeMs: number,
  labels: {
    autoUpcoming: string;
    autoCompleted: string;
    upcoming: string;
    completed: string;
    archived: string;
  },
) {
  const autoLabel = getAutoDerivedStatus(ticket, currentTimeMs, labels.upcoming, labels.completed);
  if (ticket.status === "saved") {
    return {
      label: autoLabel,
      dropdownAutoLabel: autoLabel === labels.completed ? labels.autoCompleted : labels.autoUpcoming,
    };
  }

  return {
    label: getStatusLabel(ticket.status, labels.upcoming, labels.completed, labels.archived),
    dropdownAutoLabel: autoLabel === labels.completed ? labels.autoCompleted : labels.autoUpcoming,
  };
}

function formatTimeWithTimezone(value: unknown, timezone: unknown) {
  const dateTime = formatDateTime(value);
  const zone = safeText(timezone).trim();

  if (!zone || dateTime === "--") {
    return {
      primary: dateTime,
      secondary: "",
    };
  }

  return {
    primary: dateTime,
    secondary: zone,
  };
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
  busyTicketId,
  attachmentBusy,
  onAddAttachment,
  onDeleteAttachment,
  onUpdateStatus,
  onSelectTicket,
  onApplyArchiveFilter,
  mode = "tickets",
}: DashboardProps) {
  const { t } = useI18n();
  const [exportMessage, setExportMessage] = useState("");
  const [stubTheme, setStubTheme] = useState<StubTheme>("boarding");
  const [scopeDetails, setScopeDetails] = useState<TicketDetailPayload[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [statusClockMs, setStatusClockMs] = useState(() => Date.now());
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
    if (mode !== "tickets" || !ticket || ticket.status !== "saved") {
      return;
    }

    setStatusClockMs(Date.now());
    const timer = window.setInterval(() => {
      setStatusClockMs(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, [mode, ticket]);

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
      setExportMessage("Route map SVG exported.");
      return;
    }

    if (!stubSvg) {
      setExportMessage("Ticket stub data is incomplete.");
      return;
    }
    exportSvg(`${activeDetail.ticket.code}-ticket-stub.svg`, stubSvg);
    setExportMessage("Stub SVG exported.");
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
      setExportMessage("Stub PNG exported.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Stub PNG export failed.");
    }
  };

  const handleExportScopeMap = () => {
    if (!scopeMap) {
      return;
    }

    exportSvg(`tickettrail-scope-${ticketsInView.length}-routes.svg`, scopeMapSvg);
    setExportMessage("Current scope map SVG exported.");
  };

  const handleSelectScopeSegment = (segment: MapSegmentPayload) => {
    if (!segment.ticketId) {
      return;
    }

    onSelectTicket(segment.ticketId);
    setExportMessage(`Switched to the ticket for ${segment.lineLabel}.`);
  };

  const handleSelectScopePoint = (point: MapPointPayload) => {
    const nextQuery = point.code || point.label;
    onApplyArchiveFilter(nextQuery);
    setExportMessage(`Filtered tickets by ${point.label}${point.code ? ` (${point.code})` : ""}.`);
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
  const showsSelectedSummary = mode === "journeys";
  const showsActiveRoute = mode === "tickets" || mode === "journeys" || mode === "map";
  const showsStubPreview = mode === "tickets";
  const showsAttachments = mode === "tickets";
  const showsTicketMeta = mode === "tickets" || mode === "journeys";
  const showsSelectedHeading = mode === "journeys";
  const mapModuleLabel = t("routeMap");
  const stubModuleLabel = t("ticketStubPreview");
  const detailModuleLabel = mode === "journeys" ? "Journey detail" : "Ticket detail";
  const showsScopeFallback = showsScopeContent && !scopeSummary && !scopeMap && !scopeLoading;
  const travelDurationLabel = ticket ? getTravelDurationLabel(ticket.departureTimeLocal, ticket.arrivalTimeLocal) : "--";
  const canUpdateTicketStatus = Boolean(ticket && mode === "tickets" && onUpdateStatus);
  const statusBusy = Boolean(ticket && busyTicketId === ticket.id);
  const statusDisplayMeta = ticket
    ? getStatusDisplayMeta(ticket, statusClockMs, {
        autoUpcoming: t("autoUpcoming"),
        autoCompleted: t("autoCompleted"),
        upcoming: t("upcoming"),
        completed: t("completed"),
        archived: t("archived"),
      })
    : null;
  const departureTimeDisplay = ticket
    ? formatTimeWithTimezone(ticket.departureTimeLocal, ticket.departure?.timezone)
    : { primary: "--", secondary: "" };
  const arrivalTimeDisplay = ticket
    ? formatTimeWithTimezone(ticket.arrivalTimeLocal, ticket.arrival?.timezone)
    : { primary: "--", secondary: "" };
  const ticketInformationModule =
    ticket && showsTicketMeta ? (
      <article className="detail-facts-card detail-module-shell">
        <div className="panel-heading">
          <div>
            <h3 className="detail-module-title">{t("ticketInformation")}</h3>
          </div>
        </div>
        <div className="detail-facts-rows">
          <div className="detail-grid detail-facts-row detail-facts-row-3">
            <div className="detail-card">
              <span>{getOperatorLabel(ticket.ticketType, t("carrierOperator"), t("operator"))}</span>
              <strong>{safeText(ticket.carrierName, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{getTicketNumberLabel(ticket.ticketType, t("flightNo"), t("trainNo"))}</span>
              <strong>{safeText(ticket.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{t("status")}</span>
              {canUpdateTicketStatus ? (
                <select
                  aria-label="Ticket status"
                  className="detail-status-select"
                  disabled={statusBusy}
                  onChange={(event) =>
                    void onUpdateStatus?.(ticket.id, event.target.value as Exclude<TicketStatus, "draft">)
                  }
                  value={ticket.status}
                >
                  <option value="saved">{statusDisplayMeta?.dropdownAutoLabel ?? t("autoUpcoming")}</option>
                  <option value="used">{t("completed")}</option>
                  <option value="archived">{t("archived")}</option>
                </select>
              ) : (
                <strong>{statusDisplayMeta?.label ?? getStatusLabel(ticket.status, t("upcoming"), t("completed"), t("archived"))}</strong>
              )}
            </div>
          </div>
          <div className="detail-grid detail-facts-row detail-facts-row-3">
            <div className="detail-card">
              <span>{getDepartureLabel(ticket.ticketType, t("departure"), t("departureStation"))}</span>
              <strong>
                {formatLocationWithTerminal(
                  ticket.ticketType,
                  ticket.departure?.name,
                  ticket.departureTerminal,
                )}
              </strong>
            </div>
            <div className="detail-card">
              <span>{t("departureCode")}</span>
              <strong>{safeText(ticket.departure?.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{t("departureTime")}</span>
              <strong>{departureTimeDisplay.primary}</strong>
              {departureTimeDisplay.secondary ? (
                <small className="detail-helper-text">{departureTimeDisplay.secondary}</small>
              ) : null}
            </div>
          </div>
          <div className="detail-grid detail-facts-row detail-facts-row-3">
            <div className="detail-card">
              <span>{getArrivalLabel(ticket.ticketType, t("arrival"), t("arrivalStation"))}</span>
              <strong>
                {formatLocationWithTerminal(
                  ticket.ticketType,
                  ticket.arrival?.name,
                  ticket.arrivalTerminal,
                )}
              </strong>
            </div>
            <div className="detail-card">
              <span>{t("arrivalCode")}</span>
              <strong>{safeText(ticket.arrival?.code, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{t("arrivalTime")}</span>
              <strong>{arrivalTimeDisplay.primary}</strong>
              {arrivalTimeDisplay.secondary ? (
                <small className="detail-helper-text">{arrivalTimeDisplay.secondary}</small>
              ) : null}
            </div>
          </div>
          <div className="detail-grid detail-facts-row detail-facts-row-4">
            <div className="detail-card">
              <span>{t("cabinClass")}</span>
              <strong>{safeText(ticket.classInfo, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{t("seat")}</span>
              <strong>{safeText(ticket.seatInfo, "--")}</strong>
            </div>
            <div className="detail-card">
              <span>{t("duration")}</span>
              <strong>{travelDurationLabel}</strong>
            </div>
            <div className="detail-card">
              <span>{t("routeLegs")}</span>
              <strong>{ticket.segmentCount}</strong>
            </div>
          </div>
          {ticket.notes ? (
            <div className="detail-grid detail-facts-row detail-facts-row-notes">
              <div className="detail-card detail-card-notes">
                <span>{t("notes")}</span>
                <p>{ticket.notes}</p>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    ) : null;
  const stubPreviewModule =
    ticket && showsStubPreview ? (
      <article className="stub-preview detail-module-shell">
        <div className="panel-heading">
          <div>
            <h3 className="detail-module-title">{stubModuleLabel}</h3>
          </div>
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
                    ? t("boardingPass")
                    : theme === "ledger"
                      ? t("reimbursementVoucher")
                      : t("redEyeFlight")}
                </button>
              ))}
            </div>
            <div className="svg-frame stub-canvas" dangerouslySetInnerHTML={{ __html: stubSvg }} />
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("stub")} type="button">
                {t("exportStubSvg")}
              </button>
              <button className="primary-button" onClick={() => void handleExportPng()} type="button">
                {t("exportStubPng")}
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
                <span>{safeText(ticket?.departure?.name, "Departure")}</span>
                <strong>{formatDateTime(ticket?.departureTimeLocal)}</strong>
              </div>
              <div>
                <span>{safeText(ticket?.arrival?.name, "Arrival")}</span>
                <strong>{formatDateTime(ticket?.arrivalTimeLocal)}</strong>
              </div>
            </div>
            <footer>
              <span>{safeText(ticket?.carrierName, "Carrier")}</span>
              <span>{`${safeText(ticket?.classInfo, "TBD") || "TBD"} / ${safeText(ticket?.seatInfo, "TBD") || "TBD"}`}</span>
            </footer>
          </>
        )}
      </article>
    ) : null;
  const attachmentsModule =
    showsAttachments ? (
      <article className="attachments-panel">
        <div className="panel-heading">
          <div>
            <h3 className="detail-module-title">{t("originalTicketFiles")}</h3>
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
            {attachmentBusy ? t("addingFile") : t("addFile")}
          </button>
        </div>
        {activeDetail?.attachments?.length ? (
          <div className="attachment-grid">
            {(activeDetail?.attachments ?? []).map((attachment) => (
              <article className="attachment-card" key={attachment.id}>
                {isImageAttachment(attachment) && attachment.previewUrl ? (
                  <img alt={attachment.fileName} className="attachment-preview" src={attachment.previewUrl} />
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
                    <a className="ghost-button compact-button" href={attachment.previewUrl} rel="noreferrer" target="_blank">
                      Open
                    </a>
                  ) : null}
                  <button
                    className="ghost-button compact-button danger-button"
                    disabled={attachmentBusy}
                    onClick={() => void onDeleteAttachment(attachment.id)}
                    type="button"
                  >
                    {t("delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>{t("noAttachmentsYet")}</strong>
            <p>{t("noFilesYetMessage")}</p>
          </div>
        )}
      </article>
    ) : null;
  const routeMapModule =
    ticket && showsActiveRoute ? (
      <article className="route-map-card detail-module-shell">
        <div className="panel-heading route-map-header">
          <div>
            <h3 className="detail-module-title route-map-title">{mapModuleLabel}</h3>
          </div>
          {activeDetail && canRenderActiveMap ? (
            <span className="status-pill">{`${activeDetail.map.distanceHintKm} km`}</span>
          ) : null}
        </div>
        {activeDetail ? (
          canRenderActiveMap ? (
            <>
              <Suspense fallback={<p className="detail-loading">Loading route map...</p>}>
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
          <div className="map-summary route-map-footer">
            <span>
              <strong>Origin coordinate</strong>
              {`${formatCoordinate(activeDetail.map.origin.latitude)}, ${formatCoordinate(activeDetail.map.origin.longitude)}`}
            </span>
            <span>
              <strong>{t("duration")}</strong>
              {travelDurationLabel}
            </span>
            <span>
              <strong>Distance</strong>
              {`${activeDetail.map.distanceHintKm} km`}
            </span>
          </div>
        ) : null}
      </article>
    ) : null;
  const shouldShowFirstDetailRow = Boolean(ticket && (showsTicketMeta || showsActiveRoute));
  const shouldShowSecondDetailRow = Boolean(ticket && (showsStubPreview || showsAttachments));
  const shouldShowDetailRowDivider = shouldShowFirstDetailRow && shouldShowSecondDetailRow;

  if (!ticket && !showsScopeContent) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const dashboardClassName = mode === "tickets" ? "dashboard dashboard-detail" : "panel dashboard";

  return (
    <section className={dashboardClassName}>
      {ticket && showsSelectedHeading ? (
        <div className="panel-heading">
          <div>
            <span className="ticket-kind">Selected ticket</span>
            <h3>{ticket.routeLabel}</h3>
          </div>
          <span className="status-pill">{`${getStatusLabel(ticket.status, t("upcoming"), t("completed"), t("archived"))} | ${ticket.segmentCount} segment(s)`}</span>
        </div>
      ) : null}
      {isLoading ? <p className="detail-loading">Loading route, stub, and attachment data...</p> : null}

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
          <Suspense fallback={<p className="detail-loading">Loading scope route map...</p>}>
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
              Export scope map SVG
            </button>
          </div>
        </article>
      ) : scopeLoading && showsScopeContent ? (
        <article className="map-preview scope-map-preview">
          <p className="detail-loading">Loading the current scope map...</p>
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

      {shouldShowFirstDetailRow ? (
        <div className="detail-ticket-module-row detail-ticket-module-row-top">
          {ticketInformationModule}
          {routeMapModule}
        </div>
      ) : null}

      {shouldShowDetailRowDivider ? <div aria-hidden="true" className="detail-section-divider" /> : null}

      {shouldShowSecondDetailRow ? (
        <div className="detail-ticket-module-row detail-ticket-module-row-bottom">
          {stubPreviewModule}
          {attachmentsModule}
        </div>
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

    </section>
  );
}
