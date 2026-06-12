import type { Journey } from "../types/journey";
import type { TicketLocation, TicketRecord } from "../types/ticket";
import type { Language } from "./i18n";
import { getTicketEndpointPlaces } from "./journeyPlace";

export interface JourneySummaryTravelDayEntry {
  journeyId: string;
  title: string;
  rangeLabel: string;
  dayLabel: string;
}

export interface JourneySummaryCalendarDay {
  key: string;
  dateKey: string | null;
  dayNumber: string;
  monthIndex: number | null;
  isCurrentYear: boolean;
  isToday: boolean;
  overlapCount: number;
  entries: JourneySummaryTravelDayEntry[];
}

export interface JourneySummaryCalendarWeek {
  key: string;
  monthLabel: string;
  days: JourneySummaryCalendarDay[];
}

export interface JourneySummaryDestinationStat {
  label: string;
  journeyCount: number;
  dedupedTravelDays: number;
}

export interface JourneySummaryCompanionStat {
  label: string;
  journeyCount: number;
}

export interface JourneySummaryCompanionGroup {
  journeyCount: number;
  labels: string[];
}

export interface JourneySummaryCurrencyStat {
  currency: string;
  totalAmount: number;
  journeyCount: number;
}

export interface JourneySummaryLongestJourney {
  title: string;
  durationDays: number;
  rangeLabel: string;
}

export interface JourneySummaryHighestCostJourney {
  title: string;
  amountLabel: string;
  convertedCny: number;
  convertedLabel: string;
}

export interface JourneySummaryBusiestMonth {
  monthKey: string;
  dedupedTravelDays: number;
}

