import { useEffect, useMemo, useState } from "react";
import { createJourney, listJourneys } from "../lib/journeyService";
import type { CreateJourneyInput, Journey, JourneyDateMode } from "../types/journey";
import type { TicketLocation, TicketRecord } from "../types/ticket";

type JourneysSubview = "summary" | "list";
type JourneyYearFilter = "all" | `${number}`;
type JourneyMonthFilter = "all" | `${number}${number}`;

interface JourneysPageProps {
  tickets: TicketRecord[];
}

interface CreateJourneyDraft {
  title: string;
  destination: string;
  dateMode: JourneyDateMode;
  manualStartDate: string;
  manualEndDate: string;
  companionsText: string;
  rating: number | null;
  mood: string;
  costAmount: string;
  costCurrency: string;
  lodging: string;
  notes: string;
  selectedTicketIds: string[];
}

interface DerivedJourneyDatePreview {
  startDate?: string;
  endDate?: string;
}

const EMPTY_CREATE_JOURNEY_DRAFT: CreateJourneyDraft = {
  title: "",
  destination: "",
  dateMode: "auto",
  manualStartDate: "",
  manualEndDate: "",
  companionsText: "",
  rating: null,
  mood: "",
  costAmount: "",
  costCurrency: "",
  lodging: "",
  notes: "",
  selectedTicketIds: [],
};

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
    return formattedStart === formattedEnd ? formattedStart : `${formattedStart} → ${formattedEnd}`;
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
  if (journey.companions.length === 0) {
    return null;
  }

  return journey.companions.map((companion) => companion.name).join(", ");
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

function sameTicketLocation(left: TicketLocation, right: TicketLocation) {
  const leftCode = (left.code ?? "").trim().toLowerCase();
  const rightCode = (right.code ?? "").trim().toLowerCase();

  if (leftCode && rightCode) {
    return leftCode === rightCode;
  }

  return left.name.trim().toLowerCase() === right.name.trim().toLowerCase();
}

