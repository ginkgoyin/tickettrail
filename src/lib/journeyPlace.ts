import airports from "../data/airports.generated.json";
import airportAliasesZhCN from "../data/airport-aliases.zh-CN";
import railStations from "../data/rail-stations.generated.json";
import type { Language } from "./i18n";
import { getTransportPlaceMapping } from "./transportPlaceMapping";
import type { TicketLocation, TicketRecord, TicketType, LocationDirectoryEntry } from "../types/ticket";

export interface JourneyPlace {
  placeKey: string;
  displayName: string;
  displayNameZh?: string;
  displayNameEn?: string;
  countryCode?: string;
  source: "airport" | "rail_station" | "fallback";
  confidence: "high" | "medium" | "low";
}

export interface JourneyPlaceNormalizationOptions {
  preferredLanguage?: Language;
  ticketType?: TicketType;
}

interface JourneyPlaceAnchor {
  key: string;
  label: string;
}

interface LocationPlaceIndex {
  source: "airport" | "rail_station";
  byCode: Map<string, LocationDirectoryEntry>;
  byToken: Map<string, LocationDirectoryEntry>;
}

function normalizeToken(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function dedupeStrings(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  values.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(trimmed);
  });

  return deduped;
}

function sanitizeJourneyPlaceDisplayName(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .replace(/\s+\([^()]+\)$/u, "")
    .trim();
}

function slugifyPlaceKeySegment(value?: string) {
  const normalized = sanitizeJourneyPlaceDisplayName(value)
    ?.toLowerCase()
    .replace(/\([^()]*\)/gu, " ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || undefined;
}

function stripAirportSuffixZh(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .replace(/国际机场$/u, "")
    .replace(/國際機場$/u, "")
    .replace(/机场$/u, "")
    .replace(/機場$/u, "")
    .trim();
}

function looksMostlyChinese(value?: string) {
  return Boolean(value && /[\u3400-\u9fff]/u.test(value));
}

function expandSearchTokens(values: Array<string | undefined>) {
  return dedupeStrings(
    values.flatMap((value) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return [];
      }

      return trimmed.split(",").map((part) => part.trim());
    }),
  );
}

function createAirportEntries() {
  return (airports as LocationDirectoryEntry[]).map((entry) => {
    const overlay = entry.code ? airportAliasesZhCN[entry.code.toUpperCase()] : undefined;

    return {
      ...entry,
      nameZh: overlay?.nameZh ?? entry.nameZh,
      aliases: dedupeStrings([...(entry.aliases ?? []), ...(overlay?.aliases ?? [])]),
    };
  });
}

function indexLocationEntry(index: LocationPlaceIndex, entry: LocationDirectoryEntry) {
  const code = normalizeToken(entry.code);
  if (code) {
    index.byCode.set(code, entry);
  }

  expandSearchTokens([
    entry.code,
    entry.nameEn,
    entry.nameZh,
    entry.municipality,
    entry.placeNameEn,
    entry.placeNameZh,
    ...(entry.aliases ?? []),
  ]).forEach((token) => {
    const normalized = normalizeToken(token);
    if (!normalized || index.byToken.has(normalized)) {
      return;
    }

    index.byToken.set(normalized, entry);
  });
}

function createLocationPlaceIndex(entries: LocationDirectoryEntry[], source: "airport" | "rail_station") {
  const index: LocationPlaceIndex = {
    source,
    byCode: new Map<string, LocationDirectoryEntry>(),
    byToken: new Map<string, LocationDirectoryEntry>(),
  };

  entries.forEach((entry) => indexLocationEntry(index, entry));
  return index;
}

const AIRPORT_PLACE_INDEX = createLocationPlaceIndex(createAirportEntries(), "airport");
const RAIL_PLACE_INDEX = createLocationPlaceIndex(railStations as LocationDirectoryEntry[], "rail_station");

