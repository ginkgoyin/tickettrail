import type { Language } from "../lib/i18n";

export type PlaceCatalogCoordinatePrecision = "city";
export type PlaceCatalogConfidence = "high" | "medium" | "low";

export interface PlaceCatalogEntry {
  placeKey: string;
  geonameId: number;
  nameZh?: string;
  nameEn?: string;
  asciiName?: string;
  countryCode: string;
  admin1Code?: string;
  admin2Code?: string;
  regionName?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
  aliases?: string[];
  source: "geonames";
  sourceId: string;
  coordinatePrecision: PlaceCatalogCoordinatePrecision;
  confidence: PlaceCatalogConfidence;
}

export interface SearchPlaceCatalogOptions {
  countryCode?: string;
  language?: Language;
  limit?: number;
}
