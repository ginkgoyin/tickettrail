import type { TicketDetailPayload, TicketRecord } from "../types/ticket";

interface DashboardProps {
  detail: TicketDetailPayload | null;
  isLoading: boolean;
  ticket: TicketRecord | null;
}

export function Dashboard({ detail, isLoading, ticket }: DashboardProps) {
  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  const activeDetail = detail?.ticket.id === ticket.id ? detail : null;

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
        <div className="map-grid">
          <div className="map-node">
            <span>FROM</span>
            <strong>{activeDetail?.map.origin.code || ticket.departure.code || "--"}</strong>
            <p>{activeDetail?.map.origin.label || ticket.departure.name}</p>
          </div>
          <div className="map-line">
            <span className="line-dot" />
            <span className="line-path" />
            <span className="line-arrow">{"->"}</span>
          </div>
          <div className="map-node">
            <span>TO</span>
            <strong>{activeDetail?.map.destination.code || ticket.arrival.code || "--"}</strong>
            <p>{activeDetail?.map.destination.label || ticket.arrival.name}</p>
          </div>
        </div>
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
        <header>
          <span>{activeDetail?.stub.transportBadge || ticket.ticketType.toUpperCase()}</span>
          <strong>{activeDetail?.stub.primaryCode || ticket.code}</strong>
        </header>
        <div className="stub-body">
          <div>
            <span>{activeDetail?.stub.departureLabel || ticket.departure.name}</span>
            <strong>
              {(activeDetail?.stub.departureTimeLocal || ticket.departureTimeLocal).replace("T", " ")}
            </strong>
          </div>
          <div>
            <span>{activeDetail?.stub.arrivalLabel || ticket.arrival.name}</span>
            <strong>
              {(activeDetail?.stub.arrivalTimeLocal || ticket.arrivalTimeLocal).replace("T", " ")}
            </strong>
          </div>
        </div>
        <footer>
          <span>{activeDetail?.stub.carrierName || ticket.carrierName}</span>
          <span>{activeDetail?.stub.seatLabel || `${ticket.classInfo || "TBD"} / ${ticket.seatInfo || "TBD"}`}</span>
        </footer>
      </article>

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
