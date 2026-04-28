import type { TicketRecord } from "../types/ticket";

interface DashboardProps {
  ticket: TicketRecord | null;
}

export function Dashboard({ ticket }: DashboardProps) {
  if (!ticket) {
    return (
      <section className="panel dashboard">
        <h3>No ticket selected</h3>
      </section>
    );
  }

  return (
    <section className="panel dashboard">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>{ticket.routeLabel}</h3>
        </div>
        <span className="status-pill">{ticket.status}</span>
      </div>

      <article className="map-preview">
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
      </article>

      <article className="stub-preview">
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
          <span>{ticket.classInfo || "TBD"} / {ticket.seatInfo || "TBD"}</span>
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
          <strong>{ticket.notes || "No notes yet"}</strong>
        </div>
      </article>
    </section>
  );
}
