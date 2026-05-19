import type { TicketRecord, TicketStatus } from "../types/ticket";

interface TicketListProps {
  tickets: TicketRecord[];
  selectedId: string;
  busyTicketId?: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: Exclude<TicketStatus, "draft">) => void;
}

function nextStatusOptions(status: TicketStatus): Exclude<TicketStatus, "draft">[] {
  const statuses: Exclude<TicketStatus, "draft">[] = ["saved", "used", "archived"];
  return statuses.filter((item) => item !== status);
}

export function TicketList({
  tickets,
  selectedId,
  busyTicketId,
  onSelect,
  onEdit,
  onDelete,
  onUpdateStatus,
}: TicketListProps) {
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
        {tickets.length === 0 ? (
          <div className="empty-state">
            <strong>No saved tickets yet</strong>
            <p>Create your first flight or train record to populate the archive.</p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const isBusy = busyTicketId === ticket.id;

            return (
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
                <div className="ticket-card-footer">
                  <span className={`ticket-status ticket-status-${ticket.status}`}>{ticket.status}</span>
                  <div className="ticket-card-actions">
                    <button
                      className="ghost-button compact-button"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(ticket.id);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    {nextStatusOptions(ticket.status).map((status) => (
                      <button
                        className="ghost-button compact-button"
                        disabled={isBusy}
                        key={status}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateStatus(ticket.id, status);
                        }}
                        type="button"
                      >
                        {status}
                      </button>
                    ))}
                    <button
                      className="ghost-button compact-button danger-button"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(ticket.id);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
