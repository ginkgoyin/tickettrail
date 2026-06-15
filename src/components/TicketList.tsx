import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import type { TicketRecord, TicketStatus, TicketType } from "../types/ticket";

export type TicketSort = "created_desc" | "created_asc" | "departure_asc" | "departure_desc";
export type TicketListView = "list" | "timeline";

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
  viewMode?: TicketListView;
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
  onDelete: (id: string) => void | Promise<boolean>;
  onUpdateStatus: (id: string, status: Exclude<TicketStatus, "draft">) => void;
  onViewModeChange?: (viewMode: TicketListView) => void;
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
  return ticketType === "flight" ? "\u2708" : "\uD83D\uDE86";
}

function getAutoDerivedStatusLabel(ticket: TicketRecord, language: "en" | "zh") {
  const candidate = safeText(ticket.arrivalTimeLocal).trim() || safeText(ticket.departureTimeLocal).trim();
  const timestamp = Date.parse(candidate);
  const isCompleted = Number.isFinite(timestamp) && timestamp < Date.now();

  if (language === "zh") {
    return isCompleted ? "已完成" : "未出行";
  }

  return isCompleted ? "Completed" : "Upcoming";
}

function getStatusDisplayLabel(ticket: TicketRecord, language: "en" | "zh") {
  if (ticket.status === "archived") {
    return language === "zh" ? "\u5df2\u5f52\u6863" : "Archived";
  }

  if (ticket.status === "used") {
    return language === "zh" ? "\u5df2\u5b8c\u6210" : "Completed";
  }

  return getAutoDerivedStatusLabel(ticket, language);
}

function getStatusChipLabel(ticket: TicketRecord, language: "en" | "zh") {
  if (ticket.status === "saved") {
    return language === "zh" ? "已保存" : "Saved";
  }
  if (ticket.status === "used") {
    return language === "zh" ? "已完成" : "Completed";
  }
  return language === "zh" ? "已归档" : "Archived";
}

function renderTicketRow(
  ticket: TicketRecord,
  selectedId: string,
  onSelect: (id: string) => void,
  language: "en" | "zh",
) {
  return (
    <button
      className={ticket.id === selectedId ? "ticket-row selected" : "ticket-row"}
      key={ticket.id}
      onClick={() => onSelect(ticket.id)}
      type="button"
    >
      <div aria-hidden="true" className="ticket-row-icon">
        {transportIcon(ticket.ticketType)}
      </div>
      <div className="ticket-row-main">
        <div className="ticket-row-top">
          <strong>{ticket.routeLabel}</strong>
          <span className="ticket-code">{ticket.code}</span>
        </div>
        <div className="ticket-row-meta">
          <span>{formatDateTime(ticket.departureTimeLocal)}</span>
          <span>{"->"}</span>
          <span>{formatDateTime(ticket.arrivalTimeLocal)}</span>
        </div>
        <div className="ticket-row-submeta">
          <span>{ticket.carrierName}</span>
          <span>{`${ticket.departure.code || ticket.departure.name} -> ${ticket.arrival.code || ticket.arrival.name}`}</span>
        </div>
      </div>
      <div className="ticket-row-side">
        <span className={`ticket-status ticket-status-${ticket.status}`}>{getStatusDisplayLabel(ticket, language)}</span>
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
  viewMode,
  onFiltersChange,
  onResetFilters,
  onSelect,
}: TicketListProps) {
  const { language, t } = useI18n();
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const effectiveViewMode = viewMode ?? "list";

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
      <div className="ticket-filters">
        <label>
          {t("search")}
          <input
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Code, route, carrier, notes..."
            value={filters.query}
          />
        </label>
        <label className="ticket-filter-select">
          {t("type")}
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                ticketType: event.target.value as TicketFilters["ticketType"],
              })
            }
            value={filters.ticketType}
          >
            <option value="all">{t("all")}</option>
            <option value="flight">{t("flights")}</option>
            <option value="train">{t("rail")}</option>
          </select>
        </label>
        <label className="ticket-filter-select">
          {t("status")}
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as TicketFilters["status"],
              })
            }
            value={filters.status}
          >
            <option value="all">{t("all")}</option>
            <option value="saved">{t("saved")}</option>
            <option value="used">{t("used")}</option>
            <option value="archived">{t("archived")}</option>
          </select>
        </label>
        <label className="ticket-filter-select">
          {t("sort")}
          <select
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                sort: event.target.value as TicketSort,
              })
            }
            value={filters.sort}
          >
            <option value="departure_desc">{t("newestDeparture")}</option>
            <option value="departure_asc">{t("earliestDeparture")}</option>
            <option value="created_desc">{t("newestCreated")}</option>
            <option value="created_asc">{t("oldestCreated")}</option>
          </select>
        </label>
        <button className="ghost-button compact-button filter-reset ticket-filter-reset-inline" onClick={onResetFilters} type="button">
          {t("resetFilters")}
        </button>
      </div>

      <div className="ticket-results-line">
        <span>{tickets.length} shown / {totalCount} total</span>
      </div>

      {effectiveViewMode === "list" ? (
        <div className="ticket-list compact-ticket-list">
          {tickets.length === 0 ? (
            <div className="empty-state">
              <strong>{t("noTicketsYet")}</strong>
              <p>{t("noTicketsMatchCurrentFilters")}</p>
            </div>
          ) : (
            pageTickets.map((ticket) => renderTicketRow(ticket, selectedId, onSelect, language))
          )}
        </div>
      ) : (
        <div className="timeline-list compact-timeline-list">
          {timelineGroups.length === 0 ? (
            <div className="empty-state">
              <strong>{t("noTicketsYet")}</strong>
              <p>{t("noTicketsMatchCurrentFilters")}</p>
            </div>
          ) : (
            timelineGroups.map(([label, group]) => (
              <div className="timeline-group" key={label}>
                <div className="timeline-date">{label}</div>
                <div className="timeline-items compact-ticket-list">
                  {group.map((ticket) => renderTicketRow(ticket, selectedId, onSelect, language))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tickets.length > pageSize ? (
        <div aria-label="Ticket list pagination" className="pagination-bar">
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
              {t("previous")}
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
              {t("next")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
