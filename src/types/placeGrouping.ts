export type PlaceGroupingLevel =
  | "municipality"
  | "prefecture"
  | "league"
  | "autonomous_prefecture";

export type PlaceGroupingSource = "reviewed" | "generated";

export interface PlaceGroupingSourceEntry {
  placeKey: string;
  summaryPlaceKey: string;
  groupingLevel: PlaceGroupingLevel;
  notes?: string;
}

export interface PlaceGroupingEntry {
  placeKey: string;
  summaryPlaceKey: string;
  summaryPlaceNameZh?: string;
  summaryPlaceNameEn?: string;
  groupingLevel: PlaceGroupingLevel;
  groupingSource: PlaceGroupingSource;
  notes?: string;
}

export type PlaceGroupingData = PlaceGroupingEntry[];