function formatTicketDateLabel(ticket: TicketRecord) {
  const candidate = ticket.departureTimeLocal || ticket.arrivalTimeLocal;
  if (!candidate) {
    return "No date";
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return candidate.slice(0, 10).replace(/-/g, "/");
  }

  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildTicketRouteSummary(ticket: TicketRecord) {
  const segments = ticket.segments ?? [];
  if (segments.length === 0) {
    return `${ticket.departure.name} -> ${ticket.arrival.name}`;
  }

  const stops = sameTicketLocation(ticket.departure, segments[0].departure)
    ? [segments[0].departure.name, ...segments.map((segment) => segment.arrival.name)]
    : [ticket.departure.name, ...segments.map((segment) => segment.departure.name), ticket.arrival.name];

  return stops.filter(Boolean).filter((stop, index, values) => stop !== values[index - 1]).join(" -> ");
}

function buildTicketCodeSummary(ticket: TicketRecord) {
  const segments = ticket.segments ?? [];
  const codes = sameTicketLocation(ticket.departure, segments[0]?.departure ?? ticket.departure)
    ? segments.map((segment) => segment.code)
    : [ticket.code, ...segments.map((segment) => segment.code)];

  const cleanedCodes = codes
    .map((code) => code.trim())
    .filter(Boolean)
    .filter((code, index, values) => code !== values[index - 1]);

  return cleanedCodes.join(" / ") || ticket.code || "No code";
}

function transportIcon(ticketType: TicketRecord["ticketType"]) {
  return ticketType === "flight" ? "✈" : "🚆";
}

function buildTicketSearchText(ticket: TicketRecord) {
  const dateParts = [
    ticket.departureTimeLocal,
    ticket.arrivalTimeLocal,
    ticket.departureTimeLocal.slice(0, 10),
    ticket.departureTimeLocal.slice(0, 7),
  ];

  return [
    ticket.ticketType,
    ticket.carrierName,
    ticket.code,
    ticket.departure.name,
    ticket.departure.code ?? "",
    ticket.arrival.name,
    ticket.arrival.code ?? "",
    buildTicketRouteSummary(ticket),
    buildTicketCodeSummary(ticket),
    ...dateParts,
  ]
    .join(" ")
    .toLowerCase();
}

function parseCompanionNames(value: string) {
  return value
    .split(/[,\n，、]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractTicketStartDate(ticket: TicketRecord) {
  return (ticket.departureTimeLocal || ticket.arrivalTimeLocal || "").slice(0, 10);
}

function extractTicketEndDate(ticket: TicketRecord) {
  return (ticket.arrivalTimeLocal || ticket.departureTimeLocal || "").slice(0, 10);
}

function deriveJourneyDatePreview(selectedTickets: TicketRecord[]): DerivedJourneyDatePreview {
  if (selectedTickets.length === 0) {
    return {};
  }

  const startDates = selectedTickets
    .map((ticket) => extractTicketStartDate(ticket))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const endDates = selectedTickets
    .map((ticket) => extractTicketEndDate(ticket))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return {
    startDate: startDates[0],
    endDate: endDates[endDates.length - 1],
  };
}

function formatPreviewDateRange(preview: DerivedJourneyDatePreview) {
  if (!preview.startDate && !preview.endDate) {
    return "No date yet";
  }

  const formattedStart = formatDisplayDate(preview.startDate) ?? "No date yet";
  const formattedEnd = formatDisplayDate(preview.endDate) ?? "No date yet";

  return preview.startDate === preview.endDate ? formattedStart : `${formattedStart} → ${formattedEnd}`;
}

function lookupTimezoneCurrency(timezone?: string) {
  const normalizedTimezone = (timezone ?? "").trim();
  if (!normalizedTimezone) {
    return null;
  }

  if (normalizedTimezone.startsWith("Australia/")) {
    return "AUD";
  }
  if (normalizedTimezone === "Pacific/Auckland") {
    return "NZD";
  }
  if (normalizedTimezone === "Asia/Tokyo") {
    return "JPY";
  }
  if (normalizedTimezone === "Asia/Seoul") {
    return "KRW";
  }
  if (normalizedTimezone === "Asia/Hong_Kong") {
    return "HKD";
  }
  if (normalizedTimezone === "Asia/Singapore") {
    return "SGD";
  }
  if (normalizedTimezone === "Asia/Bangkok") {
    return "THB";
  }
  if (normalizedTimezone === "Asia/Shanghai" || normalizedTimezone === "Asia/Urumqi") {
    return "CNY";
  }
  if (normalizedTimezone === "Europe/London") {
    return "GBP";
  }
  if (normalizedTimezone.startsWith("America/")) {
    return "USD";
  }

  return null;
}

function deriveJourneyCurrencySuggestion(selectedTickets: TicketRecord[]) {
  if (selectedTickets.length === 0) {
    return "";
  }

  const sortedTickets = [...selectedTickets].sort((left, right) => {
    const leftStart = left.departureTimeLocal || left.arrivalTimeLocal || "";
    const rightStart = right.departureTimeLocal || right.arrivalTimeLocal || "";
    return leftStart.localeCompare(rightStart) || left.createdAt.localeCompare(right.createdAt);
  });

  const originCurrency = lookupTimezoneCurrency(sortedTickets[0]?.departure.timezone);
  const stopCurrencies = sortedTickets
    .flatMap((ticket) => [
      lookupTimezoneCurrency(ticket.arrival.timezone),
      ...(ticket.segments ?? []).map((segment) => lookupTimezoneCurrency(segment.arrival.timezone)),
    ])
    .filter((value): value is string => Boolean(value));

  const firstForeignCurrency = stopCurrencies.find(
    (currency) => originCurrency === null || currency !== originCurrency,
  );
  if (firstForeignCurrency) {
    return firstForeignCurrency;
  }

  const uniqueCurrencies = [...new Set(stopCurrencies)];
  return uniqueCurrencies.length === 1 ? uniqueCurrencies[0] : "";
}

function buildCreateJourneyInput(draft: CreateJourneyDraft): CreateJourneyInput {
  const trimmedCostAmount = draft.costAmount.trim();
  const parsedCostAmount =
    trimmedCostAmount.length > 0 ? Number.parseFloat(trimmedCostAmount) : Number.NaN;

  return {
    title: draft.title.trim(),
    destination: draft.destination.trim() || undefined,
    dateMode: draft.dateMode,
    startDate:
      draft.dateMode === "manual" ? draft.manualStartDate.trim() || undefined : undefined,
    endDate: draft.dateMode === "manual" ? draft.manualEndDate.trim() || undefined : undefined,
    notes: draft.notes.trim() || undefined,
    rating: draft.rating ?? undefined,
    mood: draft.mood.trim() || undefined,
    costAmount: Number.isFinite(parsedCostAmount) ? parsedCostAmount : undefined,
    costCurrency: draft.costCurrency.trim() || undefined,
    lodging: draft.lodging.trim() || undefined,
    companionNames: parseCompanionNames(draft.companionsText),
    ticketIds: draft.selectedTicketIds,
  };
}

export function JourneysPage({ tickets }: JourneysPageProps) {
  const [subview, setSubview] = useState<JourneysSubview>("summary");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(false);
  const [journeysLoaded, setJourneysLoaded] = useState(false);
  const [journeysError, setJourneysError] = useState("");
  const [yearFilter, setYearFilter] = useState<JourneyYearFilter>("all");
  const [monthFilter, setMonthFilter] = useState<JourneyMonthFilter>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateJourneyDraft>(EMPTY_CREATE_JOURNEY_DRAFT);
  const [ticketSearch, setTicketSearch] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [costCurrencyTouched, setCostCurrencyTouched] = useState(false);

  const archiveRange = useMemo(() => getArchiveDateRange(tickets), [tickets]);
  const flightCount = useMemo(
    () => tickets.filter((ticket) => ticket.ticketType === "flight").length,
    [tickets],
  );
  const railCount = tickets.length - flightCount;

  const availableTickets = useMemo(() => {
    return [...tickets].sort((left, right) => {
      const leftDate = left.departureTimeLocal || left.arrivalTimeLocal || "";
      const rightDate = right.departureTimeLocal || right.arrivalTimeLocal || "";
      return rightDate.localeCompare(leftDate) || right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [tickets]);

  const filteredSelectableTickets = useMemo(() => {
    const normalizedQuery = ticketSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableTickets;
    }

    return availableTickets.filter((ticket) => buildTicketSearchText(ticket).includes(normalizedQuery));
  }, [availableTickets, ticketSearch]);

  const selectedTickets = useMemo(() => {
    const selectedIds = new Set(createDraft.selectedTicketIds);
    return availableTickets.filter((ticket) => selectedIds.has(ticket.id));
  }, [availableTickets, createDraft.selectedTicketIds]);

  const autoDatePreview = useMemo(() => deriveJourneyDatePreview(selectedTickets), [selectedTickets]);

  const loadStoredJourneys = async () => {
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

  useEffect(() => {
    if (subview !== "list" || journeysLoaded || journeysLoading) {
      return;
    }

    void loadStoredJourneys();
  }, [journeysLoaded, journeysLoading, subview]);

  useEffect(() => {
    if (costCurrencyTouched || createDraft.costCurrency.trim()) {
      return;
    }

    const suggestedCurrency = deriveJourneyCurrencySuggestion(selectedTickets);
    if (!suggestedCurrency) {
      return;
    }

    setCreateDraft((current) => {
      if (current.costCurrency.trim()) {
        return current;
      }

      return {
        ...current,
        costCurrency: suggestedCurrency,
      };
    });
  }, [costCurrencyTouched, createDraft.costCurrency, selectedTickets]);

  const handleRetryJourneys = async () => {
    setJourneysLoaded(false);
    await loadStoredJourneys();
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

  const openCreateJourneyModal = () => {
    setCreateDraft(EMPTY_CREATE_JOURNEY_DRAFT);
    setTicketSearch("");
    setCreateError("");
    setTitleError("");
    setCostCurrencyTouched(false);
    setIsCreateModalOpen(true);
  };

  const closeCreateJourneyModal = () => {
    if (createSaving) {
      return;
    }

    setIsCreateModalOpen(false);
    setCreateError("");
    setTitleError("");
    setTicketSearch("");
    setCostCurrencyTouched(false);
  };

  const toggleSelectedTicket = (ticketId: string) => {
    setCreateDraft((current) => {
      const nextSelectedTicketIds = current.selectedTicketIds.includes(ticketId)
        ? current.selectedTicketIds.filter((value) => value !== ticketId)
        : [...current.selectedTicketIds, ticketId];

      return {
        ...current,
        selectedTicketIds: nextSelectedTicketIds,
      };
    });
  };

  const handleCreateJourney = async () => {
    const trimmedTitle = createDraft.title.trim();
    if (!trimmedTitle) {
      setTitleError("Title is required.");
      setCreateError("");
      return;
    }

    setCreateSaving(true);
    setCreateError("");
    setTitleError("");

    try {
      await createJourney(buildCreateJourneyInput(createDraft));
      setYearFilter("all");
      setMonthFilter("all");
      setSubview("list");
      setIsCreateModalOpen(false);
      setCreateDraft(EMPTY_CREATE_JOURNEY_DRAFT);
      setTicketSearch("");
      setCostCurrencyTouched(false);
      await loadStoredJourneys();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create journey.");
    } finally {
      setCreateSaving(false);
    }
  };

  const summaryView = (
    <section className="section-stack">
      <div className="journeys-hero-grid">
        <div className="panel journeys-callout">
          <div>
            <span className="ticket-kind">Journey workspace</span>
            <h3>Travel records will live here.</h3>
          </div>
          <p className="hero-copy">
            Journeys are manually created trip collections. Use the List view to select existing tickets
            and group them into one travel record.
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
              Use the List subview to inspect real Journey rows, date filters, compact trip cards, and
              the Create journey modal.
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
          <span className="journeys-empty-meta">Use Create journey above when you are ready.</span>
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
                  <strong>{journey.title}</strong>
                  <span className="journey-list-card-date">{formatJourneyDateRange(journey)}</span>
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
                    <span className="journey-list-meta-chip">{companionSummary}</span>
                  ) : null}
                  {typeof journey.rating === "number" ? (
                    <span className="journey-list-meta-chip journey-list-meta-chip-rating">
                      {"★".repeat(journey.rating)}
                      {"☆".repeat(5 - journey.rating)}
                    </span>
                  ) : null}
                  {journey.mood ? (
                    <span className="journey-list-meta-chip journey-list-meta-chip-mood">{journey.mood}</span>
                  ) : null}
                  {cost ? (
                    <span className="journey-list-meta-chip journey-list-meta-chip-cost">{cost}</span>
                  ) : null}
                  {journey.lodging ? (
                    <span className="journey-list-meta-chip">{journey.lodging}</span>
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

        {subview === "list" ? (
          <div className="tickets-topbar-actions">
            <button className="primary-button" onClick={openCreateJourneyModal} type="button">
              Create journey
            </button>
          </div>
        ) : null}
      </div>

      {subview === "summary" ? summaryView : listView}

      {isCreateModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="create-journey-title"
            aria-modal="true"
            className="modal-shell tickets-modal journey-create-modal"
            role="dialog"
          >
            <div className="tickets-modal-header">
              <div>
                <h3 id="create-journey-title">Create journey</h3>
                <p className="hero-copy">Group existing tickets into one travel record.</p>
              </div>
              <button
                aria-label="Close create journey modal"
                className="modal-close-button"
                onClick={closeCreateJourneyModal}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="tickets-modal-body">
              {createError ? (
                <div className="journey-create-feedback journey-create-feedback-error" role="alert">
                  {createError}
                </div>
              ) : null}

              <div className="journey-create-grid">
                <section className="panel journey-create-section journey-create-section-basic">
                  <h3>Basic</h3>
                  <div className="journey-create-fields">
                    <label>
                      <span>Title *</span>
                      <input
                        onBlur={() => {
                          if (!createDraft.title.trim()) {
                            setTitleError("Title is required.");
                          }
                        }}
                        onChange={(event) => {
                          setCreateDraft((current) => ({ ...current, title: event.target.value }));
                          if (titleError) {
                            setTitleError("");
                          }
                        }}
                        placeholder="Japan spring trip"
                        value={createDraft.title}
                      />
                      {titleError ? <span className="journey-create-field-error">{titleError}</span> : null}
                    </label>

                    <label>
                      <span>Destination</span>
                      <input
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, destination: event.target.value }))
                        }
                        placeholder="Tokyo"
                        value={createDraft.destination}
                      />
                    </label>

                    <label>
                      <span>Date mode</span>
                      <select
                        onChange={(event) =>
                          setCreateDraft((current) => ({
                            ...current,
                            dateMode: event.target.value as JourneyDateMode,
                          }))
                        }
                        value={createDraft.dateMode}
                      >
                        <option value="auto">Auto from selected tickets</option>
                        <option value="manual">Manual date range</option>
                      </select>
                    </label>

                    {createDraft.dateMode === "auto" ? (
                      <div className="journey-create-derived-card">
                        <span>Derived trip dates</span>
                        <strong>{formatPreviewDateRange(autoDatePreview)}</strong>
                      </div>
                    ) : null}

                    <div className="journey-create-inline-grid">
                      <label>
                        <span>Manual start date</span>
                        <input
                          disabled={createDraft.dateMode !== "manual"}
                          onChange={(event) =>
                            setCreateDraft((current) => ({
                              ...current,
                              manualStartDate: event.target.value,
                            }))
                          }
                          type="date"
                          value={createDraft.manualStartDate}
                        />
                      </label>

                      <label>
                        <span>Manual end date</span>
                        <input
                          disabled={createDraft.dateMode !== "manual"}
                          onChange={(event) =>
                            setCreateDraft((current) => ({
                              ...current,
                              manualEndDate: event.target.value,
                            }))
                          }
                          type="date"
                          value={createDraft.manualEndDate}
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="panel journey-create-section journey-create-section-tickets">
                  <div className="journey-create-section-top">
                    <div>
                      <div className="section-page-title-row">
                        <h3>Tickets</h3>
                        <div className="section-help">
                          <button
                            aria-label="Journey ticket selector help"
                            className="section-help-trigger"
                            type="button"
                          >
                            i
                          </button>
                          <div className="section-help-tooltip" role="tooltip">
                            Select zero or more existing tickets to link into this journey.
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="ticket-status ticket-status-saved">
                      {createDraft.selectedTicketIds.length} selected
                    </span>
                  </div>

                  <div className="journey-create-fields">
                    <label>
                      <span>Ticket selector search</span>
                      <input
                        onChange={(event) => setTicketSearch(event.target.value)}
                        placeholder="Search by date, month, year, code, route, departure, arrival..."
                        value={ticketSearch}
                      />
                    </label>

                    <div className="journey-ticket-selector">
                      {filteredSelectableTickets.length === 0 ? (
                        <div className="empty-state">No tickets match the current search.</div>
                      ) : (
                        filteredSelectableTickets.map((ticket) => {
                          const selected = createDraft.selectedTicketIds.includes(ticket.id);
                          const routeSummary = buildTicketRouteSummary(ticket);
                          const codeSummary = buildTicketCodeSummary(ticket);

                          return (
                            <label
                              className={selected ? "journey-ticket-option selected" : "journey-ticket-option"}
                              key={ticket.id}
                            >
                              <input
                                checked={selected}
                                onChange={() => toggleSelectedTicket(ticket.id)}
                                type="checkbox"
                              />
                              <span className="journey-ticket-option-icon" aria-hidden="true">
                                {transportIcon(ticket.ticketType)}
                              </span>
                              <span className="journey-ticket-option-main">
                                <span className="journey-ticket-option-top">
                                  <strong>{routeSummary}</strong>
                                </span>
                                <span className="ticket-row-meta">
                                  <span>{formatTicketDateLabel(ticket)}</span>
                                  <span>
                                    {ticket.carrierName ? `${codeSummary} (${ticket.carrierName})` : codeSummary}
                                  </span>
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>

                <section className="panel journey-create-section journey-create-section-people">
                  <h3>People &amp; cost</h3>
                  <div className="journey-create-fields">
                    <label>
                      <span>Companions</span>
                      <textarea
                        onChange={(event) =>
                          setCreateDraft((current) => ({
                            ...current,
                            companionsText: event.target.value,
                          }))
                        }
                        placeholder="Separate names with comma, Chinese comma, dunhao, or new lines"
                        value={createDraft.companionsText}
                      />
                    </label>

                    <div className="journey-create-rating-block">
                      <span>Rating</span>
                      <div className="journey-rating-row">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            className={
                              (createDraft.rating ?? 0) >= value
                                ? "journey-rating-button active"
                                : "journey-rating-button"
                            }
                            key={value}
                            onClick={() =>
                              setCreateDraft((current) => ({
                                ...current,
                                rating: value,
                              }))
                            }
                            type="button"
                          >
                            ★
                          </button>
                        ))}
                        {createDraft.rating ? (
                          <button
                            className="ghost-button compact-button"
                            onClick={() =>
                              setCreateDraft((current) => ({
                                ...current,
                                rating: null,
                              }))
                            }
                            type="button"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <label>
                      <span>Mood</span>
                      <input
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, mood: event.target.value }))
                        }
                        placeholder="Relaxed, excited, hectic..."
                        value={createDraft.mood}
                      />
                    </label>

                    <div className="journey-create-inline-grid">
                      <label>
                        <span>Cost amount</span>
                        <input
                          inputMode="decimal"
                          onChange={(event) =>
                            setCreateDraft((current) => ({ ...current, costAmount: event.target.value }))
                          }
                          placeholder="2400"
                          type="number"
                          value={createDraft.costAmount}
                        />
                      </label>

                      <label>
                        <span>Cost currency</span>
                        <input
                          onChange={(event) =>
                            setCreateDraft((current) => ({ ...current, costCurrency: event.target.value }))
                          }
                          onInput={() => setCostCurrencyTouched(true)}
                          placeholder="AUD"
                          value={createDraft.costCurrency}
                        />
                      </label>
                    </div>

                    <label>
                      <span>Lodging</span>
                      <input
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, lodging: event.target.value }))
                        }
                        placeholder="Airport hotel, Airbnb, campervan..."
                        value={createDraft.lodging}
                      />
                    </label>
                  </div>
                </section>

                <section className="panel journey-create-section journey-create-section-notes">
                  <h3>Notes</h3>
                  <div className="journey-create-fields">
                    <label>
                      <span>Notes / memories</span>
                      <textarea
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="Memories, highlights, why this trip mattered..."
                        value={createDraft.notes}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div className="form-actions">
                <button className="ghost-button" onClick={closeCreateJourneyModal} type="button">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  disabled={createSaving}
                  onClick={() => void handleCreateJourney()}
                  type="button"
                >
                  {createSaving ? "Saving..." : "Save journey"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
