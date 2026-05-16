import { useMemo, useState } from "react";
import {
  buildMapSvg,
  buildStubSvg,
  exportPng,
  exportSvg,
  visualizationSizes,
} from "../lib/visualization";
import type { TicketDetailPayload, TicketRecord } from "../types/ticket";

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
}

export function Dashboard({ detail, isLoading, ticket }: DashboardProps) {
  const [exportMessage, setExportMessage] = useState("");

  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const activeDetail = detail?.ticket.id === ticket.id ? detail : null;
  const mapSvg = useMemo(() => (activeDetail ? buildMapSvg(activeDetail.map) : ""), [activeDetail]);
  const stubSvg = useMemo(() => (activeDetail ? buildStubSvg(activeDetail.stub) : ""), [activeDetail]);

  const handleExportSvg = (kind: "map" | "stub") => {
    if (!activeDetail) {
      return;
    }

    if (kind === "map") {
      exportSvg(`${activeDetail.ticket.code}-route-map.svg`, mapSvg);
      setExportMessage("Route map SVG exported.");
      return;
    }

    exportSvg(`${activeDetail.ticket.code}-ticket-stub.svg`, stubSvg);
    setExportMessage("Ticket stub SVG exported.");
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
      setExportMessage("Ticket stub PNG exported.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "PNG export failed.");
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

      {isLoading ? <p className="detail-loading">Loading derived route and stub data...</p> : null}

      <article className="map-preview">
        {activeDetail ? (
          <>
            <div
              className="svg-frame map-canvas"
              dangerouslySetInnerHTML={{ __html: mapSvg }}
            />
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("map")} type="button">
                Export map SVG
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
            <div
              className="svg-frame stub-canvas"
              dangerouslySetInnerHTML={{ __html: stubSvg }}
            />
            <div className="export-row">
              <button className="ghost-button" onClick={() => handleExportSvg("stub")} type="button">
                Export stub SVG
              </button>
              <button className="primary-button" onClick={() => void handleExportPng()} type="button">
                Export stub PNG
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
          <span>Map coords</span>
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
