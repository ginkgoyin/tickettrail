import placeCatalogData from "../data/place-catalog.generated.json";
import type { Language } from "./i18n";
import type { PlaceCatalogEntry, SearchPlaceCatalogOptions } from "../types/placeCatalog";

const PLACE_CATALOG = placeCatalogData as PlaceCatalogEntry[];

function normalizeToken(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getPlaceSearchTerms(place: PlaceCatalogEntry) {
  return [
    place.placeKey,
    place.sourceId,
    place.countryCode,
    place.nameEn,
    place.nameZh,
    place.asciiName,
    ...(place.aliases ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

let placeCatalogByKey: Map<string, PlaceCatalogEntry> | null = null;
let placeCatalogByGeoNameId: Map<number, PlaceCatalogEntry> | null = null;

function getPlaceCatalogByKey() {
  if (!placeCatalogByKey) {
    placeCatalogByKey = new Map(PLACE_CATALOG.map((place) => [place.placeKey, place]));
  }

  return placeCatalogByKey;
}

function getPlaceCatalogByGeoNameId() {
  if (!placeCatalogByGeoNameId) {
    placeCatalogByGeoNameId = new Map(PLACE_CATALOG.map((place) => [place.geonameId, place]));
  }

  return placeCatalogByGeoNameId;
}

export function listPlaceCatalog() {
  return PLACE_CATALOG;
}

export function getPlaceByKey(placeKey: string) {
  return getPlaceCatalogByKey().get(placeKey);
}

export function getPlaceByGeoNameId(geonameId: number) {
  return getPlaceCatalogByGeoNameId().get(geonameId);
}

export function getPlaceDisplayName(place: PlaceCatalogEntry, language: Language = "en") {
  if (language === "zh") {
    return place.nameZh?.trim() || place.nameEn?.trim() || place.asciiName?.trim() || place.placeKey;
  }

  return place.nameEn?.trim() || place.asciiName?.trim() || place.nameZh?.trim() || place.placeKey;
}

export function getPlaceDisplayNameByKey(placeKey: string, language: Language = "en") {
  const place = getPlaceByKey(placeKey);
  return place ? getPlaceDisplayName(place, language) : undefined;
}

export function searchPlaceCatalog(query: string, options: SearchPlaceCatalogOptions = {}) {
  const normalizedQuery = normalizeToken(query);
  const normalizedCountryCode = normalizeToken(options.countryCode);
  const limit = Math.max(1, options.limit ?? 8);

  const filtered = PLACE_CATALOG.filter((place) => {
    if (normalizedCountryCode && normalizeToken(place.countryCode) !== normalizedCountryCode) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return getPlaceSearchTerms(place).some((term) => normalizeToken(term).includes(normalizedQuery));
  });

  return filtered
    .sort((left, right) => {
      const leftDisplay = getPlaceDisplayName(left, options.language ?? "en");
      const rightDisplay = getPlaceDisplayName(right, options.language ?? "en");

      return (
        leftDisplay.localeCompare(rightDisplay, "en") ||
        left.countryCode.localeCompare(right.countryCode, "en") ||
        left.geonameId - right.geonameId
      );
    })
    .slice(0, limit);
}
