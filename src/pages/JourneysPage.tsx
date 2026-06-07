import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { createJourney, deleteJourney, getJourney, listJourneys, updateJourney } from "../lib/journeyService";
import type { CreateJourneyInput, Journey, JourneyDateMode } from "../types/journey";
import type { TicketLocation, TicketRecord } from "../types/ticket";

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
  days: Array<{
    key: string;
    label: string;
    inRange: boolean;
    isToday: boolean;
    isSpacer: boolean;
  }>;
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

interface JourneySummaryCalendarDay {
  key: string;
  dateKey: string | null;
  dayNumber: string;
  monthIndex: number | null;
  isCurrentYear: boolean;
  isToday: boolean;
  overlapCount: number;
  entries: Array<{
    journeyId: string;
    title: string;
    rangeLabel: string;
    dayLabel: string;
  }>;
}

interface JourneySummaryCalendarWeek {
  key: string;
  monthLabel: string;
  days: JourneySummaryCalendarDay[];
}

interface JourneySummaryDestinationStat {
  label: string;
  journeyCount: number;
  dedupedTravelDays: number;
}

interface JourneySummaryCompanionStat {
  label: string;
  journeyCount: number;
}

interface JourneySummaryCompanionGroup {
  journeyCount: number;
  labels: string[];
}

interface JourneySummaryCurrencyStat {
  currency: string;
  totalAmount: number;
  journeyCount: number;
}

interface JourneySummaryLongestJourney {
  title: string;
  durationDays: number;
  rangeLabel: string;
}

interface JourneySummaryHighestCostJourney {
  title: string;
  amountLabel: string;
  convertedCny: number;
  convertedLabel: string;
}

interface JourneySummaryBusiestMonth {
  monthKey: string;
  dedupedTravelDays: number;
}

interface JourneySummaryBase {
  travelDayEntries: Map<
    string,
    Array<{ journeyId: string; title: string; rangeLabel: string; dayLabel: string }>
  >;
  allTravelDays: number;
  availableYears: string[];
  journeysByYear: Map<string, Set<string>>;
  topDestinations: JourneySummaryDestinationStat[];
  topCompanions: JourneySummaryCompanionStat[];
  topCompanionGroups: JourneySummaryCompanionGroup[];
  costByCurrency: JourneySummaryCurrencyStat[];
  comparableCostCnyTotal: number | null;
  journeysWithoutCost: number;
  missingExchangeRateCount: number;
  longestJourney: JourneySummaryLongestJourney | null;
  busiestMonth: JourneySummaryBusiestMonth | null;
  highestCostJourney: JourneySummaryHighestCostJourney | null;
}

