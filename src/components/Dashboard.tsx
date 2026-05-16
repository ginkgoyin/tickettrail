import { Suspense, lazy, useMemo, useState } from "react";
import {
  buildMapSvg,
  buildStubSvg,
  exportPng,
  exportSvg,
  type StubTheme,
  visualizationSizes,
} from "../lib/visualization";
import type { TicketDetailPayload, TicketRecord } from "../types/ticket";

const RouteMap = lazy(async () => import("./RouteMap").then((module) => ({ default: module.RouteMap })));

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
}

export function Dashboard({ detail, isLoading, ticket }: DashboardProps) {
  const [exportMessage, setExportMessage] = useState("");
  const [stubTheme, setStubTheme] = useState<StubTheme>("boarding");

  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const activeDetail = detail?.ticket.id === ticket.id ? detail : null;
  const mapSvg = useMemo(() => (activeDetail ? buildMapSvg(activeDetail.map) : ""), [activeDetail]);
  const stubSvg = useMemo(
    () => (activeDetail ? buildStubSvg(activeDetail.stub, stubTheme) : ""),
    [activeDetail, stubTheme],
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

  return (
    <section className="panel dashboard">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>{ticket.routeLabel}</h3>
        </div>
        <span className="status-pill">{ticket.status}</span>
      </div>

      {isLoading ? <p className="detail-loading">正在加载路线和票根派生数据...</p> : null}

      <article className="map-preview">
        {activeDetail ? (
          <>
            <Suspense fallback={<p className="detail-loading">正在加载真实地图组件...</p>}>
              <RouteMap route={activeDetail.map} />
            </Suspense>
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("map")} type="button">
                导出路线 SVG
              </button>
            </div>
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
              {(["boarding", "ledger", "night"] as StubTheme[]).map((theme) => (
                <button
                  key={theme}
                  className={stubTheme === theme ? "theme-chip active" : "theme-chip"}
                  onClick={() => setStubTheme(theme)}
                  type="button"
                >
                  {theme === "boarding"
                    ? "登机牌"
                    : theme === "ledger"
                      ? "复古票据"
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

      {exportMessage ? <p className="detail-loading">{exportMessage}</p> : null}

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