export interface JourneySummaryBase {
  travelDayEntries: Map<string, JourneySummaryTravelDayEntry[]>;
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

export interface JourneySummaryCalendar {
  selectedYearJourneys: number;
  selectedYearTravelDays: number;
  weeks: JourneySummaryCalendarWeek[];
}

interface JourneyRouteAnchor {
  key: string;
  label: string;
}

interface JourneyPlaceDisplayOptions {
  preferredLanguage?: Language;
}

function normalizeLocationCode(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeLocationName(value: string) {
  return value.trim().toLowerCase();
}

export function sameTicketLocation(left: TicketLocation, right: TicketLocation) {
  const leftCode = normalizeLocationCode(left.code);
  const rightCode = normalizeLocationCode(right.code);

  if (leftCode && rightCode) {
    return leftCode === rightCode;
  }

  return normalizeLocationName(left.name) === normalizeLocationName(right.name);
}

function buildJourneyRouteAnchor(location?: TicketLocation | null): JourneyRouteAnchor | null {
  if (!location) {
    return null;
  }

  const code = normalizeLocationCode(location.code);
  const name = location.name.trim();
  const label = name || location.code?.trim() || "";

  if (!label) {
    return null;
  }

  return {
    key: code ? `code:${code}` : `name:${normalizeLocationName(label)}`,
    label,
  };
}

function buildTicketEndpointAnchors(ticket: TicketRecord, options: JourneyPlaceDisplayOptions = {}) {
  const normalizedEndpoints = getTicketEndpointPlaces(ticket, options);

  if (normalizedEndpoints.origin || normalizedEndpoints.destination) {
    return normalizedEndpoints;
  }

  const segments = ticket.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  if (segments.length === 0) {
    return {
      origin: buildJourneyRouteAnchor(ticket.departure),
      destination: buildJourneyRouteAnchor(ticket.arrival),
    };
  }

  return {
    origin: buildJourneyRouteAnchor(firstSegment?.departure ?? ticket.departure),
    destination: buildJourneyRouteAnchor(lastSegment?.arrival ?? ticket.arrival),
  };
}

function appendCollapsedAnchor(anchors: JourneyRouteAnchor[], anchor: JourneyRouteAnchor | null) {
  if (!anchor) {
    return;
  }

  if (anchors[anchors.length - 1]?.key === anchor.key) {
    return;
  }

  anchors.push(anchor);
}

function dedupeAnchorsByKey(anchors: JourneyRouteAnchor[]) {
  const seen = new Set<string>();
  const deduped: JourneyRouteAnchor[] = [];

  anchors.forEach((anchor) => {
    if (seen.has(anchor.key)) {
      return;
    }
    seen.add(anchor.key);
    deduped.push(anchor);
  });

  return deduped;
}

function dedupeAnchorsByLabel(anchors: JourneyRouteAnchor[]) {
  const seen = new Set<string>();
  const deduped: JourneyRouteAnchor[] = [];

  anchors.forEach((anchor) => {
    const normalizedLabel = anchor.label.trim().toLowerCase();
    if (!normalizedLabel || seen.has(normalizedLabel)) {
      return;
    }

    seen.add(normalizedLabel);
    deduped.push(anchor);
  });

  return deduped;
}

export function parseJourneyDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getJourneyRange(journey: Journey) {
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

export function formatLocalDateKey(date: Date) {
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

export function enumerateJourneyDateKeys(journey: Journey) {
  const range = getJourneyRange(journey);
  if (!range) {
    return [];
  }

  const dates: string[] = [];
  let cursor = formatLocalDateKey(range.start);
  const endKey = formatLocalDateKey(range.end);

  while (cursor <= endKey) {
    dates.push(cursor);
    cursor = incrementDateKey(cursor);
  }

  return dates;
}

export function describeJourneyDay(journey: Journey, dateKey: string) {
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

export function buildJourneySummaryTooltip(dateKey: string, entries: JourneySummaryTravelDayEntry[]) {
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

export function buildJourneySummaryCalendarWeeks(
  year: number,
  dayEntries: Map<string, JourneySummaryTravelDayEntry[]>,
  today = new Date(),
) {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);
  const firstMonday = new Date(firstDay);
  const firstDayOffset = (firstMonday.getDay() + 6) % 7;
  firstMonday.setDate(firstMonday.getDate() - firstDayOffset);
  const lastSunday = new Date(lastDay);
  const lastDayOffset = 6 - ((lastSunday.getDay() + 6) % 7);
  lastSunday.setDate(lastSunday.getDate() + lastDayOffset);

  const todayKey = formatLocalDateKey(today);
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

export function getJourneyYears(journey: Journey) {
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

export function getJourneyMonthsForYear(journey: Journey, year: string) {
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

export function sortJourneysByStartDate(journeys: Journey[]) {
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

export function sortTicketsByTripDate(tickets: TicketRecord[]) {
  return [...tickets].sort((left, right) => {
    const leftDate = left.departureTimeLocal || left.arrivalTimeLocal || left.createdAt || "";
    const rightDate = right.departureTimeLocal || right.arrivalTimeLocal || right.createdAt || "";
    return leftDate.localeCompare(rightDate) || left.createdAt.localeCompare(right.createdAt);
  });
}

export function buildJourneyRouteAnchorsFromTickets(
  linkedTickets: TicketRecord[],
  options: JourneyPlaceDisplayOptions = {},
) {
  const anchors: JourneyRouteAnchor[] = [];

  sortTicketsByTripDate(linkedTickets).forEach((ticket) => {
    const { origin, destination } = buildTicketEndpointAnchors(ticket, options);
    appendCollapsedAnchor(anchors, origin ?? destination);
    appendCollapsedAnchor(anchors, destination);
  });

  return anchors;
}

export function buildJourneyRouteSummaryFromTickets(
  linkedTickets: TicketRecord[],
  options: JourneyPlaceDisplayOptions = {},
) {
  const anchors = buildJourneyRouteAnchorsFromTickets(linkedTickets, options);
  return anchors.length > 0 ? anchors.map((anchor) => anchor.label).join(" -> ") : "No linked route yet";
}

function getJourneyFallbackDestination(journey: Journey) {
  const fallback = journey.destination?.trim();
  return fallback ? [fallback] : [];
}

function deriveVisitedDestinationLabelsFromAnchors(
  anchors: JourneyRouteAnchor[],
  linkedTicketCount: number,
  fallback: string[],
) {
  if (anchors.length < 2) {
    return fallback;
  }

  const intermediateAnchors = dedupeAnchorsByLabel(dedupeAnchorsByKey(anchors.slice(1, -1)));
  if (intermediateAnchors.length > 0) {
    return intermediateAnchors.map((anchor) => anchor.label);
  }

  if (linkedTicketCount === 1) {
    const finalAnchor = anchors[anchors.length - 1];
    const startAnchor = anchors[0];
    if (finalAnchor && finalAnchor.key !== startAnchor?.key) {
      return [finalAnchor.label];
    }
  }

  return fallback;
}

export function deriveVisitedDestinationsFromTickets(
  linkedTickets: TicketRecord[],
  options: JourneyPlaceDisplayOptions = {},
) {
  const anchors = buildJourneyRouteAnchorsFromTickets(linkedTickets, options);
  return deriveVisitedDestinationLabelsFromAnchors(anchors, linkedTickets.length, []);
}

export function deriveVisitedDestinationsForJourney(
  journey: Journey,
  linkedTickets: TicketRecord[],
  options: JourneyPlaceDisplayOptions = {},
) {
  if (linkedTickets.length === 0) {
    return getJourneyFallbackDestination(journey);
  }

  const anchors = buildJourneyRouteAnchorsFromTickets(linkedTickets, options);
  return deriveVisitedDestinationLabelsFromAnchors(anchors, linkedTickets.length, getJourneyFallbackDestination(journey));
}

function formatJourneyDateRangeCompact(journey: Journey) {
  if (journey.startDate && journey.endDate) {
    return journey.startDate === journey.endDate
      ? journey.startDate
      : `${journey.startDate} ~ ${journey.endDate}`;
  }

  return journey.startDate ?? journey.endDate ?? "No date yet";
}

function formatCurrencyAmount(value: number) {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatJourneyCostLabel(journey: Journey) {
  if (typeof journey.costAmount !== "number" || !Number.isFinite(journey.costAmount)) {
    return null;
  }

  const formattedAmount = formatCurrencyAmount(journey.costAmount);
  return journey.costCurrency ? `${journey.costCurrency.toUpperCase()} ${formattedAmount}` : formattedAmount;
}

function buildJourneyTicketMap(tickets: TicketRecord[]) {
  return new Map(tickets.map((ticket) => [ticket.id, ticket]));
}

function getLinkedTicketsForJourney(journey: Journey, ticketsById: Map<string, TicketRecord>) {
  return journey.ticketIds
    .map((ticketId) => ticketsById.get(ticketId))
    .filter((ticket): ticket is TicketRecord => Boolean(ticket));
}

export function buildJourneySummaryBase(
  journeys: Journey[],
  tickets: TicketRecord[],
  currentSummaryYear: string,
  options: JourneyPlaceDisplayOptions = {},
) {
  const ticketsById = buildJourneyTicketMap(tickets);
  const travelDayEntries = new Map<string, JourneySummaryTravelDayEntry[]>();
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
    const linkedTickets = getLinkedTicketsForJourney(journey, ticketsById);
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

    const destinationLabels = deriveVisitedDestinationsForJourney(journey, linkedTickets, options);
    const destinationEntries = destinationLabels.length > 0 ? destinationLabels : ["No destination"];

    destinationEntries.forEach((destinationLabel) => {
      const normalizedLabel = destinationLabel.trim() || "No destination";
      const destinationKey = normalizedLabel.toLowerCase();
      const destinationStat =
        destinationMap.get(destinationKey) ??
        {
          label: normalizedLabel,
          journeyIds: new Set<string>(),
          travelDays: new Set<string>(),
        };

      destinationStat.journeyIds.add(journey.id);
      journeyDateKeys.forEach((dateKey) => destinationStat.travelDays.add(dateKey));
      destinationMap.set(destinationKey, destinationStat);
    });

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
            amountLabel: formatJourneyCostLabel(journey) ?? formatCurrencyAmount(journey.costAmount),
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
            amountLabel: formatJourneyCostLabel(journey) ?? `${costCurrency} ${formatCurrencyAmount(journey.costAmount)}`,
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
}

export function buildJourneySummaryCalendar(summaryBase: JourneySummaryBase, summaryYear: string, today = new Date()) {
  const selectedYearJourneys = summaryBase.journeysByYear.get(summaryYear)?.size ?? 0;
  const selectedYearEntries = new Map<string, JourneySummaryTravelDayEntry[]>();

  summaryBase.travelDayEntries.forEach((entries, dateKey) => {
    if (dateKey.startsWith(`${summaryYear}-`)) {
      selectedYearEntries.set(dateKey, entries);
    }
  });

  return {
    selectedYearJourneys,
    selectedYearTravelDays: selectedYearEntries.size,
    weeks: buildJourneySummaryCalendarWeeks(Number.parseInt(summaryYear, 10), selectedYearEntries, today),
  };
}
