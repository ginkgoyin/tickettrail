import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  buildMapSvgFromSegments,
  buildStubSvg,
  exportPng,
  exportSvg,
  exportTextFile,
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

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
  ticketsInView: TicketRecord[];
  totalCount: number;
  attachmentBusy: boolean;
  onAddAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onSelectTicket: (ticketId: string) => void;
  onApplyArchiveFilter: (query: string) => void;
}

function isImageAttachment(attachment: TicketAttachment) {
  return attachment.mimeType.startsWith("image/");
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function buildTicketExportJson(detail: TicketDetailPayload) {
  return JSON.stringify(detail, null, 2);
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildTicketExportCsv(detail: TicketDetailPayload) {
  const header = [
    "segmentIndex",
    "transportType",
    "carrierName",
    "code",
    "departureLabel",
    "departureCode",
    "departureTimezone",
    "arrivalLabel",
    "arrivalCode",
    "arrivalTimezone",
    "distanceHintKm",
  ];

  const rows = detail.segments.map((segment) =>
    [
      segment.segmentIndex + 1,
      segment.transportType,
      segment.carrierName,
      segment.code,
      segment.origin.label,
      segment.origin.code || "",
      segment.origin.timezone,
      segment.destination.label,
      segment.destination.code || "",
      segment.destination.timezone,
      segment.distanceHintKm,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function buildScopeMapPayload(details: TicketDetailPayload[]) {
  const segments = details
    .flatMap((detail) =>
      detail.segments.map((segment) => ({
        ...segment,
        ticketId: detail.ticket.id,
      })),
    )
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
    left.ticket.departureTimeLocal.localeCompare(right.ticket.departureTimeLocal),
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
  attachmentBusy,
  onAddAttachment,
  onDeleteAttachment,
  onSelectTicket,
  onApplyArchiveFilter,
}: DashboardProps) {
  const [exportMessage, setExportMessage] = useState("");
  const [stubTheme, setStubTheme] = useState<StubTheme>("boarding");
  const [scopeDetails, setScopeDetails] = useState<TicketDetailPayload[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const activeDetail = detail?.ticket.id === ticket.id ? detail : null;
  const isTrainTicket = ticket.ticketType === "train";

  useEffect(() => {
    setStubTheme(isTrainTicket ? "ledger" : "boarding");
  }, [isTrainTicket, ticket.id]);

  useEffect(() => {
    let isMounted = true;

    const loadScopeDetails = async () => {
      if (!ticketsInView.length) {
        setScopeDetails([]);
        return;
      }

      setScopeLoading(true);

      try {
        const nextDetails = await Promise.all(
          ticketsInView.slice(0, 24).map((item) => getTicketDetail(item.id)),
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
    () => (activeDetail ? buildMapSvgFromSegments(activeDetail.map, activeDetail.segments) : ""),
    [activeDetail],
  );
  const stubSvg = useMemo(
    () => (activeDetail ? buildStubSvg(activeDetail.stub, stubTheme, activeDetail.segments) : ""),
    [activeDetail, stubTheme],
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
      .map((item) => item.departureTimeLocal)
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

  const handleExportSvg = (kind: "map" | "stub") => {
    if (!activeDetail) {
      return;
    }

    if (kind === "map") {
      exportSvg(`${activeDetail.ticket.code}-route-map.svg`, mapSvg);
      setExportMessage("路线 SVG 已导出。");
      return;
    }

    exportSvg(`${activeDetail.ticket.code}-ticket-stub.svg`, stubSvg);
    setExportMessage("票根 SVG 已导出。");
  };

  const handleExportPng = async () => {
    if (!activeDetail) {
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

  const handleExportStructured = (kind: "json" | "csv") => {
    if (!activeDetail) {
      return;
    }

    if (kind === "json") {
      exportTextFile(
        `${activeDetail.ticket.code}-itinerary.json`,
        buildTicketExportJson(activeDetail),
        "application/json;charset=utf-8",
      );
      setExportMessage("行程 JSON 已导出。");
      return;
    }

    exportTextFile(
      `${activeDetail.ticket.code}-itinerary.csv`,
      buildTicketExportCsv(activeDetail),
      "text/csv;charset=utf-8",
    );
    setExportMessage("行程 CSV 已导出。");
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

  return (
    <section className="panel dashboard">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>{ticket.routeLabel}</h3>
        </div>
        <span className="status-pill">{`${ticket.status} | ${ticket.segmentCount} segment(s)`}</span>
      </div>

      {isLoading ? <p className="detail-loading">正在加载路线、票根和附件数据...</p> : null}

      {itinerarySummary ? (
        <article className="detail-card itinerary-overview-card">
          <span>Itinerary overview</span>
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
          <div className="export-row">
            <button className="ghost-button" onClick={() => handleExportStructured("json")} type="button">
              导出 JSON
            </button>
            <button className="ghost-button" onClick={() => handleExportStructured("csv")} type="button">
              导出 CSV
            </button>
          </div>
        </article>
      ) : null}

      {scopeSummary ? (
        <article className="detail-card scope-overview-card">
          <div className="panel-heading">
            <div>
              <span>Current filtered scope</span>
              <strong>{`${ticketsInView.length} ticket(s) in context`}</strong>
            </div>
            <span className="status-pill">{`${ticketsInView.length} / ${totalCount}`}</span>
          </div>
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

      {scopeMap ? (
        <article className="map-preview scope-map-preview">
          <div className="panel-heading">
            <div>
              <span>Route collection map</span>
              <strong>{`${scopeMap.segments.length} segment(s) across ${scopeDetails.length} ticket(s)`}</strong>
            </div>
            <span className="status-pill">{`${scopeMap.points.length} points`}</span>
          </div>
          <Suspense fallback={<p className="detail-loading">正在加载筛选范围路线地图...</p>}>
            <RouteMap
              onPointSelect={handleSelectScopePoint}
              onSegmentSelect={handleSelectScopeSegment}
              points={scopeMap.points}
              route={scopeMap.route}
              segments={scopeMap.segments}
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
      ) : scopeLoading ? (
        <article className="map-preview scope-map-preview">
          <p className="detail-loading">正在汇总当前筛选范围的路线地图...</p>
        </article>
      ) : null}

      <article className="map-preview">
        {activeDetail ? (
          <>
            <Suspense fallback={<p className="detail-loading">正在加载真实地图组件...</p>}>
              <RouteMap route={activeDetail.map} segments={activeDetail.segments} />
            </Suspense>
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("map")} type="button">
                导出路线 SVG
              </button>
            </div>
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
        {activeDetail ? (
          <div className="map-summary">
            <span>{activeDetail.map.directionHint}</span>
            <span>{activeDetail.map.distanceHintKm} km</span>
            <span>
              {activeDetail.map.viewport.minLatitude.toFixed(2)} /{" "}
              {activeDetail.map.viewport.maxLatitude.toFixed(2)} lat
            </span>
          </div>
        ) : null}
      </article>

      <article className="stub-preview">
        {activeDetail ? (
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
        ) : (
          <>
            <header>
              <span>{ticket.ticketType.toUpperCase()}</span>
              <strong>{ticket.code}</strong>
            </header>
            <div className="stub-body">
              <div>
                <span>{ticket.departure.name}</span>
                <strong>{ticket.departureTimeLocal.replace("T", " ")}</strong>
              </div>
              <div>
                <span>{ticket.arrival.name}</span>
                <strong>{ticket.arrivalTimeLocal.replace("T", " ")}</strong>
              </div>
            </div>
            <footer>
              <span>{ticket.carrierName}</span>
              <span>{`${ticket.classInfo || "TBD"} / ${ticket.seatInfo || "TBD"}`}</span>
            </footer>
          </>
        )}
      </article>

      <article className="attachments-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Attachments</p>
            <h3>Original ticket files</h3>
          </div>
          <span className="status-pill">{activeDetail?.attachments.length ?? 0} files</span>
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
        {activeDetail?.attachments.length ? (
          <div className="attachment-grid">
            {activeDetail.attachments.map((attachment) => (
              <article className="attachment-card" key={attachment.id}>
                {isImageAttachment(attachment) && attachment.previewUrl ? (
                  <img
                    alt={attachment.fileName}
                    className="attachment-preview"
                    src={attachment.previewUrl}
                  />
                ) : (
                  <div className="attachment-fallback">
                    <strong>{attachment.mimeType.includes("pdf") ? "PDF" : "FILE"}</strong>
                  </div>
                )}
                <div className="attachment-meta">
                  <strong>{attachment.fileName}</strong>
                  <span>{Math.max(1, Math.round(attachment.fileSize / 1024))} KB</span>
                  <span>{attachment.createdAt.replace("T", " ").slice(0, 16)}</span>
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

      {exportMessage ? <p className="detail-loading">{exportMessage}</p> : null}

      {ticket.segments?.length ? (
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

      <article className="detail-grid">
        <div className="detail-card">
          <span>Departure timezone</span>
          <strong>{ticket.departure.timezone}</strong>
        </div>
        <div className="detail-card">
          <span>Arrival timezone</span>
          <strong>{ticket.arrival.timezone}</strong>
        </div>
        <div className="detail-card">
          <span>Notes</span>
          <strong>{activeDetail?.stub.notes || ticket.notes || "No notes yet"}</strong>
        </div>
        <div className="detail-card">
          <span>起点坐标</span>
          <strong>
            {activeDetail
              ? `${activeDetail.map.origin.latitude.toFixed(2)}, ${activeDetail.map.origin.longitude.toFixed(2)}`
              : "Pending"}
          </strong>
        </div>
      </article>
    </section>
  );
}
