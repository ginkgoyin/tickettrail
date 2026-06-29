import { readFile } from "node:fs/promises";

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeGroupValue(value) {
  return normalizeText(value);
}

function isOverrideEnabled(override) {
  return override.enabled !== false;
}

function isApprovedOverride(override) {
  return isOverrideEnabled(override) && normalizeText(override.reviewStatus) === "approved";
}

function ensureArray(value, filePath) {
  if (!Array.isArray(value)) {
    throw new Error(`Rail station place overrides must be an array: ${filePath}`);
  }

  return value;
}

export async function readRailStationPlaceOverrides(filePath) {
  const source = await readFile(filePath, "utf8");
  return ensureArray(JSON.parse(source), filePath);
}

export function buildRailStationPlaceGroupKey(placeKey, placeNameZh, placeNameEn) {
  return [
    normalizeGroupValue(placeKey),
    normalizeGroupValue(placeNameZh),
    normalizeGroupValue(placeNameEn),
  ].join("||");
}

function overrideMatchesStation(override, station) {
  const scope = normalizeText(override.scope);

  if (scope === "telecode") {
    return normalizeCode(override.telecode) === normalizeCode(station.code);
  }

  if (scope === "stationNameZh") {
    return normalizeText(override.stationNameZh) === normalizeText(station.nameZh);
  }

  if (scope === "placeGroup") {
    const stationGroupKey = buildRailStationPlaceGroupKey(
      station.placeKey,
      station.placeNameZh,
      station.placeNameEn,
    );
    const overrideGroupKey = buildRailStationPlaceGroupKey(
      override.currentPlaceKey,
      override.currentPlaceNameZh,
      override.currentPlaceNameEn,
    );
    return stationGroupKey === overrideGroupKey;
  }

  return false;
}

function validateOverrideShape(override, index) {
  const label = normalizeText(override.id) || `index ${index}`;
  const scope = normalizeText(override.scope);
  const reviewStatus = normalizeText(override.reviewStatus);

  if (!scope || !["telecode", "stationNameZh", "placeGroup"].includes(scope)) {
    return [`Override ${label} has invalid scope "${scope}".`];
  }

  if (!reviewStatus || !["approved", "needs_review", "rejected"].includes(reviewStatus)) {
    return [`Override ${label} has invalid reviewStatus "${reviewStatus}".`];
  }

  if (scope === "telecode" && !normalizeCode(override.telecode)) {
    return [`Override ${label} uses telecode scope but is missing telecode.`];
  }

  if (scope === "stationNameZh" && !normalizeText(override.stationNameZh)) {
    return [`Override ${label} uses stationNameZh scope but is missing stationNameZh.`];
  }

  if (scope === "placeGroup" && !buildRailStationPlaceGroupKey(
    override.currentPlaceKey,
    override.currentPlaceNameZh,
    override.currentPlaceNameEn,
  ).replace(/\|/g, "")) {
    return [`Override ${label} uses placeGroup scope but does not identify a place group.`];
  }

  return [];
}

export function validateRailStationPlaceOverrides(overrides, stations, placeCatalogEntries) {
  const errors = [];
  const approvedOverrides = [];
  const placeKeys = new Set(placeCatalogEntries.map((entry) => normalizeText(entry.placeKey)).filter(Boolean));
  const ids = new Set();

  overrides.forEach((override, index) => {
    errors.push(...validateOverrideShape(override, index));

    const id = normalizeText(override.id);
    if (id) {
      if (ids.has(id)) {
        errors.push(`Duplicate override id "${id}".`);
      }
      ids.add(id);
    }

    if (!isApprovedOverride(override)) {
      return;
    }

    if (!placeKeys.has(normalizeText(override.reviewedPlaceKey))) {
      errors.push(
        `Approved override ${id || `index ${index}`} points to missing Place Catalog key "${normalizeText(override.reviewedPlaceKey)}".`,
      );
    }

    approvedOverrides.push(override);
  });

  const matchedByOverrideId = new Map();
  const stationMatches = new Map();

  approvedOverrides.forEach((override, overrideIndex) => {
    const overrideId = normalizeText(override.id) || `approved-${overrideIndex + 1}`;
    const matchedStations = stations.filter((station) => overrideMatchesStation(override, station));

    if (matchedStations.length === 0) {
      errors.push(`Approved override ${overrideId} does not match any generated rail station.`);
      return;
    }

    matchedByOverrideId.set(overrideId, matchedStations.map((station) => normalizeCode(station.code)));

    matchedStations.forEach((station) => {
      const code = normalizeCode(station.code);
      const existing = stationMatches.get(code) ?? [];
      existing.push(overrideId);
      stationMatches.set(code, existing);
    });
  });

  stationMatches.forEach((overrideIds, code) => {
    if (overrideIds.length > 1) {
      errors.push(`Generated rail station ${code} matches multiple approved overrides: ${overrideIds.join(", ")}.`);
    }
  });

  return {
    errors,
    approvedOverrides,
    approvedOverrideCount: approvedOverrides.length,
    activeOverrideCount: overrides.filter(isOverrideEnabled).length,
    totalOverrideCount: overrides.length,
    matchedByOverrideId,
  };
}

export function applyRailStationPlaceOverrides(stations, overrides, placeCatalogEntries) {
  const validation = validateRailStationPlaceOverrides(overrides, stations, placeCatalogEntries);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("\n"));
  }

  const placeByKey = new Map(placeCatalogEntries.map((entry) => [normalizeText(entry.placeKey), entry]));
  const approvedOverrides = validation.approvedOverrides;
  let appliedCount = 0;

  const nextStations = stations.map((station) => {
    const matches = approvedOverrides.filter((override) => overrideMatchesStation(override, station));
    if (matches.length === 0) {
      return station;
    }

    const override = matches[0];
    const place = placeByKey.get(normalizeText(override.reviewedPlaceKey));
    if (!place) {
      throw new Error(`Approved override ${normalizeText(override.id)} points to missing Place Catalog entry.`);
    }

    appliedCount += 1;
    return {
      ...station,
      placeKey: place.placeKey,
      placeNameZh: place.nameZh || station.placeNameZh,
      placeNameEn: place.nameEn || place.asciiName || station.placeNameEn,
      placeConfidence: "high",
      placeRule: `${normalizeText(station.placeRule) || "derived"}+reviewed-override:${normalizeText(override.scope)}`,
    };
  });

  return {
    stations: nextStations,
    appliedCount,
    validation,
  };
}
