import { createPortal } from "react-dom";
import { AppIcon } from "../components/AppIcon";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  buildJourneyRouteSummaryFromTickets,
  buildJourneySummaryBase,
  buildJourneySummaryCalendar,
  buildJourneySummaryTooltip,
  deriveVisitedDestinationsFromTickets,
  formatLocalDateKey,
  getJourneyMonthsForYear,
  getJourneyRange,
  getJourneyYears,
  sameTicketLocation,
  sortJourneysByStartDate,
  sortTicketsByTripDate,
  type JourneySummaryBase,
  type JourneySummaryCalendar,
} from "../lib/journeySummary";
import {
  createJourney,
  deleteJourney,
  getJourney,
  listJourneyStops,
  listJourneys,
  replaceJourneyStops,
  updateJourney,
} from "../lib/journeyService";
import {
  addJourneyStayDraftFromSuggestion,
  buildJourneyStayDisplay,
  buildJourneyStayDraftFromStop,
  buildJourneyStaySuggestions,
  buildJourneyStopInputsFromDrafts,
  createEmptyJourneyStayDraft,
  getJourneyStayIdentity,
  mergeAutoJourneyStayDrafts,
  insertUnknownJourneyStayDraftAtIndex,
  sortJourneyStayDrafts,
  type JourneyStayDraft,
} from "../lib/journeyStays";
import { normalizeJourneyDisplayText } from "../lib/journeyDisplay";
import { useI18n } from "../lib/i18n";
import type { CreateJourneyInput, Journey, JourneyDateMode, JourneyStop } from "../types/journey";
import type { TicketRecord } from "../types/ticket";

type JourneysSubview = "summary" | "list";
type JourneyYearFilter = "all" | `${number}`;
type JourneyMonthFilter = "all" | `${number}${number}`;

interface JourneysPageProps {
  activeJourneyId?: string;
  onHeaderSummaryChange?: (
    summary: {
      showTotals: boolean;
      journeyCount: number;
      travelDayCount: number;
    } | null,
  ) => void;
  onJourneyDetailChange?: (journeyId: string | null) => void;
  tickets: TicketRecord[];
  onOpenTicket?: (ticketId: string, journeyId: string) => void;
}

interface JourneyCalendarMonth {
  key: string;
  label: string;
  navigationLabel?: string;
  monthLegend: Array<{
    key: string;
    label: string;
    toneClass: string;
  }>;
  days: Array<{
    key: string;
    label: string;
    inRange: boolean;
    isToday: boolean;
    isSpacer: boolean;
    toneClass: string;
  }>;
}

const JOURNEY_MINI_CALENDAR_WEEKS = 5;
const JOURNEY_MINI_CALENDAR_DAYS = JOURNEY_MINI_CALENDAR_WEEKS * 7;

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
  costExchangeRateToCny: string;
  lodging: string;
  notes: string;
  selectedTicketIds: string[];
}

interface DerivedJourneyDatePreview {
  startDate?: string;
  endDate?: string;
}

type JourneyModalMode = "create" | "edit";

interface JourneyStayDepartureEditorState {
  draftId: string;
  pendingDate: string;
  anchorRect: {
    top: number;
    left: number;
    width: number;
  };
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
  costExchangeRateToCny: "",
  lodging: "",
  notes: "",
  selectedTicketIds: [],
};

function formatDisplayDate(value?: string) {
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  if (!parsed) {
    return null;
  }
  if (Number.isNaN(parsed.getTime())) {
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
    return formattedStart === formattedEnd ? formattedStart : `${formattedStart} ~ ${formattedEnd}`;
  }

  return formattedStart ?? formattedEnd ?? "No date yet";
}

function formatJourneyDuration(journey: Journey) {
  const dayCount = getJourneyDurationDays(journey);
  if (!dayCount) {
    return null;
  }

  return `${dayCount} day${dayCount === 1 ? "" : "s"}`;
}