function getAirportConfidence(entry: LocationDirectoryEntry): JourneyPlace["confidence"] {
  if (entry.placeKey && (entry.placeNameEn || entry.municipality)) {
    return "high";
  }
  return "low";
}

function deriveAirportDisplayNameZh(entry: LocationDirectoryEntry) {
  const candidates = dedupeStrings([
    stripAirportSuffixZh(entry.placeNameZh),
    ...((entry.aliases ?? [])
      .filter((alias) => looksMostlyChinese(alias))
      .map((alias) => stripAirportSuffixZh(alias))),
    stripAirportSuffixZh(entry.nameZh),
  ]);

  const cityLikeCandidates = candidates.filter((candidate) => candidate && !/机场|機場/u.test(candidate));
  const preferredCandidates = cityLikeCandidates.length > 0 ? cityLikeCandidates : candidates;

  return preferredCandidates
    .slice()
    .sort((left, right) => left.length - right.length)[0];
}

function buildCanonicalAirportPlaceKey(
  entry: LocationDirectoryEntry,
  displayNameEn?: string,
  displayNameZh?: string,
  fallbackDisplayName?: string,
) {
  const countryCode = entry.countryCode?.trim().toLowerCase();
  const canonicalSegment = slugifyPlaceKeySegment(displayNameEn || displayNameZh || fallbackDisplayName);

  if (countryCode && canonicalSegment) {
    return `${countryCode}-${canonicalSegment}`;
  }

  return entry.placeKey?.trim();
}

function getMappedPlace(entry: LocationDirectoryEntry, source: "airport" | "rail_station", preferredLanguage: Language) {
  const mapping = getTransportPlaceMapping(source, entry.code);
  if (!mapping) {
    return null;
  }

  const displayNameZh = sanitizeJourneyPlaceDisplayName(mapping.defaultJourneyPlaceNameZh?.trim()) || undefined;
  const displayNameEn = sanitizeJourneyPlaceDisplayName(mapping.defaultJourneyPlaceNameEn?.trim()) || undefined;
  const displayName =
    preferredLanguage === "zh"
      ? displayNameZh || displayNameEn || entry.nameZh?.trim() || entry.nameEn?.trim() || entry.code?.trim() || ""
      : displayNameEn || displayNameZh || entry.nameEn?.trim() || entry.nameZh?.trim() || entry.code?.trim() || "";

  if (!displayName) {
    return null;
  }

  return {
    placeKey: mapping.defaultJourneyPlaceKey,
    displayName,
    displayNameZh,
    displayNameEn,
    countryCode: entry.countryCode?.trim() || undefined,
    source,
    confidence: mapping.mappingConfidence,
  } satisfies JourneyPlace;
}

function getLegacyMatchedPlace(
  entry: LocationDirectoryEntry,
  source: "airport" | "rail_station",
  preferredLanguage: Language,
) {
  const displayNameZh =
    (source === "airport"
      ? sanitizeJourneyPlaceDisplayName(deriveAirportDisplayNameZh(entry))
      : sanitizeJourneyPlaceDisplayName(entry.placeNameZh?.trim())) || undefined;
  const displayNameEn =
    sanitizeJourneyPlaceDisplayName(entry.placeNameEn?.trim()) ||
    sanitizeJourneyPlaceDisplayName(entry.municipality?.trim()) ||
    sanitizeJourneyPlaceDisplayName(entry.nameEn?.trim()) ||
    undefined;
  const displayName =
    preferredLanguage === "zh"
      ? displayNameZh || displayNameEn || entry.nameZh?.trim() || entry.nameEn?.trim() || entry.code?.trim() || ""
      : displayNameEn || displayNameZh || entry.nameEn?.trim() || entry.nameZh?.trim() || entry.code?.trim() || "";

  if (!displayName) {
    return null;
  }

  return {
    placeKey:
      (source === "airport"
        ? buildCanonicalAirportPlaceKey(entry, displayNameEn, displayNameZh, displayName)
        : entry.placeKey?.trim()) ||
      (entry.code?.trim() ? `${source}:${entry.code.trim().toLowerCase()}` : `${source}:${normalizeToken(displayName)}`),
    displayName,
    displayNameZh,
    displayNameEn,
    countryCode: entry.countryCode?.trim() || undefined,
    source,
    confidence: source === "airport" ? getAirportConfidence(entry) : entry.placeConfidence ?? "low",
  } satisfies JourneyPlace;
}

