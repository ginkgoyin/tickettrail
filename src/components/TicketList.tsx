import type { TicketRecord, TicketStatus, TicketType } from "../types/ticket";

type TicketSort = "created_desc" | "created_asc" | "departure_asc" | "departure_desc";

interface TicketFilters {
  query: string;
  ticketType: "all" | TicketType;
  status: "all" | Exclude<TicketStatus, "draft">;
  sort: TicketSort;
}

interface TicketListProps {
  tickets: TicketRecord[];
  totalCount: number;
  selectedId: string;
  busyTicketId?: string;
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  onResetFilters: () => void;
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
  totalCount,
  selectedId,
  busyTicketId,
  filters,
  onFiltersChange,
  onResetFilters,
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
        <span className="status-pill">
          {tickets.length} shown / {totalCount} total
        </span>
      </div>

      <div className="ticket-filters">
        <label>
          Search
          <input
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Code, route, carrier, notes..."
            value={filters.query}
          />
        </label>
        <label>
          Type
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                ticketType: event.target.value as TicketFilters["ticketType"],
              })
            }
            value={filters.ticketType}
          >
            <option value="all">All types</option>
            <option value="flight">Flight</option>
            <option value="train">Train</option>
          </select>
        </label>
        <label>
          Status
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as TicketFilters["status"],
              })
            }
            value={filters.status}
          >
            <option value="all">All status</option>
            <option value="saved">Saved</option>
            <option value="used">Used</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          Sort
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                sort: event.target.value as TicketSort,
              })
            }
            value={filters.sort}
          >
            <option value="created_desc">Newest created</option>
            <option value="created_asc">Oldest created</option>
            <option value="departure_asc">Earliest departure</option>
            <option value="departure_desc">Latest departure</option>
          </select>
        </label>
        <button className="ghost-button compact-button filter-reset" onClick={onResetFilters} type="button">
          Clear filters
        </button>
      </div>

      <div className="ticket-list">
        {tickets.length === 0 ? (
          <div className="empty-state">
            <strong>No matching tickets</strong>
            <p>Try clearing filters or create a new flight or train record.</p>
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
                  <span>{`${ticket.segmentCount} segment(s)`}</span>
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