function getJourneyDurationDays(journey: Journey) {
  const range = getJourneyRange(journey);
  if (!range) {
    return 0;
  }

  const milliseconds = range.end.getTime() - range.start.getTime();
  const dayCount = Math.floor(milliseconds / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(dayCount) || dayCount <= 0) {
    return 0;
  }

  return dayCount;
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

function formatJourneyExchangeRate(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatJourneyApproximateCny(journey: Journey) {
  if (
    typeof journey.costAmount !== "number" ||
    !Number.isFinite(journey.costAmount) ||
    typeof journey.costExchangeRateToCny !== "number" ||
    !Number.isFinite(journey.costExchangeRateToCny) ||
    journey.costExchangeRateToCny <= 0
  ) {
    return null;
  }

  return (journey.costAmount * journey.costExchangeRateToCny).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatSummaryNumber(value: number) {
  return value.toLocaleString("en-AU");
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${formatSummaryNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatMonthYearLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });
}

function formatCurrencyAmount(value: number) {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, value: number) {
  return new Date(date.getFullYear(), date.getMonth() + value, 1);
}

function buildMonthRange(rangeStart: Date, rangeEnd: Date) {
  const monthStarts: Date[] = [];
  let cursor = startOfMonth(rangeStart);
  const lastMonthKey = `${rangeEnd.getFullYear()}-${rangeEnd.getMonth()}`;

  while (`${cursor.getFullYear()}-${cursor.getMonth()}` !== lastMonthKey) {
    monthStarts.push(new Date(cursor));
    cursor = addMonths(cursor, 1);
  }

  monthStarts.push(new Date(cursor));
  return monthStarts;
}

function buildMiniCalendarWindow(
  focusStart: Date,
  focusEnd: Date,
  journeyStart: Date,
  journeyEnd: Date,
  navigationLabel?: string,
): JourneyCalendarMonth {
  const todayKey = formatLocalDateKey(new Date());
  const focusMidpoint = new Date(Math.round((focusStart.getTime() + focusEnd.getTime()) / 2));
  const visibleStart = new Date(focusMidpoint);
  visibleStart.setDate(focusMidpoint.getDate() - focusMidpoint.getDay() - 14);
  const visibleEnd = new Date(visibleStart);
  visibleEnd.setDate(visibleStart.getDate() + JOURNEY_MINI_CALENDAR_DAYS - 1);

  while (visibleStart > focusStart) {
    visibleStart.setDate(visibleStart.getDate() - 7);
    visibleEnd.setDate(visibleEnd.getDate() - 7);
  }

  while (visibleEnd < focusEnd) {
    visibleStart.setDate(visibleStart.getDate() + 7);
    visibleEnd.setDate(visibleEnd.getDate() + 7);
  }

  const monthLegendMap = new Map<string, JourneyCalendarMonth["monthLegend"][number]>();
  const days: JourneyCalendarMonth["days"] = [];

  for (let index = 0; index < JOURNEY_MINI_CALENDAR_DAYS; index += 1) {
    const currentDate = new Date(visibleStart);
    currentDate.setDate(visibleStart.getDate() + index);
    const dateKey = formatLocalDateKey(currentDate);
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

    if (!monthLegendMap.has(monthKey)) {
      monthLegendMap.set(monthKey, {
        key: monthKey,
        label: currentDate.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
        toneClass: `tone-${Math.min(monthLegendMap.size, 2)}`,
      });
    }

    days.push({
      key: dateKey,
      label:
        currentDate.getDate() === 1
          ? currentDate.toLocaleDateString("en-AU", { month: "short", day: "numeric" })
          : String(currentDate.getDate()),
      inRange: currentDate >= journeyStart && currentDate <= journeyEnd,
      isToday: dateKey === todayKey,
      isSpacer: false,
      toneClass: monthLegendMap.get(monthKey)?.toneClass ?? "tone-0",
    });
  }

  const monthLegend = [...monthLegendMap.values()];
  const label =
    monthLegend.length === 1
      ? monthLegend[0].label
      : monthLegend.map((month) => month.label).join(" + ");

  return {
    key: `${formatLocalDateKey(visibleStart)}-${formatLocalDateKey(visibleEnd)}`,
    label,
    navigationLabel,
    monthLegend,
    days,
  };
}

function getJourneySummaryMonthColor(monthIndex: number): CSSProperties {
  const variableIndex = monthIndex + 1;
  return {
    "--journey-summary-month-rgb": `var(--journey-month-${variableIndex}-rgb)`,
  } as CSSProperties;
}

function summarizeCompanions(journey: Journey) {
  if (journey.companions.length === 0) {
    return null;
  }

  return journey.companions.map((companion) => companion.name).join(", ");
}

function formatMonthLabel(value: JourneyMonthFilter) {
  if (value === "all") {
    return "All months";
  }

  const date = new Date(`2026-${value}-01T00:00:00`);
  return date.toLocaleDateString("en-AU", { month: "long" });
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

function getLinkedTickets(journey: Journey | null, tickets: TicketRecord[]) {
  if (!journey) {
    return [];
  }

  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return journey.ticketIds
    .map((ticketId) => ticketsById.get(ticketId))
    .filter((ticket): ticket is TicketRecord => Boolean(ticket));
}

function countJourneySegments(linkedTickets: TicketRecord[]) {
  return linkedTickets.reduce((total, ticket) => {
    return total + Math.max(ticket.segmentCount || 0, ticket.segments?.length || 0, 1);
  }, 0);
}

function summarizeJourneyTransport(linkedTickets: TicketRecord[]) {
  const flightCount = linkedTickets.filter((ticket) => ticket.ticketType === "flight").length;
  const railCount = linkedTickets.length - flightCount;
  const parts = [
    flightCount ? `${flightCount} flight${flightCount === 1 ? "" : "s"}` : "",
    railCount ? `${railCount} rail${railCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return parts.join(", ") || "No tickets linked";
}

function formatTicketDateTime(value: string) {
  if (!value) {
    return "--";
  }

  return value.replace("T", " ").slice(0, 16) || value;
}

const FILLED_STAR = String.fromCodePoint(0x2605);
const EMPTY_STAR = String.fromCodePoint(0x2606);

function formatJourneyStarString(rating: number) {
  return `${FILLED_STAR.repeat(rating)}${EMPTY_STAR.repeat(5 - rating)}`;
}

function formatJourneyRating(rating?: number) {
  if (typeof rating !== "number" || rating <= 0) {
    return null;
  }

  return formatJourneyStarString(rating);
}

function buildCalendarMonths(journey: Journey): JourneyCalendarMonth[] {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  if (
    range.start.getFullYear() === range.end.getFullYear() &&
    range.start.getMonth() === range.end.getMonth()
  ) {
    const monthStart = startOfMonth(range.start);
    const monthEnd = endOfMonth(range.start);
    const todayKey = formatLocalDateKey(new Date());
    const leadingSpacerCount = monthStart.getDay();
    const dayCount = monthEnd.getDate();
    const totalCellCount = Math.ceil((leadingSpacerCount + dayCount) / 7) * 7;
    const days: JourneyCalendarMonth["days"] = [];

    for (let index = 0; index < leadingSpacerCount; index += 1) {
      days.push({
        key: `spacer-${index}`,
        label: "",
        inRange: false,
        isToday: false,
        isSpacer: true,
        toneClass: "tone-0",
      });
    }

    for (let day = 1; day <= dayCount; day += 1) {
      const currentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const dateKey = formatLocalDateKey(currentDate);
      days.push({
        key: dateKey,
        label: String(day),
        inRange: currentDate >= range.start && currentDate <= range.end,
        isToday: dateKey === todayKey,
        isSpacer: false,
        toneClass: "tone-0",
      });
    }

    while (days.length < totalCellCount) {
      days.push({
        key: `trailing-spacer-${days.length}`,
        label: "",
        inRange: false,
        isToday: false,
        isSpacer: true,
        toneClass: "tone-0",
      });
    }

    return [
      {
        key: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
        label: monthStart.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
        monthLegend: [
          {
            key: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
            label: monthStart.toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
            toneClass: "tone-0",
          },
        ],
        days,
      },
    ];
  }

  if (getJourneyDurationDays(journey) > 30) {
    return buildMonthRange(range.start, range.end).map((monthStart) => {
      const monthEnd = endOfMonth(monthStart);
      const focusStart = range.start > monthStart ? range.start : monthStart;
      const focusEnd = range.end < monthEnd ? range.end : monthEnd;

      return buildMiniCalendarWindow(
        focusStart,
        focusEnd,
        range.start,
        range.end,
        monthStart.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
      );
    });
  }

  return [buildMiniCalendarWindow(range.start, range.end, range.start, range.end)];
}

function transportIcon(ticketType: TicketRecord["ticketType"]) {
  return ticketType === "flight" ? "F" : "R";
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
    .split("\uFF0C").join(",")
    .split("\u3001").join(",")
    .split(/[,\n]+/u)
    .map((entry: string) => entry.trim())
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

  return preview.startDate === preview.endDate ? formattedStart : `${formattedStart} ~ ${formattedEnd}`;
}

function formatDerivedJourneyDestination(selectedTickets: TicketRecord[], language: "en" | "zh") {
  const destinations = deriveVisitedDestinationsFromTickets(selectedTickets, {
    preferredLanguage: language,
  });

  return destinations.join(" + ");
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

function buildCreateJourneyInput(draft: CreateJourneyDraft, destination: string | undefined): CreateJourneyInput {
  const trimmedCostAmount = draft.costAmount.trim();
  const parsedCostAmount =
    trimmedCostAmount.length > 0 ? Number.parseFloat(trimmedCostAmount) : Number.NaN;
  const normalizedCostCurrency = draft.costCurrency.trim().toUpperCase();
  const trimmedExchangeRate = draft.costExchangeRateToCny.trim();
  const parsedExchangeRate =
    trimmedExchangeRate.length > 0 ? Number.parseFloat(trimmedExchangeRate) : Number.NaN;

  return {
    title: draft.title.trim(),
    destination: destination || draft.destination.trim() || undefined,
    dateMode: draft.dateMode,
    startDate:
      draft.dateMode === "manual" ? draft.manualStartDate.trim() || undefined : undefined,
    endDate: draft.dateMode === "manual" ? draft.manualEndDate.trim() || undefined : undefined,
    notes: draft.notes.trim() || undefined,
    rating: draft.rating ?? undefined,
    mood: draft.mood.trim() || undefined,
    costAmount: Number.isFinite(parsedCostAmount) ? parsedCostAmount : undefined,
    costCurrency: normalizedCostCurrency || undefined,
    costExchangeRateToCny:
      normalizedCostCurrency && normalizedCostCurrency !== "CNY" && Number.isFinite(parsedExchangeRate)
        ? parsedExchangeRate
        : undefined,
    lodging: draft.lodging.trim() || undefined,
    companionNames: parseCompanionNames(draft.companionsText),
    ticketIds: draft.selectedTicketIds,
  };
}

function buildJourneyDraftFromJourney(journey: Journey): CreateJourneyDraft {
  return {
    title: journey.title,
    destination: journey.destination ?? "",
    dateMode: journey.dateMode,
    manualStartDate: journey.startDate ?? "",
    manualEndDate: journey.endDate ?? "",
    companionsText: journey.companions.map((companion) => companion.name).join(", "),
    rating: typeof journey.rating === "number" ? journey.rating : null,
    mood: journey.mood ?? "",
    costAmount: typeof journey.costAmount === "number" ? String(journey.costAmount) : "",
    costCurrency: journey.costCurrency ?? "",
    costExchangeRateToCny:
      typeof journey.costExchangeRateToCny === "number" ? String(journey.costExchangeRateToCny) : "",
    lodging: journey.lodging ?? "",
    notes: journey.notes ?? "",
    selectedTicketIds: [...journey.ticketIds],
  };
}

export function JourneysPage({
  activeJourneyId,
  onHeaderSummaryChange,
  onJourneyDetailChange,
  tickets,
  onOpenTicket,
}: JourneysPageProps) {
  const { language } = useI18n();
  const currentSummaryYear = String(new Date().getFullYear());
  const [subview, setSubview] = useState<JourneysSubview>("summary");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(false);
  const [journeysLoaded, setJourneysLoaded] = useState(false);
  const [journeysError, setJourneysError] = useState("");
  const [selectedJourneyId, setSelectedJourneyId] = useState("");
  const [journeyDetail, setJourneyDetail] = useState<Journey | null>(null);
  const [journeyDetailLoading, setJourneyDetailLoading] = useState(false);
  const [journeyDetailError, setJourneyDetailError] = useState("");
  const [yearFilter, setYearFilter] = useState<JourneyYearFilter>("all");
  const [monthFilter, setMonthFilter] = useState<JourneyMonthFilter>("all");
  const [summaryYear, setSummaryYear] = useState(currentSummaryYear);
  const [summaryStopsByJourneyId, setSummaryStopsByJourneyId] = useState<Record<string, JourneyStop[]>>({});
  const [journeyModalMode, setJourneyModalMode] = useState<JourneyModalMode | null>(null);
  const [journeyDraft, setJourneyDraft] = useState<CreateJourneyDraft>(EMPTY_CREATE_JOURNEY_DRAFT);
  const [journeyTicketSearch, setJourneyTicketSearch] = useState("");
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyError, setJourneyError] = useState("");
  const [journeyTitleError, setJourneyTitleError] = useState("");
  const [journeyExchangeRateError, setJourneyExchangeRateError] = useState("");
  const [journeyCostCurrencyTouched, setJourneyCostCurrencyTouched] = useState(false);
  const [journeyStayDrafts, setJourneyStayDrafts] = useState<JourneyStayDraft[]>([]);
  const [journeyStayDismissedIdentities, setJourneyStayDismissedIdentities] = useState<string[]>([]);
  const [journeyStopsLoading, setJourneyStopsLoading] = useState(false);
  const [journeyStayDraftsHydrated, setJourneyStayDraftsHydrated] = useState(false);
  const [journeyStayHasPersistedRows, setJourneyStayHasPersistedRows] = useState(false);
  const [journeyDetailStops, setJourneyDetailStops] = useState<JourneyStop[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [detailCalendarIndex, setDetailCalendarIndex] = useState(0);
  const [journeyStayDepartureEditor, setJourneyStayDepartureEditor] = useState<JourneyStayDepartureEditorState | null>(null);
  const [draggedUnknownStayId, setDraggedUnknownStayId] = useState<string | null>(null);
  const [journeyStayDropIndex, setJourneyStayDropIndex] = useState<number | null>(null);
  const journeyStayPointerDragRef = useRef<{
    draftId: string;
    pointerId: number;
  } | null>(null);

  const availableTickets = useMemo(() => {
    return [...tickets].sort((left, right) => {
      const leftDate = left.departureTimeLocal || left.arrivalTimeLocal || "";
      const rightDate = right.departureTimeLocal || right.arrivalTimeLocal || "";
      return rightDate.localeCompare(leftDate) || right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [tickets]);

  const filteredSelectableTickets = useMemo(() => {
    const normalizedQuery = journeyTicketSearch.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableTickets;
    }

    return availableTickets.filter((ticket) => buildTicketSearchText(ticket).includes(normalizedQuery));
  }, [availableTickets, journeyTicketSearch]);

  const selectedTickets = useMemo(() => {
    const selectedIds = new Set(journeyDraft.selectedTicketIds);
    return availableTickets.filter((ticket) => selectedIds.has(ticket.id));
  }, [availableTickets, journeyDraft.selectedTicketIds]);

  const journeyStaySuggestions = useMemo(
    () => buildJourneyStaySuggestions(selectedTickets, { preferredLanguage: language }),
    [language, selectedTickets],
  );

  const sortedJourneyStayDraftRows = useMemo(
    () => sortJourneyStayDrafts(journeyStayDrafts),
    [journeyStayDrafts],
  );

  const journeyDraftDestinationPreview = useMemo(() => {
    const staySummary = buildJourneyStayDisplay(sortedJourneyStayDraftRows);
    return staySummary || normalizeJourneyDisplayText(formatDerivedJourneyDestination(selectedTickets, language)) || normalizeJourneyDisplayText(journeyDraft.destination);
  }, [journeyDraft.destination, language, selectedTickets, sortedJourneyStayDraftRows]);

  const selectedJourneyStayIdentities = useMemo(
    () => new Set(journeyStayDrafts.map((row) => getJourneyStayIdentity(row)).filter(Boolean)),
    [journeyStayDrafts],
  );
  const detailLinkedTickets = useMemo(
    () => sortTicketsByTripDate(getLinkedTickets(journeyDetail, tickets)),
    [journeyDetail, tickets],
  );

  const detailCalendarMonths = useMemo(
    () => (journeyDetail ? buildCalendarMonths(journeyDetail) : []),
    [journeyDetail],
  );
  const activeDetailCalendarMonth = detailCalendarMonths[Math.min(detailCalendarIndex, Math.max(detailCalendarMonths.length - 1, 0))] ?? null;

  const detailDestinationDisplay = useMemo(() => {
    const staySummary = buildJourneyStayDisplay(journeyDetailStops, 4);
    if (staySummary) {
      return staySummary;
    }

    const derivedDestination = normalizeJourneyDisplayText(formatDerivedJourneyDestination(detailLinkedTickets, language));
    return normalizeJourneyDisplayText(journeyDetail?.destination) || derivedDestination || journeyDetail?.title || "Journey detail";
  }, [detailLinkedTickets, journeyDetail?.destination, journeyDetail?.title, journeyDetailStops, language]);

  const autoDatePreview = useMemo(() => deriveJourneyDatePreview(selectedTickets), [selectedTickets]);
  const normalizedJourneyCostCurrency = journeyDraft.costCurrency.trim().toUpperCase();
  const showJourneyExchangeRateField =
    normalizedJourneyCostCurrency.length > 0 && normalizedJourneyCostCurrency !== "CNY";
  const defaultJourneyStayDate =
    journeyDraft.manualEndDate
    || journeyDraft.manualStartDate
    || autoDatePreview.endDate
    || autoDatePreview.startDate
    || formatLocalDateKey(new Date());

  const summaryBase = useMemo<JourneySummaryBase>(
    () => buildJourneySummaryBase(journeys, tickets, currentSummaryYear, {
      preferredLanguage: language,
      stopsByJourneyId: summaryStopsByJourneyId,
    }),
    [currentSummaryYear, journeys, language, summaryStopsByJourneyId, tickets],
  );

  const summaryCalendar = useMemo<JourneySummaryCalendar>(
    () => buildJourneySummaryCalendar(summaryBase, summaryYear),
    [summaryBase, summaryYear],
  );

  const loadStoredJourneys = async () => {
    setJourneysLoading(true);
    setJourneysError("");

    try {
      const storedJourneys = await listJourneys();
      setJourneys(sortJourneysByStartDate(storedJourneys));
      setJourneysLoaded(true);
      return true;
    } catch (error) {
      setJourneysError(error instanceof Error ? error.message : "Failed to load journeys.");
      return false;
    } finally {
      setJourneysLoading(false);
    }
  };

  const openJourneyDetail = async (journeyId: string, fallbackToListOnError = false) => {
    setSelectedJourneyId(journeyId);
    setJourneyDetail(null);
    setJourneyDetailStops([]);
    setJourneyDetailError("");
    setJourneyDetailLoading(true);
    onJourneyDetailChange?.(journeyId);

    try {
      const storedJourney = await getJourney(journeyId);
      setJourneyDetail(storedJourney);

      try {
        const storedStops = await listJourneyStops(journeyId);
        setJourneyDetailStops(storedStops);
      } catch {
        setJourneyDetailStops([]);
      }
    } catch (error) {
      if (fallbackToListOnError) {
        setSelectedJourneyId("");
        setJourneyDetail(null);
        setJourneyDetailStops([]);
        setJourneyDetailError("");
        setSubview("list");
        onJourneyDetailChange?.(null);
      } else {
        setJourneyDetailError(error instanceof Error ? error.message : "Failed to load journey detail.");
      }
    } finally {
      setJourneyDetailLoading(false);
    }
  };

  const closeJourneyDetail = () => {
    setSelectedJourneyId("");
    setJourneyDetail(null);
    setJourneyDetailStops([]);
    setJourneyDetailError("");
    setJourneyDetailLoading(false);
    resetJourneyModalState();
    setIsDeleteDialogOpen(false);
    setDeleteError("");
    setDeletePending(false);
    onJourneyDetailChange?.(null);
  };

  useEffect(() => {
    if (journeysLoaded || journeysLoading) {
      return;
    }

    void loadStoredJourneys();
  }, [journeysLoaded, journeysLoading]);

  useEffect(() => {
    let cancelled = false;

    if (journeys.length === 0) {
      setSummaryStopsByJourneyId({});
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      journeys.map(async (journey) => {
        try {
          return [journey.id, await listJourneyStops(journey.id)] as const;
        } catch {
          return [journey.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setSummaryStopsByJourneyId(Object.fromEntries(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [journeys]);

  useEffect(() => {
    if (activeJourneyId && activeJourneyId !== selectedJourneyId) {
      setSubview("list");
      void openJourneyDetail(activeJourneyId, true);
    }
  }, [activeJourneyId, selectedJourneyId]);

  useEffect(() => {
    setDetailCalendarIndex(0);
  }, [journeyDetail?.id]);

  useEffect(() => {
    if (detailCalendarIndex > 0 && detailCalendarIndex >= detailCalendarMonths.length) {
      setDetailCalendarIndex(Math.max(detailCalendarMonths.length - 1, 0));
    }
  }, [detailCalendarIndex, detailCalendarMonths.length]);

  useEffect(() => {
    if (journeyModalMode !== "edit" || !selectedJourneyId) {
      return;
    }

    let cancelled = false;
    setJourneyStopsLoading(true);
    setJourneyError("");

    void listJourneyStops(selectedJourneyId)
      .then((storedStops) => {
        if (cancelled) {
          return;
        }

        setJourneyStayDrafts(storedStops.map((stop) => buildJourneyStayDraftFromStop(stop)));
        setJourneyStayHasPersistedRows(storedStops.length > 0);
        setJourneyStayDraftsHydrated(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setJourneyStayDrafts([]);
        setJourneyStayHasPersistedRows(false);
        setJourneyStayDraftsHydrated(true);
        setJourneyError(error instanceof Error ? error.message : "Failed to load journey stays.");
      })
      .finally(() => {
        if (!cancelled) {
          setJourneyStopsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [journeyModalMode, selectedJourneyId]);

  useEffect(() => {
    if (!journeyModalMode || !journeyStayDraftsHydrated) {
      return;
    }

    if (journeyModalMode === "edit" && journeyStayHasPersistedRows) {
      return;
    }

    setJourneyStayDrafts((current) =>
      mergeAutoJourneyStayDrafts(current, journeyStaySuggestions, journeyStayDismissedIdentities),
    );
  }, [
    journeyModalMode,
    journeyStayDismissedIdentities,
    journeyStayDraftsHydrated,
    journeyStayHasPersistedRows,
    journeyStaySuggestions,
  ]);

  useEffect(() => {
    if (!journeyStayDepartureEditor) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const activeEditor = event.target.closest(
        `[data-journey-stay-departure-editor="${journeyStayDepartureEditor.draftId}"]`,
      );
      if (activeEditor) {
        return;
      }

      setJourneyStayDepartureEditor(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setJourneyStayDepartureEditor(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [journeyStayDepartureEditor]);

  useEffect(() => {
    if (!draggedUnknownStayId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const activeDrag = journeyStayPointerDragRef.current;
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
        return;
      }

      const staysBody = document.querySelector<HTMLElement>("[data-journey-stays-body=\"true\"]");
      const stayRows = [...document.querySelectorAll<HTMLElement>("[data-journey-stay-row-id]")];
      if (!staysBody || stayRows.length === 0) {
        setJourneyStayDropIndex(null);
        return;
      }

      const bodyRect = staysBody.getBoundingClientRect();
      if (
        event.clientX < bodyRect.left
        || event.clientX > bodyRect.right
        || event.clientY < bodyRect.top
        || event.clientY > bodyRect.bottom
      ) {
        setJourneyStayDropIndex(null);
        return;
      }

      let nextDropIndex = stayRows.length;
      for (let index = 0; index < stayRows.length; index += 1) {
        const row = stayRows[index];
        const rect = row.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          nextDropIndex = index;
          break;
        }
      }

      setJourneyStayDropIndex((current) => (current === nextDropIndex ? current : nextDropIndex));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const activeDrag = journeyStayPointerDragRef.current;
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
        return;
      }

      if (journeyStayDropIndex !== null) {
        setJourneyStayDrafts((current) =>
          insertUnknownJourneyStayDraftAtIndex(current, activeDrag.draftId, journeyStayDropIndex),
        );
      }

      clearJourneyStayDragState();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [draggedUnknownStayId, journeyStayDropIndex]);


  useEffect(() => {
    if (journeyCostCurrencyTouched || journeyDraft.costCurrency.trim()) {
      return;
    }

    const suggestedCurrency = deriveJourneyCurrencySuggestion(selectedTickets);
    if (!suggestedCurrency) {
      return;
    }

    setJourneyDraft((current) => {
      if (current.costCurrency.trim()) {
        return current;
      }

      return {
        ...current,
        costCurrency: suggestedCurrency,
      };
    });
  }, [journeyCostCurrencyTouched, journeyDraft.costCurrency, selectedTickets]);

  useEffect(() => {
    if (showJourneyExchangeRateField) {
      return;
    }

    setJourneyDraft((current) => {
      if (!current.costExchangeRateToCny) {
        return current;
      }

      return {
        ...current,
        costExchangeRateToCny: "",
      };
    });
    setJourneyExchangeRateError("");
  }, [showJourneyExchangeRateField]);

  useEffect(() => {
    if (summaryBase.availableYears.includes(summaryYear)) {
      return;
    }

    setSummaryYear(summaryBase.availableYears[0] ?? currentSummaryYear);
  }, [currentSummaryYear, summaryBase.availableYears, summaryYear]);

  useEffect(() => {
    onHeaderSummaryChange?.(null);

    return () => {
      onHeaderSummaryChange?.(null);
    };
  }, [onHeaderSummaryChange]);

  const handleRetryJourneys = async () => {
    setJourneysLoaded(false);
    await loadStoredJourneys();
  };

  const openDeleteDialog = () => {
    setDeleteError("");
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deletePending) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeleteError("");
  };

  const handleConfirmDeleteJourney = async () => {
    if (!selectedJourneyId) {
      return;
    }

    const deletingJourneyId = selectedJourneyId;
    setDeletePending(true);
    setDeleteError("");

    try {
      await deleteJourney(deletingJourneyId);
      setJourneys((current) => current.filter((journey) => journey.id !== deletingJourneyId));
      setSubview("list");
      closeJourneyDetail();
      await loadStoredJourneys();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete journey.");
    } finally {
      setDeletePending(false);
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

  const openCreateJourneyModal = () => {
    setJourneyModalMode("create");
    setJourneyDraft(EMPTY_CREATE_JOURNEY_DRAFT);
    setJourneyTicketSearch("");
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");
    setJourneyCostCurrencyTouched(false);
    setJourneyStayDrafts([]);
    setJourneyStayDismissedIdentities([]);
    setJourneyStopsLoading(false);
    setJourneyStayDraftsHydrated(true);
    setJourneyStayHasPersistedRows(false);
    setJourneyStayDepartureEditor(null);
    setDraggedUnknownStayId(null);
    setJourneyStayDropIndex(null);
  };

  const openEditJourneyModal = (journey: Journey) => {
    setJourneyModalMode("edit");
    setJourneyDraft(buildJourneyDraftFromJourney(journey));
    setJourneyTicketSearch("");
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");
    setJourneyCostCurrencyTouched(false);
    setJourneyStayDrafts([]);
    setJourneyStayDismissedIdentities([]);
    setJourneyStopsLoading(true);
    setJourneyStayDraftsHydrated(false);
    setJourneyStayHasPersistedRows(false);
    setJourneyStayDepartureEditor(null);
    setDraggedUnknownStayId(null);
    setJourneyStayDropIndex(null);
  };

  const resetJourneyModalState = () => {
    setJourneyModalMode(null);
    setJourneyDraft(EMPTY_CREATE_JOURNEY_DRAFT);
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");
    setJourneyTicketSearch("");
    setJourneyCostCurrencyTouched(false);
    setJourneyStayDrafts([]);
    setJourneyStayDismissedIdentities([]);
    setJourneyStopsLoading(false);
    setJourneyStayDraftsHydrated(false);
    setJourneyStayHasPersistedRows(false);
    setJourneyStayDepartureEditor(null);
    setDraggedUnknownStayId(null);
    setJourneyStayDropIndex(null);
  };

  const closeJourneyModal = () => {
    if (journeySaving) {
      return;
    }

    resetJourneyModalState();
  };

  const toggleSelectedTicket = (ticketId: string) => {
    setJourneyDraft((current) => {
      const nextSelectedTicketIds = current.selectedTicketIds.includes(ticketId)
        ? current.selectedTicketIds.filter((value) => value !== ticketId)
        : [...current.selectedTicketIds, ticketId];

      return {
        ...current,
        selectedTicketIds: nextSelectedTicketIds,
      };
    });
  };

  const addManualJourneyStay = () => {
    setJourneyStayDrafts((current) => sortJourneyStayDrafts([...current, createEmptyJourneyStayDraft(current)]));
  };

  const updateJourneyStayDraft = (
    draftId: string,
    updater: (row: JourneyStayDraft) => JourneyStayDraft,
  ) => {
    setJourneyStayDrafts((current) =>
      sortJourneyStayDrafts(current.map((row) => (row.draftId === draftId ? updater(row) : row))),
    );
  };

  const addJourneyStaySuggestion = (identity: string) => {
    const suggestion = journeyStaySuggestions.find((item) => item.identity === identity);
    if (!suggestion) {
      return;
    }

    setJourneyStayDismissedIdentities((current) => current.filter((value) => value !== identity));
    setJourneyStayDrafts((current) => addJourneyStayDraftFromSuggestion(current, suggestion));
  };

  const removeJourneyStayDraft = (draftId: string) => {
    setJourneyStayDrafts((current) => {
      const row = current.find((item) => item.draftId === draftId);
      if (!row) {
        return current;
      }

      const identity = getJourneyStayIdentity(row);
      if (identity && row.source === "auto" && !row.userEdited) {
        setJourneyStayDismissedIdentities((existing) =>
          existing.includes(identity) ? existing : [...existing, identity],
        );
      }

      return sortJourneyStayDrafts(current.filter((item) => item.draftId !== draftId));
    });

    setJourneyStayDepartureEditor((current) => (current?.draftId === draftId ? null : current));
    setDraggedUnknownStayId((current) => (current === draftId ? null : current));
    setJourneyStayDropIndex(null);
  };

  const openJourneyStayDepartureEditor = (
    stay: JourneyStayDraft,
    triggerElement: HTMLButtonElement,
  ) => {
    const departureDate = stay.departureDateTime?.slice(0, 10) ?? defaultJourneyStayDate;
    const triggerRect = triggerElement.getBoundingClientRect();
    setJourneyStayDepartureEditor({
      draftId: stay.draftId,
      pendingDate: departureDate,
      anchorRect: {
        top: triggerRect.bottom + 8,
        left: triggerRect.left,
        width: triggerRect.width,
      },
    });
  };

  const updateJourneyStayDeparturePickerDate = (value: string) => {
    setJourneyStayDepartureEditor((current) =>
      current ? { ...current, pendingDate: value || defaultJourneyStayDate } : current,
    );
  };

  const applyJourneyStayDepartureDate = (draftId: string, dateValue: string) => {
    const nextDate = dateValue || defaultJourneyStayDate;
    updateJourneyStayDraft(draftId, (current) => ({
      ...current,
      departureDateTime: `${nextDate}T00:00:00`,
      source: "manual",
      userEdited: true,
    }));
    setJourneyStayDepartureEditor(null);
  };

  const forgetJourneyStayDepartureDate = (draftId: string) => {
    updateJourneyStayDraft(draftId, (current) => ({
      ...current,
      departureDateTime: undefined,
      source: "manual",
      userEdited: true,
    }));
    setJourneyStayDepartureEditor(null);
  };

  const clearJourneyStayDragState = () => {
    journeyStayPointerDragRef.current = null;
    setDraggedUnknownStayId(null);
    setJourneyStayDropIndex(null);
  };

  const handleJourneyStayDragStart = (
    draftId: string,
    isUnknown: boolean,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!isUnknown) {
      return;
    }

    event.preventDefault();
    journeyStayPointerDragRef.current = {
      draftId,
      pointerId: event.pointerId,
    };
    setDraggedUnknownStayId(draftId);
    setJourneyStayDropIndex(null);
  };

  const handleSaveJourney = async () => {
    const trimmedTitle = journeyDraft.title.trim();
    if (!trimmedTitle) {
      setJourneyTitleError("Title is required.");
      setJourneyError("");
      return;
    }

    if (showJourneyExchangeRateField) {
      const trimmedExchangeRate = journeyDraft.costExchangeRateToCny.trim();
      if (trimmedExchangeRate.length > 0) {
        const parsedExchangeRate = Number.parseFloat(trimmedExchangeRate);
        if (!Number.isFinite(parsedExchangeRate) || parsedExchangeRate <= 0) {
          setJourneyExchangeRateError("Exchange rate to CNY must be a positive number.");
          setJourneyError("");
          return;
        }
      }
    }

    const stayInputs = buildJourneyStopInputsFromDrafts(journeyStayDrafts);
    const nextDestination =
      buildJourneyStayDisplay(stayInputs)
      || normalizeJourneyDisplayText(formatDerivedJourneyDestination(selectedTickets, language))
      || normalizeJourneyDisplayText(journeyDraft.destination)
      || undefined;

    setJourneySaving(true);
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");

    try {
      if (journeyModalMode === "edit") {
        if (!selectedJourneyId) {
          throw new Error("Journey detail is not available to edit.");
        }

        const updatedJourney = await updateJourney(
          selectedJourneyId,
          buildCreateJourneyInput(journeyDraft, nextDestination),
        );
        const savedStops = await replaceJourneyStops(selectedJourneyId, stayInputs);
        setJourneyDetail(updatedJourney);
        setJourneyDetailStops(savedStops);
        const listReloaded = await loadStoredJourneys();
        if (!listReloaded) {
          throw new Error("Journey was updated, but the Journey List could not be refreshed.");
        }
        const refreshedJourney = await getJourney(updatedJourney.id);
        setJourneyDetail(refreshedJourney);
        setJourneyDetailError("");
        resetJourneyModalState();
      } else {
        const createdJourney = await createJourney(buildCreateJourneyInput(journeyDraft, nextDestination));
        await replaceJourneyStops(createdJourney.id, stayInputs);
        setYearFilter("all");
        setMonthFilter("all");
        setSubview("list");
        const listReloaded = await loadStoredJourneys();
        if (!listReloaded) {
          throw new Error("Journey was created, but the Journey List could not be refreshed.");
        }
        resetJourneyModalState();
      }
    } catch (error) {
      setJourneyError(
        error instanceof Error
          ? error.message
          : journeyModalMode === "edit"
            ? "Failed to update journey."
            : "Failed to create journey.",
      );
    } finally {
      setJourneySaving(false);
    }
  };

  const summaryView = (
    <section className="section-stack journey-summary-view">
      <div className="journey-summary-strip" aria-label="All-time summary totals">
        <span className="journey-summary-strip-label">ALL-TIME SUMMARY</span>
        <div className="journey-summary-strip-metrics">
          <span>{formatCountLabel(journeys.length, "journey")}</span>
          <span>{formatCountLabel(summaryBase.allTravelDays, "travel day")}</span>
          <span>
            {summaryBase.comparableCostCnyTotal !== null
              ? `${summaryBase.missingExchangeRateCount > 0 ? "Comparable cost" : "Total cost"} ~= CNY ${formatCurrencyAmount(summaryBase.comparableCostCnyTotal)}`
              : "Comparable cost unavailable"}
          </span>
        </div>
      </div>

      {journeysLoading ? (
        <div className="panel journey-summary-empty-panel">
          <h3>Loading journey statistics...</h3>
          <p className="hero-copy">Stored journeys are being loaded for the Summary dashboard.</p>
        </div>
      ) : journeysError ? (
        <div className="panel journey-summary-empty-panel">
          <h3>Journey statistics could not be loaded</h3>
          <p className="hero-copy">{journeysError}</p>
        </div>
      ) : journeys.length === 0 ? (
        <div className="panel journey-summary-empty-panel">
          <h3>No journey statistics yet</h3>
          <p className="hero-copy">Create journeys from the List tab to unlock travel summaries.</p>
        </div>
      ) : (
        <>
          <div className="panel journey-summary-calendar-card">
            <div className="journey-summary-calendar-header">
              <div className="journey-summary-calendar-title-group">
                <h3>Travel calendar</h3>
                <div className="journey-summary-calendar-meta">
                  <span>
                    {`${formatCountLabel(summaryCalendar.selectedYearJourneys, "journey")} - ${formatCountLabel(summaryCalendar.selectedYearTravelDays, "travel day")} in ${summaryYear}`}
                  </span>
                </div>
              </div>
              <div className="journey-summary-calendar-controls">
                <label className="journeys-inline-filter journey-summary-year-filter">
                  <span>Year</span>
                  <select value={summaryYear} onChange={(event) => setSummaryYear(event.target.value)}>
                    {summaryBase.availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="journey-summary-calendar-shell">
              <div
                className="journey-summary-month-row"
                aria-hidden="true"
                style={{ "--journey-summary-week-count": String(summaryCalendar.weeks.length) } as CSSProperties}
              >
                {summaryCalendar.weeks.map((week) => (
                  <span key={`${week.key}-month`}>{week.monthLabel}</span>
                ))}
              </div>
              <div className="journey-summary-calendar-grid">
                <div className="journey-summary-weekday-column" aria-hidden="true">
                  <span>Mon</span>
                  <span />
                  <span>Wed</span>
                  <span />
                  <span>Fri</span>
                  <span />
                  <span>Sun</span>
                </div>
                <div
                  className="journey-summary-week-columns"
                  role="img"
                  aria-label={`Travel calendar for ${summaryYear}`}
                  style={{ "--journey-summary-week-count": String(summaryCalendar.weeks.length) } as CSSProperties}
                >
                  {summaryCalendar.weeks.map((week) => (
                    <div key={week.key} className="journey-summary-week-column">
                      {week.days.map((day) => {
                        const tooltip = day.dateKey ? buildJourneySummaryTooltip(day.dateKey, day.entries) : undefined;
                        const isTravel = day.entries.length > 0;
                        return (
                          <button
                            key={day.key}
                            type="button"
                            className={[
                              "journey-summary-day",
                              day.isCurrentYear ? "" : "is-outside-year",
                              isTravel ? "is-travel" : "",
                              day.overlapCount > 1 ? "is-overlap" : "",
                              day.isToday ? "is-today" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={day.monthIndex === null ? undefined : getJourneySummaryMonthColor(day.monthIndex)}
                            title={tooltip}
                            aria-label={tooltip}
                            tabIndex={isTravel ? 0 : -1}
                          >
                            <span className="sr-only">{day.dayNumber}</span>
                            {day.overlapCount > 1 ? <span className="journey-summary-day-marker" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="journey-summary-modules">
            <div className="panel journey-summary-panel">
              <h3>Travel highlights</h3>
              <div className="journey-summary-highlight-grid">
                <div className="journey-summary-highlight-item">
                  <span className="ticket-kind">Longest journey</span>
                  <div className="journey-summary-highlight-row">
                    <strong>
                      {summaryBase.longestJourney
                        ? `${summaryBase.longestJourney.title} / ${formatCountLabel(summaryBase.longestJourney.durationDays, "day")}`
                        : "No dated journeys yet"}
                    </strong>
                    {summaryBase.longestJourney ? (
                      <span className="journey-summary-item-note">{summaryBase.longestJourney.rangeLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div className="journey-summary-highlight-item">
                  <span className="ticket-kind">Busiest month</span>
                  <div className="journey-summary-highlight-row">
                    <strong>
                      {summaryBase.busiestMonth
                        ? `${formatMonthYearLabel(summaryBase.busiestMonth.monthKey)} / ${formatCountLabel(summaryBase.busiestMonth.dedupedTravelDays, "travel day")}`
                        : "No travel month yet"}
                    </strong>
                  </div>
                </div>
                <div className="journey-summary-highlight-item">
                  <span className="ticket-kind">Highest recorded cost</span>
                  <div className="journey-summary-highlight-row">
                    <strong>
                      {summaryBase.highestCostJourney
                        ? `${summaryBase.highestCostJourney.title} / ${summaryBase.highestCostJourney.amountLabel}`
                        : "No comparable cost yet"}
                    </strong>
                    {summaryBase.highestCostJourney ? (
                      <span className="journey-summary-item-note">~= CNY {summaryBase.highestCostJourney.convertedLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div className="journey-summary-highlight-item">
                  <span className="ticket-kind">Most visited destination</span>
                  <div className="journey-summary-highlight-row">
                    <strong>
                      {summaryBase.topDestinations[0]
                        ? `${summaryBase.topDestinations[0].label} / ${formatCountLabel(summaryBase.topDestinations[0].journeyCount, "journey")}`
                        : "No destination data yet"}
                    </strong>
                    {summaryBase.topDestinations[0] ? (
                      <span className="journey-summary-item-note">{formatCountLabel(summaryBase.topDestinations[0].dedupedTravelDays, "day")}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              {summaryBase.missingExchangeRateCount > 0 ? (
                <p className="journey-summary-warning">
                  {formatCountLabel(summaryBase.missingExchangeRateCount, "non-CNY journey", "non-CNY journeys")} without
                  exchange rates {summaryBase.missingExchangeRateCount === 1 ? "is" : "are"} excluded from cost comparison.
                </p>
              ) : null}
            </div>

            <div className="panel journey-summary-panel">
              <h3>Top destinations</h3>
              {summaryBase.topDestinations.length > 0 || summaryBase.unresolvedStays.length > 0 ? (
                <div className="journey-summary-list">
                  {summaryBase.topDestinations.length > 0 ? (
                    <>
                      {summaryBase.topDestinations.slice(0, 5).map((destination) => (
                        <div key={destination.label} className="journey-summary-list-row">
                          <div>
                            <strong>{destination.label}</strong>
                            <div className="journey-summary-list-meta">
                              {formatCountLabel(destination.journeyCount, "journey")}
                            </div>
                          </div>
                          <span className="journey-summary-list-value">
                            {formatCountLabel(destination.dedupedTravelDays, "day")}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {summaryBase.unresolvedStays.length > 0 ? (
                    <p className="journey-summary-item-note">
                      Unresolved stays total {formatCountLabel(
                        summaryBase.unresolvedStays.reduce(
                          (total, destination) => total + destination.dedupedTravelDays,
                          0,
                        ),
                        "day",
                      )} not included.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="hero-copy">No destination data recorded yet.</p>
              )}
            </div>

            <div className="panel journey-summary-panel">
              <h3>Top companions</h3>
              {summaryBase.topCompanionGroups.length > 0 ? (
                <div className="journey-summary-podium">
                  {summaryBase.topCompanionGroups[0] ? (
                    <div className="journey-summary-podium-first">
                      <span className="ticket-kind">1st</span>
                      <strong>{summaryBase.topCompanionGroups[0].labels.join(" / ")}</strong>
                      <span className="journey-summary-item-note">
                        {formatCountLabel(summaryBase.topCompanionGroups[0].journeyCount, "journey")}
                      </span>
                    </div>
                  ) : null}
                  <div className="journey-summary-podium-next">
                    {summaryBase.topCompanionGroups.slice(1, 3).map((group, index) => (
                      <div key={`group-${group.journeyCount}`} className="journey-summary-podium-card">
                        <span className="ticket-kind">{index === 0 ? "2nd" : "3rd"}</span>
                        <strong>{group.labels.join(" / ")}</strong>
                        <span className="journey-summary-item-note">
                          {formatCountLabel(group.journeyCount, "journey")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="journey-summary-podium-rest">
                    {summaryBase.topCompanionGroups.slice(3, 5).map((group, index) => (
                      <div key={`rest-group-${group.journeyCount}`} className="journey-summary-podium-rest-row">
                        <span className="journey-summary-podium-rank">{index === 0 ? "4th" : "5th"}</span>
                        <strong>{group.labels.join(" / ")}</strong>
                        <span className="journey-summary-item-note">
                          {formatCountLabel(group.journeyCount, "journey")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="hero-copy">No companions recorded yet.</p>
              )}
            </div>

            <div className="panel journey-summary-panel">
              <h3>Cost by currency</h3>
              {summaryBase.costByCurrency.length > 0 ? (
                <div className="journey-summary-list">
                  {summaryBase.costByCurrency.map((item) => (
                    <div key={item.currency} className="journey-summary-list-row">
                      <div>
                        <strong>{item.currency}</strong>
                        <div className="journey-summary-list-meta">
                          {formatCountLabel(item.journeyCount, "journey")}
                        </div>
                      </div>
                      <span className="journey-summary-list-value">
                        {item.currency} {formatCurrencyAmount(item.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hero-copy">No journey costs recorded yet.</p>
              )}
              <p className="journey-summary-item-note">
                {formatCountLabel(summaryBase.journeysWithoutCost, "journey")} without recorded cost.
              </p>
            </div>
          </div>
        </>
      )}
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
              <button
                className="journey-list-card journey-list-card-button"
                key={journey.id}
                onClick={() => void openJourneyDetail(journey.id)}
                type="button"
              >
                <div className="journey-list-card-top">
                  <strong>{journey.title}</strong>
                  <span className="journey-list-card-date">{formatJourneyDateRange(journey)}</span>
                </div>

                <div className="ticket-row-submeta">
                  <span>{normalizeJourneyDisplayText(journey.destination) || "No destination yet"}</span>
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
                      {formatJourneyStarString(journey.rating)}
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
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  const journeyModal = journeyModalMode ? (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-labelledby="create-journey-title"
        aria-modal="true"
        className="modal-shell tickets-modal journey-create-modal"
        role="dialog"
      >
        <div className="tickets-modal-header">
          <div>
            <h3 id="create-journey-title">
              {journeyModalMode === "edit" ? "Edit journey" : "Create journey"}
            </h3>
          </div>
          <button
            aria-label={journeyModalMode === "edit" ? "Close edit journey modal" : "Close create journey modal"}
            className="modal-close-button"
            disabled={journeySaving}
            onClick={closeJourneyModal}
            type="button"
          >
            <AppIcon className="modal-close-icon" name="close" size={20} />
          </button>
        </div>

        <div className="tickets-modal-body">
          {journeyError ? (
            <div className="journey-create-feedback journey-create-feedback-error" role="alert">
              {journeyError}
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
                      if (!journeyDraft.title.trim()) {
                        setJourneyTitleError("Title is required.");
                      }
                    }}
                    onChange={(event) => {
                      setJourneyDraft((current) => ({ ...current, title: event.target.value }));
                      if (journeyTitleError) {
                        setJourneyTitleError("");
                      }
                    }}
                    placeholder="Japan spring trip"
                    value={journeyDraft.title}
                  />
                  {journeyTitleError ? (
                    <span className="journey-create-field-error">{journeyTitleError}</span>
                  ) : null}
                </label>

                <div className="journey-create-derived-card">
                  <span>Destination preview</span>
                  <strong>{journeyDraftDestinationPreview || "No stays yet"}</strong>
                </div>

                <label>
                  <span>Date mode</span>
                  <select
                    onChange={(event) =>
                      setJourneyDraft((current) => ({
                        ...current,
                        dateMode: event.target.value as JourneyDateMode,
                      }))
                    }
                    value={journeyDraft.dateMode}
                  >
                    <option value="auto">Auto from selected tickets</option>
                    <option value="manual">Manual date range</option>
                  </select>
                </label>

                {journeyDraft.dateMode === "auto" ? (
                  <div className="journey-create-derived-card">
                    <span>Derived trip dates</span>
                    <strong>{formatPreviewDateRange(autoDatePreview)}</strong>
                  </div>
                ) : null}

                <div className="journey-create-inline-grid">
                  <label>
                    <span>Manual start date</span>
                    <input
                      disabled={journeyDraft.dateMode !== "manual"}
                      onChange={(event) =>
                        setJourneyDraft((current) => ({
                          ...current,
                          manualStartDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={journeyDraft.manualStartDate}
                    />
                  </label>

                  <label>
                    <span>Manual end date</span>
                    <input
                      disabled={journeyDraft.dateMode !== "manual"}
                      onChange={(event) =>
                        setJourneyDraft((current) => ({
                          ...current,
                          manualEndDate: event.target.value,
                        }))
                      }
                      type="date"
                      value={journeyDraft.manualEndDate}
                    />
                  </label>
                </div>
              </div>
            </section>


            <section className="panel journey-create-section journey-create-section-stays">
              <div className="journey-create-section-top">
                <div>
                  <h3>Stays</h3>
                </div>
                <button className="ghost-button compact-button" onClick={addManualJourneyStay} type="button">
                  + Add stay
                </button>
              </div>

              <div className="journey-create-fields">
                <div className="journey-stays-suggestions">
                  <span>Suggested from tickets</span>
                  <div className="journey-stays-chip-row">
                    {journeyStaySuggestions.length > 0 ? (
                      journeyStaySuggestions.map((suggestion) => {
                        const selected = selectedJourneyStayIdentities.has(suggestion.identity);
                        return (
                          <button
                            className={selected ? "journey-stay-chip active" : "journey-stay-chip"}
                            key={suggestion.identity}
                            onClick={() => addJourneyStaySuggestion(suggestion.identity)}
                            type="button"
                          >
                            {suggestion.placeName}
                          </button>
                        );
                      })
                    ) : (
                      <span className="detail-helper-text">Select tickets to generate stay suggestions.</span>
                    )}
                  </div>
                </div>

                <div className="journey-stays-table" role="table" aria-label="Journey stays editor">
                  <div className="journey-stays-table-header" role="row">
                    <span>Place</span>
                    <span>Departure</span>
                    <span className="journey-stays-actions-header">Actions</span>
                  </div>

                  {journeyStopsLoading ? (
                    <div className="empty-state">Loading stays...</div>
                  ) : journeyStayDrafts.length === 0 ? (
                    <div className="empty-state">Add a stay manually or choose a suggested place.</div>
                  ) : (
                    <div className="journey-stays-table-body" data-journey-stays-body="true">
                      {sortedJourneyStayDraftRows.map((stay, index) => {
                        const departureValue = stay.departureDateTime?.slice(0, 10) ?? "";
                        const isUnknown = !departureValue;
                        const isEditingDeparture = journeyStayDepartureEditor?.draftId === stay.draftId;
                        const isDraggedUnknown = isUnknown && draggedUnknownStayId === stay.draftId;
                        const draggedRowIndex = draggedUnknownStayId
                          ? sortedJourneyStayDraftRows.findIndex((row) => row.draftId === draggedUnknownStayId)
                          : -1;
                        const isInsertionBeforeRow = journeyStayDropIndex === index
                          && journeyStayDropIndex !== draggedRowIndex
                          && journeyStayDropIndex !== draggedRowIndex + 1;

                        const departurePopover = isEditingDeparture
                          ? createPortal(
                              <div
                                aria-label="Edit stay departure"
                                className="journey-stay-departure-popover"
                                data-journey-stay-departure-editor={stay.draftId}
                                role="dialog"
                                style={{
                                  left: Math.max(
                                    16,
                                    Math.min(
                                      journeyStayDepartureEditor.anchorRect.left,
                                      window.innerWidth - Math.max(journeyStayDepartureEditor.anchorRect.width, 220) - 16,
                                    ),
                                  ),
                                  minWidth: Math.max(journeyStayDepartureEditor.anchorRect.width, 220),
                                  position: "fixed",
                                  top: Math.min(journeyStayDepartureEditor.anchorRect.top, window.innerHeight - 180),
                                  zIndex: 2000,
                                }}
                              >
                                <input
                                  onChange={(event) => updateJourneyStayDeparturePickerDate(event.target.value)}
                                  type="date"
                                  value={journeyStayDepartureEditor.pendingDate}
                                />
                                <div className="journey-stay-departure-popover-actions">
                                  <button
                                    className="ghost-button compact-button"
                                    onClick={() => updateJourneyStayDeparturePickerDate(formatLocalDateKey(new Date()))}
                                    type="button"
                                  >
                                    Today
                                  </button>
                                  <button
                                    className="ghost-button compact-button"
                                    onClick={() => forgetJourneyStayDepartureDate(stay.draftId)}
                                    type="button"
                                  >
                                    Forget
                                  </button>
                                  <button
                                    className="primary-button compact-button"
                                    onClick={() =>
                                      applyJourneyStayDepartureDate(stay.draftId, journeyStayDepartureEditor.pendingDate)
                                    }
                                    type="button"
                                  >
                                    Confirm
                                  </button>
                                </div>
                              </div>,
                              document.body,
                            )
                          : null;

                        return (
                          <div className="journey-stay-entry" key={stay.draftId}>
                            <div
                              aria-hidden="true"
                              className={isInsertionBeforeRow ? "journey-stay-drop-slot is-active" : "journey-stay-drop-slot"}
                            />
                            <div
                              className={[
                                "journey-stay-row",
                                isDraggedUnknown ? "is-dragging-unknown" : "",
                              ].filter(Boolean).join(" ")}
                              data-journey-stay-row-id={stay.draftId}
                              role="row"
                            >
                              <div className="journey-stay-place-field">
                                <button
                                  aria-label={isUnknown ? `Drag stay ${stay.placeName || "row"}` : "Known departure rows stay date-sorted"}
                                  className={isUnknown ? "journey-stay-grip-button" : "journey-stay-grip-button is-locked"}
                                  disabled={!isUnknown}
                                  onPointerDown={(event) => handleJourneyStayDragStart(stay.draftId, isUnknown, event)}
                                  type="button"
                                >
                                  <span className="journey-stay-grip" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                  </span>
                                </button>
                                <input
                                  onChange={(event) =>
                                    updateJourneyStayDraft(stay.draftId, (current) => ({
                                      ...current,
                                      placeName: event.target.value,
                                      placeKey: undefined,
                                      countryCode: undefined,
                                      source: "manual",
                                      userEdited: true,
                                    }))
                                  }
                                  placeholder="Osaka"
                                  value={stay.placeName}
                                />
                              </div>

                              <div
                                className="journey-stay-departure-field"
                                data-journey-stay-departure-editor={stay.draftId}
                              >
                                <button
                                  className="journey-stay-departure-button"
                                  onClick={(event) => openJourneyStayDepartureEditor(stay, event.currentTarget)}
                                  type="button"
                                >
                                  {departureValue || "Unknown"}
                                </button>
                                {departurePopover}
                              </div>

                              <div className="journey-stay-row-actions">
                                <button
                                  aria-label={`Remove stay ${stay.placeName || "row"}`}
                                  className="journey-stay-remove-button"
                                  onClick={() => removeJourneyStayDraft(stay.draftId)}
                                  type="button"
                                >
                                  -
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        aria-hidden="true"
                        className={journeyStayDropIndex === sortedJourneyStayDraftRows.length
                          && journeyStayDropIndex !== (draggedUnknownStayId
                            ? sortedJourneyStayDraftRows.findIndex((row) => row.draftId === draggedUnknownStayId) + 1
                            : -1)
                          ? "journey-stay-drop-slot is-active is-terminal"
                          : "journey-stay-drop-slot is-terminal"}
                      />
                    </div>
                  )}
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
                        <AppIcon className="section-help-icon" name="help" size={16} />
                      </button>
                      <div className="section-help-tooltip" role="tooltip">
                        Select zero or more existing tickets to link into this journey.
                      </div>
                    </div>
                  </div>
                </div>
                <span className="ticket-status ticket-status-saved">
                  {journeyDraft.selectedTicketIds.length} selected
                </span>
              </div>

              <div className="journey-create-fields">
                <label>
                  <input
                    onChange={(event) => setJourneyTicketSearch(event.target.value)}
                    placeholder="Search by date, month, year, code, route, departure, arrival..."
                    value={journeyTicketSearch}
                  />
                </label>

                <div className="journey-ticket-selector">
                  {filteredSelectableTickets.length === 0 ? (
                    <div className="empty-state">No tickets match the current search.</div>
                  ) : (
                    filteredSelectableTickets.map((ticket) => {
                      const selected = journeyDraft.selectedTicketIds.includes(ticket.id);
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
                          <span className="journey-ticket-option-main">
                            <span className="journey-ticket-option-top">
                              <strong>
                                <span aria-hidden="true" className="journey-ticket-inline-icon">
                                  {transportIcon(ticket.ticketType)}
                                </span>
                                {routeSummary}
                              </strong>
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
                      setJourneyDraft((current) => ({
                        ...current,
                        companionsText: event.target.value,
                      }))
                    }
                    placeholder="Separate names with comma, Chinese comma, dunhao, or new lines"
                    value={journeyDraft.companionsText}
                  />
                </label>

                <div className="journey-create-rating-block">
                  <span>Rating</span>
                  <div className="journey-rating-row">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        className={
                          (journeyDraft.rating ?? 0) >= value
                            ? "journey-rating-button active"
                            : "journey-rating-button"
                        }
                        key={value}
                        onClick={() =>
                          setJourneyDraft((current) => ({
                            ...current,
                            rating: value,
                          }))
                        }
                        type="button"
                      >
                        {FILLED_STAR}
                      </button>
                    ))}
                    {journeyDraft.rating ? (
                      <button
                        className="ghost-button compact-button"
                        onClick={() =>
                          setJourneyDraft((current) => ({
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
                      setJourneyDraft((current) => ({ ...current, mood: event.target.value }))
                    }
                    placeholder="Relaxed, excited, hectic..."
                    value={journeyDraft.mood}
                  />
                </label>

                <div className="journey-create-inline-grid">
                  <label>
                    <span>Cost amount</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        setJourneyDraft((current) => ({ ...current, costAmount: event.target.value }))
                      }
                      placeholder="2400"
                      type="number"
                      value={journeyDraft.costAmount}
                    />
                  </label>

                  <label>
                    <span>Cost currency</span>
                    <input
                      onChange={(event) =>
                        setJourneyDraft((current) => ({ ...current, costCurrency: event.target.value }))
                      }
                      onInput={() => setJourneyCostCurrencyTouched(true)}
                      placeholder="AUD"
                      value={journeyDraft.costCurrency}
                    />
                  </label>
                </div>

                {showJourneyExchangeRateField ? (
                  <label>
                    <span>Exchange rate to CNY</span>
                    <input
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = event.target.value;
                        setJourneyDraft((current) => ({ ...current, costExchangeRateToCny: value }));
                        if (journeyExchangeRateError) {
                          setJourneyExchangeRateError("");
                        }
                      }}
                      placeholder={`1 ${normalizedJourneyCostCurrency} = 4.8 CNY`}
                      type="number"
                      value={journeyDraft.costExchangeRateToCny}
                    />
                    <span className="detail-helper-text">
                      Example: 1 AUD = 4.8 CNY. 1 JPY = 0.05 CNY.
                    </span>
                    {journeyExchangeRateError ? (
                      <span className="journey-create-field-error">{journeyExchangeRateError}</span>
                    ) : null}
                  </label>
                ) : null}

                <label>
                  <span>Lodging</span>
                  <input
                    onChange={(event) =>
                      setJourneyDraft((current) => ({ ...current, lodging: event.target.value }))
                    }
                    placeholder="Airport hotel, Airbnb, campervan..."
                    value={journeyDraft.lodging}
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
                      setJourneyDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    placeholder="Memories, highlights, why this trip mattered..."
                    value={journeyDraft.notes}
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="form-actions">
            <button className="ghost-button" disabled={journeySaving} onClick={closeJourneyModal} type="button">
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={journeySaving}
              onClick={() => void handleSaveJourney()}
              type="button"
            >
              {journeySaving ? "Saving..." : journeyModalMode === "edit" ? "Save changes" : "Save journey"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (selectedJourneyId) {
    const fallbackJourney = journeys.find((journey) => journey.id === selectedJourneyId);
    const displayedJourney = journeyDetail ?? fallbackJourney ?? null;
    const routeSummary = journeyDetailStops.length > 0
      ? detailDestinationDisplay
      : buildJourneyRouteSummaryFromTickets(detailLinkedTickets, {
          preferredLanguage: language,
        });
    const ticketCount = displayedJourney?.ticketIds.length ?? detailLinkedTickets.length;
    const segmentCount = countJourneySegments(detailLinkedTickets);
    const cost = displayedJourney ? formatJourneyCost(displayedJourney) : null;
    const rating = displayedJourney ? formatJourneyRating(displayedJourney.rating) : null;
    const exchangeRate =
      displayedJourney && displayedJourney.costCurrency
        ? formatJourneyExchangeRate(displayedJourney.costExchangeRateToCny)
        : null;
    const approximateCny =
      displayedJourney ? formatJourneyApproximateCny(displayedJourney) : null;

    return (
      <section className="section-stack journeys-page journey-detail-view">
        <div className="tickets-subview-header">
          <button className="ghost-button compact-button" onClick={closeJourneyDetail} type="button">
            Back to journeys
          </button>
          <div className="tickets-detail-title">
            <h3>{displayedJourney?.title ?? "Journey detail"}</h3>
            <p>{displayedJourney ? formatJourneyDateRange(displayedJourney) : "Loading journey..."}</p>
          </div>
          <div className="tickets-subview-actions">
            <button
              className="ghost-button compact-button"
              disabled={journeyDetailLoading || deletePending}
              onClick={() => displayedJourney && openEditJourneyModal(displayedJourney)}
              type="button"
            >
              Edit
            </button>
            <button
              className="ghost-button compact-button danger-button"
              disabled={journeyDetailLoading || deletePending}
              onClick={openDeleteDialog}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>

        {journeyDetailLoading ? (
          <div className="panel">
            <div className="empty-state">Loading journey detail...</div>
          </div>
        ) : null}

        {!journeyDetailLoading && journeyDetailError ? (
          <div className="panel journeys-list-feedback-card">
            <h3>Failed to load journey detail</h3>
            <p className="hero-copy">{journeyDetailError}</p>
            <div className="journeys-feedback-actions">
              <button className="ghost-button" onClick={() => void openJourneyDetail(selectedJourneyId)} type="button">
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {!journeyDetailLoading && displayedJourney && !journeyDetailError ? (
          <>
            <div className="journey-detail-hero-grid">
              <section className="panel journey-detail-summary-card">
                <div>
                  <span className="ticket-kind">Journey summary</span>
                  <h3>{detailDestinationDisplay}</h3>
                  <p className="hero-copy">{formatJourneyDateRange(displayedJourney)}</p>
                </div>

                <div className="journey-detail-stat-grid">
                  <div className="journey-detail-stat">
                    <span>Duration</span>
                    <strong>{formatJourneyDuration(displayedJourney) ?? "No date yet"}</strong>
                  </div>
                  <div className="journey-detail-stat">
                    <span>Tickets</span>
                    <strong>{ticketCount}</strong>
                  </div>
                  <div className="journey-detail-stat">
                    <span>Segments</span>
                    <strong>{segmentCount}</strong>
                  </div>
                  <div className="journey-detail-stat">
                    <span>Transport</span>
                    <strong>{summarizeJourneyTransport(detailLinkedTickets)}</strong>
                  </div>
                </div>

                <div className="journey-list-metadata">
                  {cost ? <span className="journey-list-meta-chip journey-list-meta-chip-cost">{cost}</span> : null}
                  {rating ? <span className="journey-list-meta-chip journey-list-meta-chip-rating">{rating}</span> : null}
                  {displayedJourney.mood ? (
                    <span className="journey-list-meta-chip journey-list-meta-chip-mood">{displayedJourney.mood}</span>
                  ) : null}
                  {displayedJourney.lodging ? (
                    <span className="journey-list-meta-chip">{displayedJourney.lodging}</span>
                  ) : null}
                </div>
              </section>

              <section className="panel journey-detail-calendar-card">
                <div className="panel-heading">
                  <div>
                    <h3>Mini calendar</h3>
                  </div>
                  {detailCalendarMonths.length > 1 ? (
                    <div className="journey-calendar-nav" role="group" aria-label="Mini calendar month switcher">
                      <button
                        className="journey-calendar-nav-button"
                        disabled={detailCalendarIndex === 0}
                        onClick={() => setDetailCalendarIndex((current) => Math.max(current - 1, 0))}
                        type="button"
                      >
                        <span aria-hidden="true">&lt;</span>
                      </button>
                      <strong>{activeDetailCalendarMonth?.navigationLabel ?? activeDetailCalendarMonth?.label}</strong>
                      <button
                        className="journey-calendar-nav-button"
                        disabled={detailCalendarIndex >= detailCalendarMonths.length - 1}
                        onClick={() =>
                          setDetailCalendarIndex((current) =>
                            Math.min(current + 1, detailCalendarMonths.length - 1),
                          )
                        }
                        type="button"
                      >
                        <span aria-hidden="true">&gt;</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                {activeDetailCalendarMonth === null ? (
                  <div className="empty-state">No date range yet.</div>
                ) : (
                  <div className="journey-calendar-months">
                    <div className="journey-calendar-month" key={activeDetailCalendarMonth.key}>
                      <div className="journey-calendar-month-header">
                        {activeDetailCalendarMonth.monthLegend.length <= 1 ? (
                          <strong>{activeDetailCalendarMonth.label}</strong>
                        ) : null}
                        {activeDetailCalendarMonth.monthLegend.length > 1 ? (
                          <div className="journey-calendar-legend">
                            {activeDetailCalendarMonth.monthLegend.map((month) => (
                              <span
                                className={`journey-calendar-legend-chip ${month.toneClass}`}
                                key={month.key}
                              >
                                {month.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="journey-calendar-weekdays" aria-hidden="true">
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                          <span key={`${activeDetailCalendarMonth.key}-${day}-${index}`}>{day}</span>
                        ))}
                      </div>
                      <div className="journey-calendar-days">
                        {activeDetailCalendarMonth.days.map((day) => (
                          <span
                            className={[
                              "journey-calendar-day",
                              day.toneClass,
                              day.inRange ? "in-range" : "",
                              day.isToday ? "is-today" : "",
                              day.isSpacer ? "is-spacer" : "",
                            ].filter(Boolean).join(" ")}
                            key={day.key}
                          >
                            {day.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="content-grid journey-detail-content-grid">
              <section className="journey-detail-notes-card journey-detail-inline-card">
                <h3>Route summary</h3>
                <p className="journey-detail-route-line">{routeSummary}</p>

                <h3>Companions</h3>
                {displayedJourney.companions.length === 0 ? (
                  <p className="hero-copy">No companions recorded.</p>
                ) : (
                  <div className="journey-list-metadata">
                    {displayedJourney.companions.map((companion) => (
                      <span className="journey-list-meta-chip" key={companion.id}>
                        {companion.name}
                      </span>
                    ))}
                  </div>
                )}

                <h3>Cost</h3>
                {cost ? (
                  <div className="journey-detail-cost-stack">
                    <p className="journey-detail-route-line">{cost}</p>
                    {displayedJourney.costCurrency?.toUpperCase() !== "CNY" && exchangeRate ? (
                      <>
                        <p className="journey-detail-note-text">
                          {`Exchange rate: 1 ${displayedJourney.costCurrency?.toUpperCase()} = ${exchangeRate} CNY`}
                        </p>
                        {approximateCny ? (
                          <p className="journey-detail-note-text">{`Approx. CNY: ${approximateCny}`}</p>
                        ) : null}
                      </>) : null}
                    {displayedJourney.costCurrency?.toUpperCase() !== "CNY" && !exchangeRate ? (
                      <p className="journey-detail-note-text">Exchange rate to CNY not set.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="hero-copy">No cost recorded.</p>
                )}

                <h3>Notes</h3>
                <p className="journey-detail-note-text">{displayedJourney.notes || "No notes recorded."}</p>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Linked tickets</h3>
                  </div>
                </div>

                <div className="compact-ticket-list">
                  {detailLinkedTickets.length === 0 ? (
                    <div className="empty-state">
                      <strong>No linked tickets yet</strong>
                      <p>This Journey can still be opened safely without linked tickets.</p>
                    </div>
                  ) : (
                    detailLinkedTickets.map((ticket) => (
                      <button
                        className="ticket-row"
                        key={ticket.id}
                        onClick={() => onOpenTicket?.(ticket.id, displayedJourney.id)}
                        type="button"
                      >
                        <div aria-hidden="true" className="ticket-row-icon">
                          {transportIcon(ticket.ticketType)}
                        </div>
                        <div className="ticket-row-main">
                          <div className="ticket-row-top">
                            <strong>{buildTicketRouteSummary(ticket)}</strong>
                            <span className="ticket-code">{buildTicketCodeSummary(ticket)}</span>
                          </div>
                          <div className="ticket-row-meta">
                            <span>{formatTicketDateTime(ticket.departureTimeLocal)}</span>
                            <span>{"->"}</span>
                            <span>{formatTicketDateTime(ticket.arrivalTimeLocal)}</span>
                          </div>
                          <div className="ticket-row-submeta">
                            <span>{ticket.carrierName || "No carrier"}</span>
                            <span>
                              {`${ticket.departure.code || ticket.departure.name} -> ${ticket.arrival.code || ticket.arrival.name}`}
                            </span>
                          </div>
                        </div>
                        <div className="ticket-row-side">
                          <span className={`ticket-status ticket-status-${ticket.status}`}>{ticket.status}</span>
                          <small>{`${ticket.segmentCount} leg${ticket.segmentCount > 1 ? "s" : ""}`}</small>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}

        {isDeleteDialogOpen && displayedJourney ? (
          <div className="modal-backdrop" role="presentation">
            <div
              aria-labelledby="journey-delete-dialog-title"
              aria-modal="true"
              className="modal-shell tickets-modal journey-delete-modal"
              role="dialog"
            >
              <div className="tickets-modal-header">
                <div>
                  <h3 id="journey-delete-dialog-title">Delete this journey?</h3>
                  <p className="hero-copy">
                    This will remove the journey and its ticket links, but your original tickets will not be deleted.
                  </p>
                </div>
                <button
                  aria-label="Close delete journey dialog"
                  className="modal-close-button"
                  disabled={deletePending}
                  onClick={closeDeleteDialog}
                  type="button"
                >
            <AppIcon className="modal-close-icon" name="close" size={20} />
          </button>
              </div>

              <div className="tickets-modal-body">
                <div className="journey-delete-summary">
                  <strong>{displayedJourney.title}</strong>
                  <span>{formatJourneyDateRange(displayedJourney)}</span>
                </div>

                {deleteError ? (
                  <div className="journey-create-feedback journey-create-feedback-error" role="alert">
                    {deleteError}
                  </div>
                ) : null}

                <div className="form-actions">
                  <button className="ghost-button" disabled={deletePending} onClick={closeDeleteDialog} type="button">
                    Cancel
                  </button>
                  <button
                    className="ghost-button danger-button"
                    disabled={deletePending}
                    onClick={() => void handleConfirmDeleteJourney()}
                    type="button"
                  >
                    {deletePending ? "Deleting..." : "Delete journey"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {journeyModal}
      </section>
    );
  }

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

      {journeyModal}
    </section>
  );
}

































