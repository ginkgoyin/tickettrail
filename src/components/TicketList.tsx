import { useEffect, useMemo, useState } from "react";
import type { TicketRecord, TicketStatus, TicketType } from "../types/ticket";

export type TicketSort = "created_desc" | "created_asc" | "departure_asc" | "departure_desc";
type TicketListView = "list" | "timeline";

export interface TicketFilters {
  query: string;
  ticketType: "all" | TicketType;
  status: "all" | Exclude<TicketStatus, "draft">;
  sort: TicketSort;
}

export interface SavedFilterView {
  id: string;
  name: string;
  filters: TicketFilters;
  createdAt: string;
  pinned: boolean;
}

interface TicketListProps {
  tickets: TicketRecord[];
  totalCount: number;
  selectedId: string;
  busyTicketId?: string;
  filters: TicketFilters;
  savedViews: SavedFilterView[];
  onFiltersChange: (filters: TicketFilters) => void;
  onResetFilters: () => void;
  onSaveCurrentView: (name: string) => void;
  onApplySavedView: (id: string) => void;
  onUpdateSavedView: (id: string) => void;
  onRenameSavedView: (id: string, name: string) => void;
  onTogglePinSavedView: (id: string) => void;
  onDeleteSavedView: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: Exclude<TicketStatus, "draft">) => void;
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

function buildTimelineLabel(ticket: TicketRecord) {
  const [datePart] = safeText(ticket.departureTimeLocal).split("T");
  return datePart || safeText(ticket.createdAt).slice(0, 10);
}

function transportIcon(ticketType: TicketType) {
  return ticketType === "flight" ? "✈" : "🚆";
}

function renderTicketRow(
  ticket: TicketRecord,
  selectedId: string,
  onSelect: (id: string) => void,
) {
  return (
    <button
      className={ticket.id === selectedId ? "ticket-row selected" : "ticket-row"}
      key={ticket.id}
      onClick={() => onSelect(ticket.id)}
      type="button"
    >
      <div className="ticket-row-icon" aria-hidden="true">
        {transportIcon(ticket.ticketType)}
      </div>
      <div className="ticket-row-main">
        <div className="ticket-row-top">
          <strong>{ticket.routeLabel}</strong>
          <span className="ticket-code">{ticket.code}</span>
        </div>
        <div className="ticket-row-meta">
          <span>{formatDateTime(ticket.departureTimeLocal)}</span>
          <span>→</span>
          <span>{formatDateTime(ticket.arrivalTimeLocal)}</span>
        </div>
        <div className="ticket-row-submeta">
          <span>{ticket.carrierName}</span>
          <span>{`${ticket.departure.code || ticket.departure.name} → ${ticket.arrival.code || ticket.arrival.name}`}</span>
        </div>
      </div>
      <div className="ticket-row-side">
        <span className={`ticket-status ticket-status-${ticket.status}`}>{ticket.status}</span>
        <small>{`${ticket.segmentCount} leg${ticket.segmentCount > 1 ? "s" : ""}`}</small>
      </div>
    </button>
  );
}

export function TicketList({
  tickets,
  totalCount,
  selectedId,
  filters,
  onFiltersChange,
  onResetFilters,
  onSelect,
}: TicketListProps) {
  const pageSize = 20;
  const [viewMode, setViewMode] = useState<TicketListView>("list");
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageTickets = useMemo(() => tickets.slice(pageStart, pageStart + pageSize), [pageStart, pageSize, tickets]);

  useEffect(() => {
    setPage(1);
  }, [filters.query, filters.ticketType, filters.status, filters.sort]);

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, TicketRecord[]>();

    pageTickets.forEach((ticket) => {
      const key = buildTimelineLabel(ticket);
      groups.set(key, [...(groups.get(key) ?? []), ticket]);
    });

    return Array.from(groups.entries());
  }, [pageTickets]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Ticket history</h3>
        </div>
        <span className="status-pill">
          {tickets.length} shown / {totalCount} total
        </span>
      </div>

      <div className="ticket-toolbar compact-ticket-toolbar">
        <div className="theme-switcher">
          <button
            className={viewMode === "list" ? "theme-chip active" : "theme-chip"}
            onClick={() => setViewMode("list")}
            type="button"
          >
            List
          </button>
          <button
            className={viewMode === "timeline" ? "theme-chip active" : "theme-chip"}
            onClick={() => setViewMode("timeline")}
            type="button"
          >
            Timeline
          </button>
        </div>
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
            <option value="all">All</option>
            <option value="flight">Flight</option>
            <option value="train">Rail</option>
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
            <option value="all">All</option>
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
            <option value="departure_desc">Newest departure</option>
            <option value="departure_asc">Earliest departure</option>
            <option value="created_desc">Newest created</option>
            <option value="created_asc">Oldest created</option>
          </select>
        </label>
      </div>

      <button className="ghost-button compact-button filter-reset" onClick={onResetFilters} type="button">
        Reset filters
      </button>

      {viewMode === "list" ? (
        <div className="ticket-list compact-ticket-list">
          {tickets.length === 0 ? (
            <div className="empty-state">
              <strong>No tickets match the current filters.</strong>
              <p>Try adjusting search terms, ticket type, or travel status.</p>
            </div>
          ) : (
            pageTickets.map((ticket) => renderTicketRow(ticket, selectedId, onSelect))
          )}
        </div>
      ) : (
        <div className="timeline-list compact-timeline-list">
          {timelineGroups.length === 0 ? (
            <div className="empty-state">
              <strong>No tickets match the current filters.</strong>
              <p>Try adjusting search terms, ticket type, or travel status.</p>
            </div>
          ) : (
            timelineGroups.map(([label, group]) => (
              <div className="timeline-group" key={label}>
                <div className="timeline-date">{label}</div>
                <div className="timeline-items compact-ticket-list">
                  {group.map((ticket) => renderTicketRow(ticket, selectedId, onSelect))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tickets.length > pageSize ? (
        <div className="pagination-bar" aria-label="Ticket list pagination">
          <div className="pagination-summary">
            {`${pageStart + 1}-${Math.min(pageStart + pageTickets.length, tickets.length)} of ${tickets.length}`}
          </div>
          <div className="pagination-controls">
            <button
              className="ghost-button compact-button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                className={pageNumber === currentPage ? "theme-chip active" : "theme-chip"}
                key={`page-${pageNumber}`}
                onClick={() => setPage(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="ghost-button compact-button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