interface JourneySummaryCalendar {
  selectedYearJourneys: number;
  selectedYearTravelDays: number;
  weeks: JourneySummaryCalendarWeek[];
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
    return formattedStart === formattedEnd ? formattedStart : `${formattedStart} 闂?${formattedEnd}`;
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

function formatJourneyDateRangeCompact(journey: Journey) {
  if (journey.startDate && journey.endDate) {
    return journey.startDate === journey.endDate
      ? journey.startDate
      : `${journey.startDate} ~ ${journey.endDate}`;
  }

  return journey.startDate ?? journey.endDate ?? "No date yet";
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

function formatLocalDateKey(date: Date) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function incrementDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  parsed.setDate(parsed.getDate() + 1);
  return formatLocalDateKey(parsed);
}

function enumerateJourneyDateKeys(journey: Journey) {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  const dates: string[] = [];
  let cursor = [
    String(range.start.getFullYear()),
    String(range.start.getMonth() + 1).padStart(2, "0"),
    String(range.start.getDate()).padStart(2, "0"),
  ].join("-");
  const endKey = [
    String(range.end.getFullYear()),
    String(range.end.getMonth() + 1).padStart(2, "0"),
    String(range.end.getDate()).padStart(2, "0"),
  ].join("-");

  while (cursor <= endKey) {
    dates.push(cursor);
    cursor = incrementDateKey(cursor);
  }

  return dates;
}

function describeJourneyDay(journey: Journey, dateKey: string) {
  if (journey.startDate && journey.endDate && journey.startDate === journey.endDate && journey.startDate === dateKey) {
    return "single-day trip";
  }
  if (journey.startDate === dateKey) {
    return "first day";
  }
  if (journey.endDate === dateKey) {
    return "last day";
  }
  return "travel day";
}

function formatCurrencyAmount(value: number) {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildJourneySummaryTooltip(dateKey: string, entries: JourneySummaryCalendarDay["entries"]) {
  if (entries.length === 0) {
    return undefined;
  }

  const lines = [dateKey, entries.length > 1 ? `${entries.length} journeys` : "1 journey"];
  entries.forEach((entry) => {
    lines.push(`${entry.title} (${entry.rangeLabel})`);
    lines.push(entry.dayLabel);
  });
  return lines.join("\n");
}

function getJourneySummaryMonthColor(monthIndex: number): CSSProperties {
  const variableIndex = monthIndex + 1;
  return {
    "--journey-summary-month-rgb": `var(--journey-month-${variableIndex}-rgb)`,
  } as CSSProperties;
}

function buildJourneySummaryCalendarWeeks(
  year: number,
  dayEntries: Map<string, Array<{ journeyId: string; title: string; rangeLabel: string; dayLabel: string }>>,
) {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  const firstMonday = new Date(firstDay);
  const firstDayOffset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - firstDayOffset);
  const lastSunday = new Date(lastDay);
  const lastDayOffset = 6 - ((lastSunday.getDay() + 6) % 7);
  lastSunday.setDate(lastSunday.getDate() + lastDayOffset);

  const todayKey = formatLocalDateKey(new Date());
  const weeks: JourneySummaryCalendarWeek[] = [];
  const cursor = new Date(firstMonday);
  let weekIndex = 0;

  while (cursor <= lastSunday) {
    const weekStart = new Date(cursor);
    const days: JourneySummaryCalendarDay[] = [];
    let monthLabel = "";

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + dayOffset);
      const currentYear = current.getFullYear();
      const currentMonth = current.getMonth();
      const currentDateKey = formatLocalDateKey(current);
      const isCurrentYear = currentYear === year;
      const entries = isCurrentYear ? dayEntries.get(currentDateKey) ?? [] : [];

      if (!monthLabel && isCurrentYear && current.getDate() === 1) {
        monthLabel = current.toLocaleDateString("en-AU", { month: "short" });
      }

      days.push({
        key: `${currentDateKey}-${dayOffset}`,
        dateKey: isCurrentYear ? currentDateKey : null,
        dayNumber: isCurrentYear ? String(current.getDate()) : "",
        monthIndex: isCurrentYear ? currentMonth : null,
        isCurrentYear,
        isToday: currentDateKey === todayKey,
        overlapCount: entries.length,
        entries,
      });
    }

    weeks.push({
      key: `${year}-week-${weekIndex}`,
      monthLabel,
      days,
    });
    cursor.setDate(cursor.getDate() + 7);
    weekIndex += 1;
  }

  return weeks;
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

function getTicketRouteStops(ticket: TicketRecord) {
  const segments = ticket.segments ?? [];
  const stops = segments.length === 0 || !sameTicketLocation(ticket.departure, segments[0].departure)
    ? [ticket.departure.name, ...segments.map((segment) => segment.departure.name), ticket.arrival.name]
    : [segments[0].departure.name, ...segments.map((segment) => segment.arrival.name)];

  return stops
    .map((stop) => stop.trim())
    .filter(Boolean)
    .filter((stop, index, values) => stop !== values[index - 1]);
}

