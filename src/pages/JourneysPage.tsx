import { useEffect, useMemo, useState } from "react";
import { listJourneys } from "../lib/journeyService";
import type { Journey } from "../types/journey";
import type { TicketRecord } from "../types/ticket";

type JourneysSubview = "summary" | "list";
type JourneyYearFilter = "all" | `${number}`;
type JourneyMonthFilter = "all" | `${number}${number}`;

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

function parseJourneyDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getJourneyRange(journey: Journey) {
  const start = parseJourneyDate(journey.startDate);
  const end = parseJourneyDate(journey.endDate);

  if (start && end) {
    return start <= end ? { start, end } : { start: end, end: start };
  }

  if (start) {
    return { start, end: start };
  }

  if (end) {
    return { start: end, end };
  }

  return null;
}

function formatDisplayDate(value?: string) {
  const parsed = parseJourneyDate(value);
  if (!parsed) {
    return null;
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatJourneyDateRange(journey: Journey) {
  const formattedStart = formatDisplayDate(journey.startDate);
  const formattedEnd = formatDisplayDate(journey.endDate);

  if (formattedStart && formattedEnd) {
    return formattedStart === formattedEnd
      ? formattedStart
      : `${formattedStart} -> ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd ?? "No date yet";
}

function formatJourneyDuration(journey: Journey) {
  const range = getJourneyRange(journey);
  if (!range) {
    return null;
  }

  const milliseconds = range.end.getTime() - range.start.getTime();
  const dayCount = Math.floor(milliseconds / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(dayCount) || dayCount <= 0) {
    return null;
  }

  return `${dayCount} day${dayCount === 1 ? "" : "s"}`;
}

function formatJourneyCost(journey: Journey) {
  if (typeof journey.costAmount !== "number" || !Number.isFinite(journey.costAmount)) {
    return null;
  }

  const formattedAmount = journey.costAmount.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return journey.costCurrency
    ? `${journey.costCurrency.toUpperCase()} ${formattedAmount}`
    : formattedAmount;
}

function summarizeCompanions(journey: Journey) {
  const count = journey.companions.length;
  if (count === 0) {
    return null;
  }

  if (count === 1) {
    return journey.companions[0].name;
  }

  if (count === 2) {
    return `${journey.companions[0].name} +1`;
  }

  return `${count} companions`;
}

function getJourneyYears(journey: Journey) {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  const years: string[] = [];
  for (let year = range.start.getFullYear(); year <= range.end.getFullYear(); year += 1) {
    years.push(String(year));
  }

  return years;
}

function getJourneyMonthsForYear(journey: Journey, year: string) {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  const numericYear = Number.parseInt(year, 10);
  if (Number.isNaN(numericYear)) {
    return [];
  }

  const startMonth = range.start.getFullYear() === numericYear ? range.start.getMonth() + 1 : 1;
  const endMonth = range.end.getFullYear() === numericYear ? range.end.getMonth() + 1 : 12;

  if (numericYear < range.start.getFullYear() || numericYear > range.end.getFullYear()) {
    return [];
  }

  const months: string[] = [];
  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(String(month).padStart(2, "0"));
  }

  return months;
}

function formatMonthLabel(value: JourneyMonthFilter) {
  if (value === "all") {
    return "All months";
  }

  const date = new Date(`2026-${value}-01T00:00:00`);
  return date.toLocaleDateString("en-AU", { month: "long" });
}

function sortJourneysByStartDate(journeys: Journey[]) {
  return [...journeys].sort((left, right) => {
    const leftStart = left.startDate ?? left.endDate ?? "";
    const rightStart = right.startDate ?? right.endDate ?? "";

    if (!leftStart && !rightStart) {
      return right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title);
    }
    if (!leftStart) {
      return 1;
    }
    if (!rightStart) {
      return -1;
    }

    return rightStart.localeCompare(leftStart) || right.updatedAt.localeCompare(left.updatedAt);
  });
}

function matchesJourneyFilters(
  journey: Journey,
  yearFilter: JourneyYearFilter,
  monthFilter: JourneyMonthFilter,
) {
  if (yearFilter === "all" && monthFilter === "all") {
    return true;
  }

  const years = getJourneyYears(journey);
  if (years.length === 0) {
    return false;
  }

  if (yearFilter !== "all" && !years.includes(yearFilter)) {
    return false;
  }

  if (monthFilter === "all") {
    return true;
  }

  const targetYears = yearFilter === "all" ? years : [yearFilter];
  return targetYears.some((year) => getJourneyMonthsForYear(journey, year).includes(monthFilter));
}

export function JourneysPage({ tickets }: JourneysPageProps) {
  const [subview, setSubview] = useState<JourneysSubview>("summary");
  const [showCreateHint, setShowCreateHint] = useState(false);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(false);
  const [journeysLoaded, setJourneysLoaded] = useState(false);
  const [journeysError, setJourneysError] = useState("");
  const [yearFilter, setYearFilter] = useState<JourneyYearFilter>("all");
  const [monthFilter, setMonthFilter] = useState<JourneyMonthFilter>("all");

  const archiveRange = useMemo(() => getArchiveDateRange(tickets), [tickets]);
  const flightCount = useMemo(
    () => tickets.filter((ticket) => ticket.ticketType === "flight").length,
    [tickets],
  );
  const railCount = tickets.length - flightCount;

  useEffect(() => {
    if (subview !== "list" || journeysLoaded || journeysLoading) {
      return;
    }

    let isMounted = true;

    const loadJourneys = async () => {
      setJourneysLoading(true);
      setJourneysError("");

      try {
        const storedJourneys = await listJourneys();
        if (!isMounted) {
          return;
        }

        setJourneys(sortJourneysByStartDate(storedJourneys));
        setJourneysLoaded(true);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setJourneysError(error instanceof Error ? error.message : "Failed to load journeys.");
      } finally {
        if (isMounted) {
          setJourneysLoading(false);
        }
      }
    };

    void loadJourneys();

    return () => {
      isMounted = false;
    };
  }, [journeysLoaded, journeysLoading, subview]);

  const handleRetryJourneys = async () => {
    setJourneysLoaded(false);
    setJourneysLoading(true);
    setJourneysError("");

    try {
      const storedJourneys = await listJourneys();
      setJourneys(sortJourneysByStartDate(storedJourneys));
      setJourneysLoaded(true);
    } catch (error) {
      setJourneysError(error instanceof Error ? error.message : "Failed to load journeys.");
    } finally {
      setJourneysLoading(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    journeys.forEach((journey) => {
      getJourneyYears(journey).forEach((year) => years.add(year));
    });
    return [...years].sort((left, right) => right.localeCompare(left));
  }, [journeys]);

  const availableMonths = useMemo(() => {
    if (yearFilter === "all") {
      return [];
    }

    const months = new Set<string>();
    journeys.forEach((journey) => {
      getJourneyMonthsForYear(journey, yearFilter).forEach((month) => months.add(month));
    });
    return [...months].sort((left, right) => left.localeCompare(right));
  }, [journeys, yearFilter]);

  useEffect(() => {
    if (yearFilter === "all" && monthFilter !== "all") {
      setMonthFilter("all");
      return;
    }

    if (monthFilter !== "all" && !availableMonths.includes(monthFilter)) {
      setMonthFilter("all");
    }
  }, [availableMonths, monthFilter, yearFilter]);

  const filteredJourneys = useMemo(() => {
    return journeys.filter((journey) => matchesJourneyFilters(journey, yearFilter, monthFilter));
  }, [journeys, monthFilter, yearFilter]);

  const summaryView = (
    <section className="section-stack">
      <div className="journeys-hero-grid">
        <div className="panel journeys-callout">
          <div>
            <span className="ticket-kind">Journey workspace</span>
            <h3>Travel records will live here.</h3>
          </div>
          <p className="hero-copy">
            Journeys are planned as manually created trip collections. The next step will let you select
            existing tickets and group them into one travel record.
          </p>
        </div>

        <div className="journeys-summary-grid">
          <div className="stat-card">
            <span className="stat-value">{journeysLoaded ? journeys.length : "--"}</span>
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
            <h3>Journey list is now backed by stored data</h3>
            <p className="hero-copy">
              Use the List subview to inspect real Journey rows, date filters, and compact trip cards. The
              create flow is still the next task.
            </p>
          </div>

          <div className="panel">
            <h3>Summary still stays lightweight for now</h3>
            <div className="journeys-placeholder-list">
              <div className="journeys-placeholder-item">
                <strong>Journey totals</strong>
                <span>Stored Journey count is available; richer trip statistics will come later.</span>
              </div>
              <div className="journeys-placeholder-item">
                <strong>Companion statistics</strong>
                <span>Detailed companion summaries stay with a later Journey Summary phase.</span>
              </div>
              <div className="journeys-placeholder-item">
                <strong>Journey map</strong>
                <span>Trip-level route visuals remain a separate future task.</span>
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
      <div className="panel journeys-filter-card">
        <div className="journeys-filter-row">
          <label className="journeys-inline-filter">
            <span>Year</span>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value as JourneyYearFilter)}>
              <option value="all">All years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="journeys-inline-filter">
            <span>Month</span>
            <select
              disabled={yearFilter === "all"}
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value as JourneyMonthFilter)}
            >
              <option value="all">All months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month as JourneyMonthFilter)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {journeysLoading ? (
        <div className="panel">
          <div className="empty-state">Loading stored journeys...</div>
        </div>
      ) : null}

      {!journeysLoading && journeysError ? (
        <div className="panel journeys-list-feedback-card">
          <h3>Failed to load journeys</h3>
          <p className="hero-copy">{journeysError}</p>
          <div className="journeys-feedback-actions">
            <button className="ghost-button" onClick={() => void handleRetryJourneys()} type="button">
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!journeysLoading && !journeysError && journeys.length === 0 ? (
        <div className="panel journeys-list-feedback-card">
          <h3>No journeys yet</h3>
          <p className="hero-copy">Create your first journey from existing tickets in the next step.</p>
          <span className="journeys-empty-meta">Create Journey is coming next.</span>
        </div>
      ) : null}

      {!journeysLoading && !journeysError && journeys.length > 0 && filteredJourneys.length === 0 ? (
        <div className="panel journeys-list-feedback-card">
          <h3>No journeys match the current filters</h3>
          <p className="hero-copy">
            Try resetting Year and Month back to All years / All months to include undated journeys again.
          </p>
        </div>
      ) : null}

      {!journeysLoading && !journeysError && filteredJourneys.length > 0 ? (
        <div className="journeys-list-grid">
          {filteredJourneys.map((journey) => {
            const duration = formatJourneyDuration(journey);
            const cost = formatJourneyCost(journey);
            const companionSummary = summarizeCompanions(journey);

            return (
              <article className="journey-list-card" key={journey.id}>
                <div className="journey-list-card-top">
                  <div className="journey-list-card-heading">
                    <strong>{journey.title}</strong>
                    <span className="journey-list-card-date">{formatJourneyDateRange(journey)}</span>
                  </div>
                  <span className="ticket-status ticket-status-draft">
                    {journey.dateMode === "auto" ? "Auto dates" : "Manual dates"}
                  </span>
                </div>

                <div className="ticket-row-submeta">
                  <span>{journey.destination || "No destination yet"}</span>
                  <span>
                    {journey.ticketIds.length} linked ticket{journey.ticketIds.length === 1 ? "" : "s"}
                  </span>
                  {duration ? <span>{duration}</span> : <span>No date yet</span>}
                </div>

                <div className="journey-list-metadata">
                  {companionSummary ? (
                    <span className="journey-list-meta-chip">Companions: {companionSummary}</span>
                  ) : null}
                  {typeof journey.rating === "number" ? (
                    <span className="journey-list-meta-chip">Rating: {journey.rating}/5</span>
                  ) : null}
                  {journey.mood ? <span className="journey-list-meta-chip">Mood: {journey.mood}</span> : null}
                  {cost ? <span className="journey-list-meta-chip">Cost: {cost}</span> : null}
                  {journey.lodging ? (
                    <span className="journey-list-meta-chip">Lodging: {journey.lodging}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  return (
    <section className="section-stack journeys-page">
      <div className="tickets-topbar">
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

        <div className="tickets-topbar-actions">
          <button className="primary-button" onClick={() => setShowCreateHint(true)} type="button">
            Create journey
          </button>
        </div>
      </div>

      {showCreateHint ? (
        <div className="journeys-inline-note" role="status">
          Create Journey is coming in JOURNEY-CREATE-001.
        </div>
      ) : null}

      {subview === "summary" ? summaryView : listView}
    </section>
  );
}
