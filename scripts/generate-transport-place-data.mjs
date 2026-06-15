import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AIRPORT_PLACE_OVERRIDES, RAIL_STATION_PLACE_OVERRIDES } from "./data/transport-place-overrides.mjs";

const DEFAULT_AIRPORTS_PATH = path.resolve("src/data/airports.generated.json");
const DEFAULT_RAIL_STATIONS_PATH = path.resolve("src/data/rail-stations.generated.json");
const DEFAULT_PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_OUTPUT_PATH = path.resolve("src/data/transport-place.generated.json");

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizePlaceLookupValue(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^()]*\)/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "")
    .trim();
}

function collapseDuplicatePlaceKeySegments(value) {
  const segments = normalizeText(value).toLowerCase().split("-").filter(Boolean);
  if (segments.length < 3) {
    return undefined;
  }

  const [countryCode, ...placeSegments] = segments;
  if (new Set(placeSegments).size !== 1) {
    return undefined;
  }

  return `${countryCode}-${placeSegments[0]}`;
}

function stripChineseCitySuffix(value) {
  const trimmed = normalizeText(value);
  if (trimmed.endsWith("市") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

function getAirportCandidateValues(entry) {
  const values = [];
  const pushValue = (value, source, confidence = "high") => {
    const trimmed = normalizeText(value);
    if (!trimmed) {
      return;
    }

    values.push({ value: trimmed, source, confidence });

    const withoutParenthetical = normalizeText(trimmed.replace(/\([^()]*\)/g, " "));
    if (withoutParenthetical && withoutParenthetical !== trimmed) {
      values.push({
        value: withoutParenthetical,
        source: `${source}:without-parenthetical`,
        confidence: confidence === "high" ? "medium" : confidence,
      });
    }
  };

  pushValue(entry.placeNameEn, "airport.placeNameEn");
  pushValue(entry.municipality, "airport.municipality");

  return values;
}

function getRailCandidateValues(entry) {
  const values = [];
  const baseConfidence = entry.placeConfidence === "high" ? "high" : "medium";

  const pushValue = (value, source) => {
    const trimmed = normalizeText(value);
    if (!trimmed) {
      return;
    }

    values.push({ value: trimmed, source, confidence: baseConfidence });
  };

  pushValue(entry.placeNameZh, "rail.placeNameZh");
  pushValue(stripChineseCitySuffix(entry.placeNameZh), "rail.placeNameZh:without-city-suffix");
  pushValue(entry.placeNameEn, "rail.placeNameEn");
  pushValue(entry.pinyin, "rail.pinyin");

  return values;
}

function addUniqueValue(values, value) {
  if (!value) {
    return;
  }

  if (!values.includes(value)) {
    values.push(value);
  }
}

function addPlaceIndexValue(index, countryCode, rawValue, place) {
  const normalizedCountry = normalizeCode(countryCode);
  const normalizedValue = normalizePlaceLookupValue(rawValue);
  if (!normalizedCountry || !normalizedValue) {
    return;
  }

  const key = `${normalizedCountry}:${normalizedValue}`;
  if (!index.has(key)) {
    index.set(key, place);
    return;
  }

  const existing = index.get(key);
  if (existing && existing.placeKey !== place.placeKey) {
    index.set(key, null);
  }
}

function buildPlaceIndex(places) {
  const byKey = new Map();
  const byCountryAndName = new Map();

  for (const place of places) {
    byKey.set(place.placeKey, place);

    const candidateValues = [];
    addUniqueValue(candidateValues, place.nameEn);
    addUniqueValue(candidateValues, place.asciiName);
    addUniqueValue(candidateValues, place.nameZh);
    addUniqueValue(candidateValues, stripChineseCitySuffix(place.nameZh));

    for (const value of candidateValues) {
      addPlaceIndexValue(byCountryAndName, place.countryCode, value, place);
    }
  }

  return { byKey, byCountryAndName };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function buildMappingEntry(place, source, confidence) {
  return {
    defaultJourneyPlaceKey: place.placeKey,
    mappingSource: source,
    mappingConfidence: confidence,
  };
}

function findPlaceByCountryAndValue(placeIndex, countryCode, value) {
  const key = `${normalizeCode(countryCode)}:${normalizePlaceLookupValue(value)}`;
  const matched = placeIndex.byCountryAndName.get(key);
  return matched || null;
}

function mapAirportEntry(entry, placeIndex) {
  const code = normalizeCode(entry.code);
  if (!code || !entry.countryCode) {
    return null;
  }

  const overridePlaceKey = AIRPORT_PLACE_OVERRIDES[code];
  if (overridePlaceKey) {
    const overridePlace = placeIndex.byKey.get(overridePlaceKey);
    if (!overridePlace) {
      throw new Error(`Airport override ${code} points to missing placeKey ${overridePlaceKey}`);
    }

    return buildMappingEntry(overridePlace, "override", "high");
  }

  const existingPlaceKey = normalizeText(entry.placeKey);
  if (existingPlaceKey && placeIndex.byKey.has(existingPlaceKey)) {
    return buildMappingEntry(placeIndex.byKey.get(existingPlaceKey), "airport.placeKey", "high");
  }

  const collapsedPlaceKey = collapseDuplicatePlaceKeySegments(existingPlaceKey);
  if (collapsedPlaceKey && placeIndex.byKey.has(collapsedPlaceKey)) {
    return buildMappingEntry(
      placeIndex.byKey.get(collapsedPlaceKey),
      "airport.placeKey:collapsed-duplicate-segments",
      "high",
    );
  }

  for (const candidate of getAirportCandidateValues(entry)) {
    const matchedPlace = findPlaceByCountryAndValue(placeIndex, entry.countryCode, candidate.value);
    if (matchedPlace) {
      return buildMappingEntry(matchedPlace, candidate.source, candidate.confidence);
    }
  }

  return null;
}

function mapRailEntry(entry, placeIndex) {
  const code = normalizeCode(entry.code);
  if (!code || !entry.countryCode) {
    return null;
  }

  const overridePlaceKey = RAIL_STATION_PLACE_OVERRIDES[code];
  if (overridePlaceKey) {
    const overridePlace = placeIndex.byKey.get(overridePlaceKey);
    if (!overridePlace) {
      throw new Error(`Rail override ${code} points to missing placeKey ${overridePlaceKey}`);
    }

    return buildMappingEntry(overridePlace, "override", "high");
  }

  if (entry.placeConfidence === "low") {
    return null;
  }

  const existingPlaceKey = normalizeText(entry.placeKey);
  if (existingPlaceKey && placeIndex.byKey.has(existingPlaceKey)) {
    return buildMappingEntry(placeIndex.byKey.get(existingPlaceKey), "rail.placeKey", entry.placeConfidence);
  }

  for (const candidate of getRailCandidateValues(entry)) {
    const matchedPlace = findPlaceByCountryAndValue(placeIndex, entry.countryCode, candidate.value);
    if (matchedPlace) {
      return buildMappingEntry(matchedPlace, candidate.source, candidate.confidence);
    }
  }

  return null;
}

function validateMappings(mappings, placesByKey) {
  for (const [code, mapping] of Object.entries(mappings.airports)) {
    if (!placesByKey.has(mapping.defaultJourneyPlaceKey)) {
      throw new Error(`Airport ${code} points to missing placeKey ${mapping.defaultJourneyPlaceKey}`);
    }
  }

  for (const [code, mapping] of Object.entries(mappings.railStations)) {
    if (!placesByKey.has(mapping.defaultJourneyPlaceKey)) {
      throw new Error(`Rail station ${code} points to missing placeKey ${mapping.defaultJourneyPlaceKey}`);
    }
  }
}

async function main() {
  const airportsPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_AIRPORTS_PATH;
  const railStationsPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_RAIL_STATIONS_PATH;
  const placeCatalogPath = process.argv[4] ? path.resolve(process.argv[4]) : DEFAULT_PLACE_CATALOG_PATH;
  const outputPath = process.argv[5] ? path.resolve(process.argv[5]) : DEFAULT_OUTPUT_PATH;

  const [airports, railStations, places] = await Promise.all([
    readJson(airportsPath),
    readJson(railStationsPath),
    readJson(placeCatalogPath),
  ]);

  const placeIndex = buildPlaceIndex(places);
  const mappings = {
    airports: {},
    railStations: {},
    places: {},
  };

  for (const airport of airports) {
    const mapping = mapAirportEntry(airport, placeIndex);
    if (mapping) {
      mappings.airports[normalizeCode(airport.code)] = mapping;
      const place = placeIndex.byKey.get(mapping.defaultJourneyPlaceKey);
      mappings.places[mapping.defaultJourneyPlaceKey] = {
        nameEn: place.nameEn || place.asciiName || place.placeKey,
        nameZh: place.nameZh || undefined,
      };
    }
  }

  for (const station of railStations) {
    const mapping = mapRailEntry(station, placeIndex);
    if (mapping) {
      mappings.railStations[normalizeCode(station.code)] = mapping;
      const place = placeIndex.byKey.get(mapping.defaultJourneyPlaceKey);
      mappings.places[mapping.defaultJourneyPlaceKey] = {
        nameEn: place.nameEn || place.asciiName || place.placeKey,
        nameZh: place.nameZh || undefined,
      };
    }
  }

  validateMappings(mappings, placeIndex.byKey);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(mappings)}\n`, "utf8");

  const outputStat = await stat(outputPath);
  console.log(`Generated transport-place mapping -> ${outputPath}`);
  console.log(`Mapped airports: ${Object.keys(mappings.airports).length}/${airports.length}`);
  console.log(`Mapped rail stations: ${Object.keys(mappings.railStations).length}/${railStations.length}`);
  console.log(`Unmapped airports: ${airports.length - Object.keys(mappings.airports).length}`);
  console.log(`Unmapped rail stations: ${railStations.length - Object.keys(mappings.railStations).length}`);
  console.log(`Output size: ${outputStat.size} bytes`);
}

await main();
