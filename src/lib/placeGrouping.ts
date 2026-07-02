import groupingData from "../data/place-grouping.generated.json";
import type { PlaceGroupingData, PlaceGroupingEntry } from "../types/placeGrouping";

const PLACE_GROUPING_DATA = groupingData as PlaceGroupingData;
const PLACE_GROUPING_INDEX = new Map<string, PlaceGroupingEntry>(
  PLACE_GROUPING_DATA.map((entry) => [entry.placeKey, entry]),
);

function normalizePlaceKey(value?: string | null) {
  return (value ?? "").trim();
}

export function listPlaceGroupings() {
  return PLACE_GROUPING_DATA;
}

export function getSummaryGroupingForPlaceKey(placeKey?: string | null) {
  const normalizedPlaceKey = normalizePlaceKey(placeKey);
  if (!normalizedPlaceKey) {
    return null;
  }

  return PLACE_GROUPING_INDEX.get(normalizedPlaceKey) ?? null;
}

export function resolveSummaryPlaceKey(placeKey?: string | null) {
  return getSummaryGroupingForPlaceKey(placeKey)?.summaryPlaceKey ?? null;
}