function findLocationPlaceMatch(index: LocationPlaceIndex, location: TicketLocation) {
  const code = normalizeToken(location.code);
  if (code) {
    const codeMatch = index.byCode.get(code);
    if (codeMatch) {
      return codeMatch;
    }
  }

  const name = normalizeToken(location.name);
  return name ? index.byToken.get(name) ?? null : null;
}

function getCandidateIndexes(ticketType?: TicketType) {
  if (ticketType === "flight") {
    return [AIRPORT_PLACE_INDEX];
  }
  if (ticketType === "train") {
    return [RAIL_PLACE_INDEX];
  }

  return [AIRPORT_PLACE_INDEX, RAIL_PLACE_INDEX];
}

export function normalizeJourneyPlaceFromLocation(
  location?: TicketLocation | null,
  options: JourneyPlaceNormalizationOptions = {},
): JourneyPlace | null {
  if (!location) {
    return null;
  }

  const preferredLanguage = options.preferredLanguage ?? "en";

  for (const index of getCandidateIndexes(options.ticketType)) {
    const matchedEntry = findLocationPlaceMatch(index, location);
    if (!matchedEntry) {
      continue;
    }

    const matchedPlace =
      getMappedPlace(matchedEntry, index.source, preferredLanguage)
      ?? getLegacyMatchedPlace(matchedEntry, index.source, preferredLanguage);
    if (matchedPlace) {
      return matchedPlace;
    }
  }

  const fallbackLabel = location.name.trim() || location.code?.trim() || "";
  if (!fallbackLabel) {
    return null;
  }

  return {
    placeKey: location.code?.trim()
      ? `fallback:${location.code.trim().toLowerCase()}`
      : `fallback:${normalizeToken(fallbackLabel)}`,
    displayName: fallbackLabel,
    countryCode: undefined,
    source: "fallback",
    confidence: "low",
  };
}

export function buildJourneyPlaceAnchorFromLocation(
  location?: TicketLocation | null,
  options: JourneyPlaceNormalizationOptions = {},
): JourneyPlaceAnchor | null {
  const place = normalizeJourneyPlaceFromLocation(location, options);
  if (!place) {
    return null;
  }

  return {
    key: place.placeKey,
    label: place.displayName,
  };
}

export function getTicketEndpointPlaces(ticket: TicketRecord, options: JourneyPlaceNormalizationOptions = {}) {
  const ticketOptions = {
    ...options,
    ticketType: ticket.ticketType,
  } satisfies JourneyPlaceNormalizationOptions;

  const segments = ticket.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const originLocation = firstSegment?.departure ?? ticket.departure;
  const destinationLocation = lastSegment?.arrival ?? ticket.arrival;

  return {
    origin: buildJourneyPlaceAnchorFromLocation(originLocation, ticketOptions),
    destination: buildJourneyPlaceAnchorFromLocation(destinationLocation, ticketOptions),
  };
}

export function getTicketEndpointJourneyPlaces(
  ticket: TicketRecord,
  options: JourneyPlaceNormalizationOptions = {},
) {
  const ticketOptions = {
    ...options,
    ticketType: ticket.ticketType,
  } satisfies JourneyPlaceNormalizationOptions;

  const segments = ticket.segments ?? [];
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const originLocation = firstSegment?.departure ?? ticket.departure;
  const destinationLocation = lastSegment?.arrival ?? ticket.arrival;

  return {
    origin: normalizeJourneyPlaceFromLocation(originLocation, ticketOptions),
    destination: normalizeJourneyPlaceFromLocation(destinationLocation, ticketOptions),
  };
}