function sortTicketsByTripDate(tickets: TicketRecord[]) {
  return [...tickets].sort((left, right) => {
    const leftDate = left.departureTimeLocal || left.arrivalTimeLocal || left.createdAt || "";
    const rightDate = right.departureTimeLocal || right.arrivalTimeLocal || right.createdAt || "";
    return leftDate.localeCompare(rightDate) || left.createdAt.localeCompare(right.createdAt);
  });
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

function buildJourneyRouteSummary(linkedTickets: TicketRecord[]) {
  const stops = sortTicketsByTripDate(linkedTickets)
    .flatMap((ticket) => getTicketRouteStops(ticket))
    .filter((stop, index, values) => stop !== values[index - 1]);

  return stops.length > 0 ? stops.join(" -> ") : "No linked route yet";
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

function formatJourneyRating(rating?: number) {
  if (typeof rating !== "number" || rating <= 0) {
    return null;
  }

  return `${rating}/5`;
}

function buildCalendarMonths(journey: Journey): JourneyCalendarMonth[] {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  const monthStarts = [
    new Date(range.start.getFullYear(), range.start.getMonth(), 1),
  ];
  const endMonthStart = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
  if (endMonthStart.getTime() !== monthStarts[0].getTime()) {
    monthStarts.push(endMonthStart);
  }

  const todayKey = formatLocalDateKey(new Date());

  return monthStarts.slice(0, 2).map((monthStart) => {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOffset = monthStart.getDay();
    const days: JourneyCalendarMonth["days"] = [];

    for (let index = 0; index < firstDayOffset; index += 1) {
      days.push({
        key: `${year}-${month}-spacer-${index}`,
        label: "",
        inRange: false,
        isToday: false,
        isSpacer: true,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const currentDate = new Date(year, month, day);
      const dateKey = [
        String(year),
        String(month + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");

      days.push({
        key: dateKey,
        label: String(day),
        inRange: currentDate >= range.start && currentDate <= range.end,
        isToday: dateKey === todayKey,
        isSpacer: false,
      });
    }

    return {
      key: `${year}-${month}`,
      label: monthStart.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
      days,
    };
  });
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

  return preview.startDate === preview.endDate ? formattedStart : `${formattedStart} 闂?${formattedEnd}`;
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
  const normalizedCostCurrency = draft.costCurrency.trim().toUpperCase();
  const trimmedExchangeRate = draft.costExchangeRateToCny.trim();
  const parsedExchangeRate =
    trimmedExchangeRate.length > 0 ? Number.parseFloat(trimmedExchangeRate) : Number.NaN;

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
  const [journeyModalMode, setJourneyModalMode] = useState<JourneyModalMode | null>(null);
  const [journeyDraft, setJourneyDraft] = useState<CreateJourneyDraft>(EMPTY_CREATE_JOURNEY_DRAFT);
  const [journeyTicketSearch, setJourneyTicketSearch] = useState("");
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeyError, setJourneyError] = useState("");
  const [journeyTitleError, setJourneyTitleError] = useState("");
  const [journeyExchangeRateError, setJourneyExchangeRateError] = useState("");
  const [journeyCostCurrencyTouched, setJourneyCostCurrencyTouched] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, setDeletePending] = useState(false);

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

  const detailLinkedTickets = useMemo(
    () => sortTicketsByTripDate(getLinkedTickets(journeyDetail, tickets)),
    [journeyDetail, tickets],
  );

  const detailCalendarMonths = useMemo(
    () => (journeyDetail ? buildCalendarMonths(journeyDetail) : []),
    [journeyDetail],
  );

  const autoDatePreview = useMemo(() => deriveJourneyDatePreview(selectedTickets), [selectedTickets]);
  const normalizedJourneyCostCurrency = journeyDraft.costCurrency.trim().toUpperCase();
  const showJourneyExchangeRateField =
    normalizedJourneyCostCurrency.length > 0 && normalizedJourneyCostCurrency !== "CNY";

  const summaryBase = useMemo<JourneySummaryBase>(() => {
    const travelDayEntries = new Map<
      string,
      Array<{ journeyId: string; title: string; rangeLabel: string; dayLabel: string }>
    >();
    const allYears = new Set<string>([currentSummaryYear]);
    const journeysByYear = new Map<string, Set<string>>();
    const travelDaysByMonth = new Map<string, Set<string>>();
    const destinationMap = new Map<string, { label: string; journeyIds: Set<string>; travelDays: Set<string> }>();
    const companionMap = new Map<string, { label: string; journeyIds: Set<string> }>();
    const costByCurrencyMap = new Map<string, { totalAmount: number; journeyCount: number }>();
    let comparableCostCnyTotal = 0;
    let hasComparableCost = false;
    let journeysWithoutCost = 0;
    let missingExchangeRateCount = 0;
    let longestJourney: JourneySummaryLongestJourney | null = null;
    let highestCostJourney: JourneySummaryHighestCostJourney | null = null;

    journeys.forEach((journey) => {
      const journeyDateKeys = enumerateJourneyDateKeys(journey);
      const rangeLabel = formatJourneyDateRangeCompact(journey);

      if (journeyDateKeys.length > 0) {
        if (
          !longestJourney ||
          journeyDateKeys.length > longestJourney.durationDays ||
          (journeyDateKeys.length === longestJourney.durationDays && rangeLabel > longestJourney.rangeLabel)
        ) {
          longestJourney = {
            title: journey.title,
            durationDays: journeyDateKeys.length,
            rangeLabel,
          };
        }
      }

      if (journeyDateKeys.length > 0) {
        journeyDateKeys.forEach((dateKey) => {
          const entries = travelDayEntries.get(dateKey) ?? [];
          entries.push({
            journeyId: journey.id,
            title: journey.title,
            rangeLabel,
            dayLabel: describeJourneyDay(journey, dateKey),
          });
          travelDayEntries.set(dateKey, entries);

          const year = dateKey.slice(0, 4);
          allYears.add(year);
          const yearJourneys = journeysByYear.get(year) ?? new Set<string>();
          yearJourneys.add(journey.id);
          journeysByYear.set(year, yearJourneys);

          const monthKey = dateKey.slice(0, 7);
          const monthDays = travelDaysByMonth.get(monthKey) ?? new Set<string>();
          monthDays.add(dateKey);
          travelDaysByMonth.set(monthKey, monthDays);
        });
      }

      const destinationLabel = journey.destination?.trim() || "No destination";
      const destinationKey = destinationLabel.toLowerCase();
      const destinationStat =
        destinationMap.get(destinationKey) ??
        {
          label: destinationLabel,
          journeyIds: new Set<string>(),
          travelDays: new Set<string>(),
        };
      destinationStat.journeyIds.add(journey.id);
      journeyDateKeys.forEach((dateKey) => destinationStat.travelDays.add(dateKey));
      destinationMap.set(destinationKey, destinationStat);

      const uniqueCompanions = new Map<string, string>();
      journey.companions.forEach((companion) => {
        const label = companion.name.trim();
        if (!label) {
          return;
        }
        uniqueCompanions.set(label.toLowerCase(), label);
      });
      uniqueCompanions.forEach((label, companionKey) => {
        const companionStat =
          companionMap.get(companionKey) ??
          {
            label,
            journeyIds: new Set<string>(),
          };
        companionStat.journeyIds.add(journey.id);
        companionMap.set(companionKey, companionStat);
      });

      if (typeof journey.costAmount === "number" && Number.isFinite(journey.costAmount)) {
        const costCurrency = journey.costCurrency?.trim().toUpperCase();
        if (costCurrency) {
          const currencyStat = costByCurrencyMap.get(costCurrency) ?? { totalAmount: 0, journeyCount: 0 };
          currencyStat.totalAmount += journey.costAmount;
          currencyStat.journeyCount += 1;
          costByCurrencyMap.set(costCurrency, currencyStat);
        }

        const exchangeRate = journey.costExchangeRateToCny;
        if (costCurrency === "CNY") {
          const convertedCny = journey.costAmount;
          comparableCostCnyTotal += convertedCny;
          hasComparableCost = true;
          if (!highestCostJourney || convertedCny > highestCostJourney.convertedCny) {
            highestCostJourney = {
              title: journey.title,
              amountLabel: formatJourneyCost(journey) ?? formatCurrencyAmount(journey.costAmount),
              convertedCny,
              convertedLabel: formatCurrencyAmount(convertedCny),
            };
          }
        } else if (costCurrency && typeof exchangeRate === "number" && Number.isFinite(exchangeRate) && exchangeRate > 0) {
          const convertedCny = journey.costAmount * exchangeRate;
          comparableCostCnyTotal += convertedCny;
          hasComparableCost = true;
          if (!highestCostJourney || convertedCny > highestCostJourney.convertedCny) {
            highestCostJourney = {
              title: journey.title,
              amountLabel: formatJourneyCost(journey) ?? `${costCurrency} ${formatCurrencyAmount(journey.costAmount)}`,
              convertedCny,
              convertedLabel: formatCurrencyAmount(convertedCny),
            };
          }
        } else if (costCurrency && costCurrency !== "CNY") {
          missingExchangeRateCount += 1;
        }
      } else {
        journeysWithoutCost += 1;
      }
    });

    const topDestinations = [...destinationMap.values()]
      .map<JourneySummaryDestinationStat>((value) => ({
        label: value.label,
        journeyCount: value.journeyIds.size,
        dedupedTravelDays: value.travelDays.size,
      }))
      .sort((left, right) => {
        if (right.journeyCount !== left.journeyCount) {
          return right.journeyCount - left.journeyCount;
        }
        if (right.dedupedTravelDays !== left.dedupedTravelDays) {
          return right.dedupedTravelDays - left.dedupedTravelDays;
        }
        return left.label.localeCompare(right.label);
      });

    const topCompanions = [...companionMap.values()]
      .map<JourneySummaryCompanionStat>((value) => ({
        label: value.label,
        journeyCount: value.journeyIds.size,
      }))
      .sort((left, right) => {
        if (right.journeyCount !== left.journeyCount) {
          return right.journeyCount - left.journeyCount;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, 5);

    const topCompanionGroups = topCompanions.reduce<JourneySummaryCompanionGroup[]>((groups, companion) => {
      const existingGroup = groups.find((group) => group.journeyCount === companion.journeyCount);
      if (existingGroup) {
        existingGroup.labels.push(companion.label);
        return groups;
      }

      groups.push({
        journeyCount: companion.journeyCount,
        labels: [companion.label],
      });
      return groups;
    }, []);

    const costByCurrency = [...costByCurrencyMap.entries()]
      .map<JourneySummaryCurrencyStat>(([currency, value]) => ({
        currency,
        totalAmount: value.totalAmount,
        journeyCount: value.journeyCount,
      }))
      .sort((left, right) => {
        if (right.totalAmount !== left.totalAmount) {
          return right.totalAmount - left.totalAmount;
        }
        return left.currency.localeCompare(right.currency);
      });

    const busiestMonth: JourneySummaryBusiestMonth | null =
      [...travelDaysByMonth.entries()]
      .map(([monthKey, dates]) => ({ monthKey, dedupedTravelDays: dates.size }))
      .sort((left, right) => {
        if (right.dedupedTravelDays !== left.dedupedTravelDays) {
          return right.dedupedTravelDays - left.dedupedTravelDays;
        }
        return right.monthKey.localeCompare(left.monthKey);
      })[0] ?? null;

    const availableYears = [...allYears].sort((left, right) => right.localeCompare(left));

    return {
      travelDayEntries,
      allTravelDays: travelDayEntries.size,
      availableYears,
      journeysByYear,
      topDestinations,
      topCompanions,
      topCompanionGroups,
      costByCurrency,
      comparableCostCnyTotal: hasComparableCost ? comparableCostCnyTotal : null,
      journeysWithoutCost,
      missingExchangeRateCount,
      longestJourney,
      busiestMonth,
      highestCostJourney,
    };
  }, [currentSummaryYear, journeys]);

  const summaryCalendar = useMemo<JourneySummaryCalendar>(() => {
    const selectedYearJourneys = summaryBase.journeysByYear.get(summaryYear)?.size ?? 0;
    const selectedYearEntries = new Map<
      string,
      Array<{ journeyId: string; title: string; rangeLabel: string; dayLabel: string }>
    >();

    summaryBase.travelDayEntries.forEach((entries, dateKey) => {
      if (dateKey.startsWith(`${summaryYear}-`)) {
        selectedYearEntries.set(dateKey, entries);
      }
    });

    return {
      selectedYearJourneys,
      selectedYearTravelDays: selectedYearEntries.size,
      weeks: buildJourneySummaryCalendarWeeks(Number.parseInt(summaryYear, 10), selectedYearEntries),
    };
  }, [summaryBase, summaryYear]);

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
    setJourneyDetailError("");
    setJourneyDetailLoading(true);
    onJourneyDetailChange?.(journeyId);

    try {
      const storedJourney = await getJourney(journeyId);
      setJourneyDetail(storedJourney);
    } catch (error) {
      if (fallbackToListOnError) {
        setSelectedJourneyId("");
        setJourneyDetail(null);
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
    if (activeJourneyId && activeJourneyId !== selectedJourneyId) {
      setSubview("list");
      void openJourneyDetail(activeJourneyId, true);
    }
  }, [activeJourneyId, selectedJourneyId]);

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
  };

  const openEditJourneyModal = (journey: Journey) => {
    setJourneyModalMode("edit");
    setJourneyDraft(buildJourneyDraftFromJourney(journey));
    setJourneyTicketSearch("");
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");
    setJourneyCostCurrencyTouched(false);
  };

  const resetJourneyModalState = () => {
    setJourneyModalMode(null);
    setJourneyDraft(EMPTY_CREATE_JOURNEY_DRAFT);
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");
    setJourneyTicketSearch("");
    setJourneyCostCurrencyTouched(false);
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

    setJourneySaving(true);
    setJourneyError("");
    setJourneyTitleError("");
    setJourneyExchangeRateError("");

    try {
      if (journeyModalMode === "edit") {
        if (!selectedJourneyId) {
          throw new Error("Journey detail is not available to edit.");
        }

        const updatedJourney = await updateJourney(selectedJourneyId, buildCreateJourneyInput(journeyDraft));
        setJourneyDetail(updatedJourney);
        const listReloaded = await loadStoredJourneys();
        if (!listReloaded) {
          throw new Error("Journey was updated, but the Journey List could not be refreshed.");
        }
        const refreshedJourney = await getJourney(updatedJourney.id);
        setJourneyDetail(refreshedJourney);
        setJourneyDetailError("");
        resetJourneyModalState();
      } else {
        await createJourney(buildCreateJourneyInput(journeyDraft));
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
                    {`${formatCountLabel(summaryCalendar.selectedYearJourneys, "journey")} · ${formatCountLabel(summaryCalendar.selectedYearTravelDays, "travel day")} in ${summaryYear}`}
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
              {summaryBase.topDestinations.length > 0 ? (
                <div className="journey-summary-list">
                  {summaryBase.topDestinations.slice(0, 6).map((destination) => (
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
                      {"*".repeat(journey.rating)}
                      {".".repeat(5 - journey.rating)}
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
            <p className="hero-copy">
              {journeyModalMode === "edit"
                ? "Update journey details, linked tickets, companions, and notes."
                : "Group existing tickets into one travel record."}
            </p>
          </div>
          <button
            aria-label={journeyModalMode === "edit" ? "Close edit journey modal" : "Close create journey modal"}
            className="modal-close-button"
            disabled={journeySaving}
            onClick={closeJourneyModal}
            type="button"
          >
            闂?          </button>
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

                <label>
                  <span>Destination</span>
                  <input
                    onChange={(event) =>
                      setJourneyDraft((current) => ({ ...current, destination: event.target.value }))
                    }
                    placeholder="Tokyo"
                    value={journeyDraft.destination}
                  />
                </label>

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
                        *
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
    const routeSummary = buildJourneyRouteSummary(detailLinkedTickets);
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
                  <h3>{displayedJourney.destination || displayedJourney.title}</h3>
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
                  <span className="status-pill">{formatJourneyDateRange(displayedJourney)}</span>
                </div>

                {detailCalendarMonths.length === 0 ? (
                  <div className="empty-state">No date range yet.</div>
                ) : (
                  <div className="journey-calendar-months">
                    {detailCalendarMonths.map((month) => (
                      <div className="journey-calendar-month" key={month.key}>
                        <strong>{month.label}</strong>
                        <div className="journey-calendar-weekdays" aria-hidden="true">
                          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                            <span key={`${month.key}-${day}-${index}`}>{day}</span>
                          ))}
                        </div>
                        <div className="journey-calendar-days">
                          {month.days.map((day) => (
                            <span
                              className={[
                                "journey-calendar-day",
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
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="content-grid journey-detail-content-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Linked tickets</h3>
                  </div>
                  <span className="status-pill">{detailLinkedTickets.length} available</span>
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

              <section className="panel journey-detail-notes-card">
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
                      </>
                    ) : null}
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
                  X
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
