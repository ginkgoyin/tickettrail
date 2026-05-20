import { useMemo, useState } from "react";
import { exportTextFile } from "../lib/visualization";
import type { TicketRecord, TicketStatus, TicketType } from "../types/ticket";

type TicketSort = "created_desc" | "created_asc" | "departure_asc" | "departure_desc";
type TicketListView = "cards" | "timeline";

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

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function buildTimelineLabel(ticket: TicketRecord) {
  const [datePart] = ticket.departureTimeLocal.split("T");
  return datePart || ticket.createdAt.slice(0, 10);
}

function buildBatchExportJson(tickets: TicketRecord[]) {
  return JSON.stringify(tickets, null, 2);
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildBatchExportCsv(tickets: TicketRecord[]) {
  const header = [
    "id",
    "ticketType",
    "status",
    "code",
    "carrierName",
    "routeLabel",
    "segmentCount",
    "departureName",
    "departureCode",
    "departureTimeLocal",
    "arrivalName",
    "arrivalCode",
    "arrivalTimeLocal",
    "notes",
  ];

  const rows = tickets.map((ticket) =>
    [
      ticket.id,
      ticket.ticketType,
      ticket.status,
      ticket.code,
      ticket.carrierName,
      ticket.routeLabel,
      ticket.segmentCount,
      ticket.departure.name,
      ticket.departure.code || "",
      ticket.departureTimeLocal,
      ticket.arrival.name,
      ticket.arrival.code || "",
      ticket.arrivalTimeLocal,
      ticket.notes,
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function renderTicketCard(
  ticket: TicketRecord,
  selectedId: string,
  busyTicketId: string | undefined,
  onSelect: (id: string) => void,
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onUpdateStatus: (id: string, status: Exclude<TicketStatus, "draft">) => void,
) {
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
        <span>{formatDateTime(ticket.departureTimeLocal)}</span>
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
  const [viewMode, setViewMode] = useState<TicketListView>("cards");
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, TicketRecord[]>();

    tickets.forEach((ticket) => {
      const key = buildTimelineLabel(ticket);
      groups.set(key, [...(groups.get(key) ?? []), ticket]);
    });

    return Array.from(groups.entries());
  }, [tickets]);

  const handleBatchExport = (kind: "json" | "csv") => {
    if (!tickets.length) {
      return;
    }

    if (kind === "json") {
      exportTextFile(
        `tickettrail-batch-${tickets.length}.json`,
        buildBatchExportJson(tickets),
        "application/json;charset=utf-8",
      );
      return;
    }

    exportTextFile(
      `tickettrail-batch-${tickets.length}.csv`,
      buildBatchExportCsv(tickets),
      "text/csv;charset=utf-8",
    );
  };

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

      <div className="ticket-toolbar">
        <div className="theme-switcher">
          <button
            className={viewMode === "cards" ? "theme-chip active" : "theme-chip"}
            onClick={() => setViewMode("cards")}
            type="button"
          >
            Card view
          </button>
          <button
            className={viewMode === "timeline" ? "theme-chip active" : "theme-chip"}
            onClick={() => setViewMode("timeline")}
            type="button"
          >
            Timeline
          </button>
        </div>
        <div className="export-row">
          <button className="ghost-button compact-button" onClick={() => handleBatchExport("json")} type="button">
            导出当前 JSON
          </button>
          <button className="ghost-button compact-button" onClick={() => handleBatchExport("csv")} type="button">
            导出当前 CSV
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
        ) : viewMode === "cards" ? (
          tickets.map((ticket) =>
            renderTicketCard(
              ticket,
              selectedId,
              busyTicketId,
              onSelect,
              onEdit,
              onDelete,
              onUpdateStatus,
            ),
          )
        ) : (
          <div className="timeline-list">
            {timelineGroups.map(([timelineKey, groupedTickets]) => (
              <section className="timeline-group" key={timelineKey}>
                <div className="timeline-marker">
                  <span className="timeline-dot" />
                  <strong>{timelineKey}</strong>
                  <small>{`${groupedTickets.length} ticket(s)`}</small>
                </div>
                <div className="timeline-cards">
                  {groupedTickets.map((ticket) =>
                    renderTicketCard(
                      ticket,
                      selectedId,
                      busyTicketId,
                      onSelect,
                      onEdit,
                      onDelete,
                      onUpdateStatus,
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
