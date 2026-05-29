import { useMemo, useState } from "react";
import type { TicketRecord } from "../types/ticket";

type JourneysSubview = "summary" | "list";

interface JourneysPageProps {
  tickets: TicketRecord[];
}

function getArchiveDateRange(tickets: TicketRecord[]) {
  const dates = tickets
    .flatMap((ticket) => [ticket.departureTimeLocal, ticket.arrivalTimeLocal])
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  if (dates.length === 0) {
    return null;
  }

  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

export function JourneysPage({ tickets }: JourneysPageProps) {
  const [subview, setSubview] = useState<JourneysSubview>("summary");
  const [showCreateHint, setShowCreateHint] = useState(false);

  const archiveRange = useMemo(() => getArchiveDateRange(tickets), [tickets]);
  const flightCount = useMemo(
    () => tickets.filter((ticket) => ticket.ticketType === "flight").length,
    [tickets],
  );
  const railCount = tickets.length - flightCount;

  const summaryView = (
    <section className="section-stack">
      <div className="journeys-hero-grid">
        <div className="panel journeys-callout">
          <div className="journeys-callout-top">
            <div>
              <span className="ticket-kind">Journeys scaffold</span>
              <h3>Travel records will live here.</h3>
            </div>
            <button className="primary-button" onClick={() => setShowCreateHint(true)} type="button">
              Create journey
            </button>
          </div>
          <p className="hero-copy">
            Journeys are planned as manually created trip collections. A future create flow will let you
            select/check tickets from your archive and group them into one travel record.
          </p>
          {showCreateHint ? (
            <div className="journeys-inline-note" role="status">
              Real Journey creation is not part of Phase 1 yet. The future flow will open a ticket list so
              you can select/check the tickets that belong to a Journey.
            </div>
          ) : null}
        </div>

        <div className="journeys-summary-grid">
          <div className="stat-card">
            <span className="stat-value">--</span>
            <span className="stat-label">Journeys created</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{tickets.length}</span>
            <span className="stat-label">Tickets available to organize</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{flightCount}</span>
            <span className="stat-label">Flight tickets</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{railCount}</span>
            <span className="stat-label">Rail tickets</span>
          </div>
        </div>
      </div>

      <div className="content-grid journeys-phase-grid">
        <div className="panel-stack">
          <div className="panel">
            <h3>No journeys created yet</h3>
            <p className="hero-copy">
              Create journeys later by selecting tickets from your archive. Journeys will represent whole
              trips, not single-ticket detail.
            </p>
          </div>

          <div className="panel">
            <h3>Phase 1 summary placeholders</h3>
            <div className="journeys-placeholder-list">
              <div className="journeys-placeholder-item">
                <strong>Total journeys</strong>
                <span>Will appear after real Journey records exist.</span>
              </div>
              <div className="journeys-placeholder-item">
                <strong>Companion statistics</strong>
                <span>Planned for a later phase after Journey companions exist.</span>
              </div>
              <div className="journeys-placeholder-item">
                <strong>Journey map</strong>
                <span>Future map area for trip-level routes and year filtering.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-stack">
          <div className="panel">
            <h3>Archive context</h3>
            <div className="journeys-archive-meta">
              <div className="journeys-archive-meta-item">
                <span>Tickets ready to group</span>
                <strong>{tickets.length}</strong>
              </div>
              <div className="journeys-archive-meta-item">
                <span>Archive date range</span>
                <strong>
                  {archiveRange
                    ? `${archiveRange.start} -> ${archiveRange.end}`
                    : "No ticket dates available yet"}
                </strong>
              </div>
              <div className="journeys-archive-meta-item">
                <span>Default year filter</span>
                <strong>All years</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const listView = (
    <section className="section-stack">
      <div className="panel journeys-callout">
        <div className="journeys-callout-top">
          <div>
            <span className="ticket-kind">Journey list</span>
            <h3>No journeys created yet</h3>
          </div>
          <button className="primary-button" onClick={() => setShowCreateHint(true)} type="button">
            Create journey
          </button>
        </div>
        <p className="hero-copy">
          This list will eventually show manually created trip records. Each item will use a Journey title
          as the main label, with destination, date range, duration, and ticket count as secondary
          metadata.
        </p>
        {showCreateHint ? (
          <div className="journeys-inline-note" role="status">
            Phase 1 does not persist Journeys yet. Future creation will start from a ticket list where you
            select/check the tickets that belong to the trip.
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="empty-state">
          No journeys created yet. Journey records will appear here after future manual creation support is
          implemented.
        </div>
      </div>

      <div className="panel">
        <h3>Planned item layout preview</h3>
        <p className="hero-copy">Placeholder only. This does not represent saved Journey data yet.</p>
        <div className="journey-list-preview-card">
          <div className="journey-list-preview-top">
            <strong>Jiangzhehu trip 2026</strong>
            <span className="ticket-status ticket-status-draft">Placeholder</span>
          </div>
          <div className="ticket-row-submeta">
            <span>Shanghai</span>
            <span>Hangzhou</span>
            <span>4 days</span>
            <span>3 tickets</span>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <section className="section-stack journeys-page">
      <div className="journeys-subview-bar">
        <div className="tickets-tab-group" aria-label="Journeys subviews" role="tablist">
          <button
            aria-selected={subview === "summary"}
            className={subview === "summary" ? "theme-chip active" : "theme-chip"}
            onClick={() => setSubview("summary")}
            role="tab"
            type="button"
          >
            Summary
          </button>
          <button
            aria-selected={subview === "list"}
            className={subview === "list" ? "theme-chip active" : "theme-chip"}
            onClick={() => setSubview("list")}
            role="tab"
            type="button"
          >
            List
          </button>
        </div>
      </div>

      {subview === "summary" ? summaryView : listView}
    </section>
  );
}
