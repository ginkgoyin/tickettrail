function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase();
}

function escapeCsv(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  if (!/[",\r\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function createBucketMap() {
  return new Map();
}

function pushIndexedValue(index, key, value) {
  const normalizedKey = normalizeText(key);
  if (!normalizedKey) {
    return;
  }

  const existing = index.get(normalizedKey) ?? [];
  existing.push(value);
  index.set(normalizedKey, existing);
}

export function buildRailPlaceCatalogResolver(placeCatalogEntries) {
  const chinaPlaces = placeCatalogEntries.filter((entry) => normalizeToken(entry.countryCode) === "cn");
  const byKey = new Map(chinaPlaces.map((entry) => [entry.placeKey, entry]));
  const byNameZh = createBucketMap();
  const byNameEn = createBucketMap();
  const byAsciiName = createBucketMap();
  const byAlias = createBucketMap();

  for (const entry of chinaPlaces) {
    pushIndexedValue(byNameZh, entry.nameZh, entry);
    pushIndexedValue(byNameEn, normalizeToken(entry.nameEn), entry);
    pushIndexedValue(byAsciiName, normalizeToken(entry.asciiName), entry);

    for (const alias of entry.aliases ?? []) {
      pushIndexedValue(byAlias, normalizeToken(alias), entry);
    }
  }

  return {
    byKey,
    byNameZh,
    byNameEn,
    byAsciiName,
    byAlias,
  };
}

function uniqueMatch(matches) {
  return matches.length === 1 ? matches[0] : null;
}

function getRailStationTransportMapping(transportPlaceData, code) {
  if (!transportPlaceData?.railStations) {
    return null;
  }

  return transportPlaceData.railStations[normalizeText(code).toUpperCase()] ?? null;
}

function resolveByTransportMapping(station, resolver, transportPlaceData) {
  const mapping = getRailStationTransportMapping(transportPlaceData, station.code);
  if (!mapping?.defaultJourneyPlaceKey) {
    return null;
  }

  const place = resolver.byKey.get(mapping.defaultJourneyPlaceKey);
  if (!place) {
    return null;
  }

  return {
    status: "resolved",
    resolutionType: "transport_mapping",
    issueType: "resolved_transport_mapping",
    reviewStatus: "auto-resolved",
    canonicalPlaceKey: place.placeKey,
    canonicalPlaceNameZh: place.nameZh || station.placeNameZh || station.nameZh,
    canonicalPlaceNameEn: place.nameEn || place.asciiName || station.placeNameEn || station.nameEn,
    resolvedPlace: place,
  };
}

function resolveByExactKey(station, resolver) {
  const currentPlaceKey = normalizeText(station.placeKey);
  if (!currentPlaceKey) {
    return null;
  }

  const place = resolver.byKey.get(currentPlaceKey);
  if (!place) {
    return null;
  }

  return {
    status: "resolved",
    resolutionType: "exact_place_key",
    issueType: station.placeConfidence === "low" ? "low_confidence" : "valid_place_key",
    reviewStatus: station.placeConfidence === "low" ? "needs-review" : "resolved",
    canonicalPlaceKey: place.placeKey,
    canonicalPlaceNameZh: place.nameZh || station.placeNameZh || station.nameZh,
    canonicalPlaceNameEn: place.nameEn || place.asciiName || station.placeNameEn || station.nameEn,
    resolvedPlace: place,
  };
}

function resolveByPlaceNameZh(station, resolver) {
  const matches = resolver.byNameZh.get(normalizeText(station.placeNameZh)) ?? [];
  const place = uniqueMatch(matches);
  if (!place) {
    return null;
  }

  return {
    status: "resolved",
    resolutionType: "place_name_zh_exact",
    issueType: "place_key_not_in_catalog",
    reviewStatus: "auto-canonicalized",
    canonicalPlaceKey: place.placeKey,
    canonicalPlaceNameZh: place.nameZh || station.placeNameZh || station.nameZh,
    canonicalPlaceNameEn: place.nameEn || place.asciiName || station.placeNameEn || station.nameEn,
    resolvedPlace: place,
  };
}

function resolveByPlaceNameEn(station, resolver) {
  const normalizedPlaceNameEn = normalizeToken(station.placeNameEn);
  const normalizedAliases = (station.aliases ?? []).map((alias) => normalizeToken(alias)).filter(Boolean);
  const matchGroups = [
    resolver.byNameEn.get(normalizedPlaceNameEn) ?? [],
    resolver.byAsciiName.get(normalizedPlaceNameEn) ?? [],
    ...normalizedAliases.map((alias) => resolver.byAlias.get(alias) ?? []),
  ];

  for (const matches of matchGroups) {
    const place = uniqueMatch(matches);
    if (!place) {
      continue;
    }

    return {
      status: "resolved",
      resolutionType: "place_name_en_exact",
      issueType: "place_key_not_in_catalog",
      reviewStatus: "auto-canonicalized",
      canonicalPlaceKey: place.placeKey,
      canonicalPlaceNameZh: place.nameZh || station.placeNameZh || station.nameZh,
      canonicalPlaceNameEn: place.nameEn || place.asciiName || station.placeNameEn || station.nameEn,
      resolvedPlace: place,
    };
  }

  return null;
}

function buildUnresolvedResult(station, resolver) {
  const currentPlaceKey = normalizeText(station.placeKey);
  const directionalRule = normalizeText(station.placeRule) === "derived:strip-directional-suffix";
  const lowConfidence = normalizeText(station.placeConfidence) === "low";
  const issueType = !currentPlaceKey
    ? "missing_place_key"
    : directionalRule
      ? "directional_suffix_mapping"
      : lowConfidence
        ? "low_confidence"
        : "place_key_not_in_catalog";

  const possibleMatches = resolver.byNameZh.get(normalizeText(station.placeNameZh)) ?? [];
  const suggestedCanonicalPlaceKey = possibleMatches.length > 0 ? possibleMatches[0].placeKey : "";

  return {
    status: "unresolved",
    resolutionType: "unresolved",
    issueType,
    reviewStatus: "needs-review",
    canonicalPlaceKey: "",
    canonicalPlaceNameZh: "",
    canonicalPlaceNameEn: "",
    suggestedCanonicalPlaceKey,
    resolvedPlace: null,
  };
}

export function resolveRailStationPlace(station, resolver, options = {}) {
  return (
    resolveByExactKey(station, resolver) ||
    resolveByTransportMapping(station, resolver, options.transportPlaceData) ||
    resolveByPlaceNameZh(station, resolver) ||
    resolveByPlaceNameEn(station, resolver) ||
    buildUnresolvedResult(station, resolver)
  );
}

export function canonicalizeRailStationPlace(station, resolver, options = {}) {
  const resolution = resolveRailStationPlace(station, resolver, options);
  if (resolution.status !== "resolved") {
    return station;
  }

  const currentPlaceKey = normalizeText(station.placeKey);
  if (currentPlaceKey === resolution.canonicalPlaceKey) {
    return station;
  }

  const nextConfidence =
    resolution.resolutionType === "place_name_zh_exact" || resolution.resolutionType === "place_name_en_exact"
      ? "medium"
      : station.placeConfidence;
  const nextRule =
    resolution.resolutionType === "exact_place_key"
      ? station.placeRule
      : `${normalizeText(station.placeRule) || "derived"}+canonical:${resolution.resolutionType}`;

  return {
    ...station,
    placeKey: resolution.canonicalPlaceKey,
    placeNameZh: resolution.canonicalPlaceNameZh || station.placeNameZh,
    placeNameEn: resolution.canonicalPlaceNameEn || station.placeNameEn,
    placeConfidence: nextConfidence,
    placeRule: nextRule,
  };
}

function shouldIncludeReviewRow(station, resolution) {
  if (resolution.status !== "resolved") {
    return true;
  }

  if (resolution.resolutionType === "transport_mapping") {
    return false;
  }

  if (resolution.resolutionType === "exact_place_key") {
    return normalizeText(station.placeConfidence) === "low";
  }

  return true;
}

export function buildRailStationPlaceCoverageReport(railStations, placeCatalogEntries, options = {}) {
  const resolver = buildRailPlaceCatalogResolver(placeCatalogEntries);
  const missingPlaceKeyExamples = [];
  const invalidPlaceKeyExamples = [];
  const reviewRows = [];
  const topMissingPlaceKeys = new Map();
  const summary = {
    totalStations: railStations.length,
    withPlaceKey: 0,
    validPlaceKeyCount: 0,
    missingPlaceKeyCount: 0,
    placeKeyNotInCatalogCount: 0,
    resolvedByTransportMappingCount: 0,
    resolvedByCanonicalizationCount: 0,
    unresolvedReviewCount: 0,
  };

  for (const station of railStations) {
    const currentPlaceKey = normalizeText(station.placeKey);
    const hasPlaceKey = Boolean(currentPlaceKey);
    if (hasPlaceKey) {
      summary.withPlaceKey += 1;
    } else {
      summary.missingPlaceKeyCount += 1;
    }

    const resolution = resolveRailStationPlace(station, resolver, options);
    if (resolution.resolutionType === "transport_mapping") {
      summary.resolvedByTransportMappingCount += 1;
    } else if (resolution.resolutionType === "place_name_zh_exact" || resolution.resolutionType === "place_name_en_exact") {
      summary.resolvedByCanonicalizationCount += 1;
    }

    if (resolution.resolutionType === "exact_place_key") {
      summary.validPlaceKeyCount += 1;
    } else if (hasPlaceKey) {
      summary.placeKeyNotInCatalogCount += 1;
    }

    if (resolution.status !== "resolved") {
      summary.unresolvedReviewCount += 1;
      const missingKeyBucket = topMissingPlaceKeys.get(currentPlaceKey || "(missing)") ?? { count: 0, stations: [] };
      missingKeyBucket.count += 1;
      if (missingKeyBucket.stations.length < 5) {
        missingKeyBucket.stations.push({
          telecode: station.code,
          stationNameZh: station.nameZh,
          stationNameEn: station.nameEn,
          mappingConfidence: station.placeConfidence,
          placeRule: station.placeRule,
        });
      }
      topMissingPlaceKeys.set(currentPlaceKey || "(missing)", missingKeyBucket);

      if (!hasPlaceKey && missingPlaceKeyExamples.length < 10) {
        missingPlaceKeyExamples.push(station);
      }
      if (hasPlaceKey && invalidPlaceKeyExamples.length < 10) {
        invalidPlaceKeyExamples.push(station);
      }
    }

    if (!shouldIncludeReviewRow(station, resolution)) {
      continue;
    }

    reviewRows.push({
      telecode: normalizeText(station.code),
      stationNameZh: normalizeText(station.nameZh),
      stationNameEn: normalizeText(station.nameEn),
      pinyin: normalizeText(station.pinyin),
      currentPlaceKey,
      currentPlaceNameZh: normalizeText(station.placeNameZh),
      currentPlaceNameEn: normalizeText(station.placeNameEn),
      mappingConfidence: normalizeText(station.placeConfidence),
      placeRule: normalizeText(station.placeRule),
      issueType: resolution.issueType,
      suggestedCanonicalPlaceKey: resolution.canonicalPlaceKey || resolution.suggestedCanonicalPlaceKey || "",
      reviewStatus: resolution.reviewStatus,
      reviewerNotes: "",
    });
  }

  return {
    summary,
    reviewRows,
    topMissingPlaceKeys: [...topMissingPlaceKeys.entries()]
      .map(([placeKey, details]) => ({ placeKey, ...details }))
      .sort((left, right) => right.count - left.count || left.placeKey.localeCompare(right.placeKey, "en")),
    missingPlaceKeyExamples,
    invalidPlaceKeyExamples,
  };
}

export function serializeRailStationPlaceReviewCsv(reviewRows) {
  const header = [
    "telecode",
    "stationNameZh",
    "stationNameEn",
    "pinyin",
    "currentPlaceKey",
    "currentPlaceNameZh",
    "currentPlaceNameEn",
    "mappingConfidence",
    "placeRule",
    "issueType",
    "suggestedCanonicalPlaceKey",
    "reviewStatus",
    "reviewerNotes",
  ];

  const lines = [header.join(",")];
  for (const row of reviewRows) {
    lines.push(
      [
        row.telecode,
        row.stationNameZh,
        row.stationNameEn,
        row.pinyin,
        row.currentPlaceKey,
        row.currentPlaceNameZh,
        row.currentPlaceNameEn,
        row.mappingConfidence,
        row.placeRule,
        row.issueType,
        row.suggestedCanonicalPlaceKey,
        row.reviewStatus,
        row.reviewerNotes,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}
