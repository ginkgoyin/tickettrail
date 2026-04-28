import type { TicketRecord } from "../types/ticket";

interface TicketListProps {
  tickets: TicketRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TicketList({ tickets, selectedId, onSelect }: TicketListProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Archive</p>
          <h3>Ticket records</h3>
        </div>
        <span className="status-pill">{tickets.length} entries</span>
      </div>

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <button
            className={ticket.id === selectedId ? "ticket-card selected" : "ticket-card"}
            key={ticket.id}
            onClick={() => onSelect(ticket.id)}
            type="button"
          >
            <div className="ticket-card-top">
              <span className="ticket-kind">{ticket.ticketType}</span>
              <span className="ticket-code">{ticket.code}</span>
            </div>
            <strong>{ticket.routeLabel}</strong>
            <p>{ticket.carrierName}</p>
            <div className="ticket-meta">
              <span>{ticket.departureTimeLocal.replace("T", " ")}</span>
              <span>{ticket.classInfo || "Unassigned class"}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
