import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  buildRailPlaceCatalogResolver,
  resolveRailStationPlace,
} from "./lib/rail-station-place-coverage.mjs";

const DEFAULT_RAIL_STATIONS_PATH = path.resolve("src/data/rail-stations.generated.json");
const DEFAULT_PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_TRANSPORT_PLACE_PATH = path.resolve("src/data/transport-place.generated.json");
const DEFAULT_CITIES1000_PATH = path.resolve("data-sources/geonames/cities1000.txt");
const DEFAULT_ALTERNATE_NAMES_PATH = path.resolve("data-sources/geonames/alternateNamesV2.txt");
const DEFAULT_OUTPUT_PATH = path.resolve("docs/reviews/rail-geonames-candidate-review.csv");

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeToken(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeSlugSegment(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPlaceKey(countryCode, asciiName, fallbackName) {
  const country = normalizeSlugSegment(countryCode);
  const nameSegment = normalizeSlugSegment(asciiName || fallbackName);
  return country && nameSegment ? `${country}-${nameSegment}` : "";
}

function splitTabbedLine(line, minimumColumns) {
  const columns = line.split("\t");
  return columns.length >= minimumColumns ? columns : null;
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

function containsCjk(value) {
  return /[\u3400-\u9fff]/u.test(normalizeText(value));
}

function isAsciiLike(value) {
  return /^[A-Za-z0-9 .,'()\-]+$/.test(normalizeText(value));
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

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function summarizeValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))].join(" | ");
}

function joinCandidateField(candidates, selector) {
  return candidates
    .map(selector)
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" | ");
}

function parseArgs(argv) {
  const args = {
    railStationsPath: DEFAULT_RAIL_STATIONS_PATH,
    placeCatalogPath: DEFAULT_PLACE_CATALOG_PATH,
    transportPlacePath: DEFAULT_TRANSPORT_PLACE_PATH,
    cities1000Path: DEFAULT_CITIES1000_PATH,
    alternateNamesPath: DEFAULT_ALTERNATE_NAMES_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--rail" && argv[index + 1]) {
      args.railStationsPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--rail=")) {
      args.railStationsPath = path.resolve(value.slice("--rail=".length));
      continue;
    }

    if (value === "--place-catalog" && argv[index + 1]) {
      args.placeCatalogPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--place-catalog=")) {
      args.placeCatalogPath = path.resolve(value.slice("--place-catalog=".length));
      continue;
    }

    if (value === "--transport-place" && argv[index + 1]) {
      args.transportPlacePath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--transport-place=")) {
      args.transportPlacePath = path.resolve(value.slice("--transport-place=".length));
      continue;
    }

    if (value === "--cities1000" && argv[index + 1]) {
      args.cities1000Path = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--cities1000=")) {
      args.cities1000Path = path.resolve(value.slice("--cities1000=".length));
      continue;
    }

    if (value === "--alternate-names" && argv[index + 1]) {
      args.alternateNamesPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--alternate-names=")) {
      args.alternateNamesPath = path.resolve(value.slice("--alternate-names=".length));
      continue;
    }

    if (value === "--out" && argv[index + 1]) {
      args.outputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--out=")) {
      args.outputPath = path.resolve(value.slice("--out=".length));
    }
  }

  return args;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function parseChinaCities1000(filePath) {
  const entries = [];
  const geonameIds = new Set();
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const columns = splitTabbedLine(line, 19);
    if (!columns) {
      continue;
    }

    const countryCode = normalizeText(columns[8]).toUpperCase();
    const featureClass = normalizeText(columns[6]);
    if (countryCode !== "CN" || featureClass !== "P") {
      continue;
    }

    const geonameId = Number.parseInt(columns[0], 10);
    const name = normalizeText(columns[1]);
    const asciiName = normalizeText(columns[2]);
    if (!Number.isFinite(geonameId) || !name) {
      continue;
    }

    const inlineAlternateNames = normalizeText(columns[3])
      ? normalizeText(columns[3]).split(",").map((value) => normalizeText(value)).filter(Boolean)
      : [];

    entries.push({
      geonameId,
      countryCode,
      name,
      asciiName,
      placeKey: buildPlaceKey(countryCode, asciiName, name),
      inlineAlternateNames,
      latitude: normalizeText(columns[4]),
      longitude: normalizeText(columns[5]),
      featureCode: normalizeText(columns[7]),
      admin1Code: normalizeText(columns[10]),
      admin2Code: normalizeText(columns[11]),
      admin3Code: normalizeText(columns[12]),
      admin4Code: normalizeText(columns[13]),
      population: normalizeText(columns[14]),
      timezone: normalizeText(columns[17]),
      zhNames: new Set(),
      enNames: new Set(),
    });
    geonameIds.add(geonameId);
  }

  return { entries, geonameIds };
}

async function applyAlternateNames(filePath, cityEntries, geonameIds) {
  const byId = new Map(cityEntries.map((entry) => [entry.geonameId, entry]));
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const columns = splitTabbedLine(line, 5);
    if (!columns) {
      continue;
    }

    const geonameId = Number.parseInt(columns[1], 10);
    if (!geonameIds.has(geonameId)) {
      continue;
    }

    const languageCode = normalizeToken(columns[2]);
    const alternateName = normalizeText(columns[3]);
    if (!alternateName || ["abbr", "iata", "icao", "link"].includes(languageCode)) {
      continue;
    }

    const entry = byId.get(geonameId);
    if (!entry) {
      continue;
    }

    if (["zh", "zh-cn", "zh-hans"].includes(languageCode) && containsCjk(alternateName)) {
      entry.zhNames.add(alternateName);
      continue;
    }

    if (languageCode === "en" && isAsciiLike(alternateName)) {
      entry.enNames.add(alternateName);
    }
  }

  for (const entry of cityEntries) {
    if (containsCjk(entry.name)) {
      entry.zhNames.add(entry.name);
    }
    if (containsCjk(entry.asciiName)) {
      entry.zhNames.add(entry.asciiName);
    }

    if (isAsciiLike(entry.name)) {
      entry.enNames.add(entry.name);
    }
    if (isAsciiLike(entry.asciiName)) {
      entry.enNames.add(entry.asciiName);
    }

    for (const inlineAlternateName of entry.inlineAlternateNames) {
      if (containsCjk(inlineAlternateName)) {
        entry.zhNames.add(inlineAlternateName);
      } else if (isAsciiLike(inlineAlternateName)) {
        entry.enNames.add(inlineAlternateName);
      }
    }
  }
}

function buildGeoNamesIndexes(cityEntries) {
  const byZh = new Map();
  const byEn = new Map();
  const bySlug = new Map();

  for (const entry of cityEntries) {
    for (const zhName of entry.zhNames) {
      pushIndexedValue(byZh, zhName, entry);
    }

    for (const enName of entry.enNames) {
      pushIndexedValue(byEn, normalizeToken(enName), entry);
    }

    pushIndexedValue(bySlug, entry.placeKey, entry);
  }

  return { byZh, byEn, bySlug };
}

function classifyGroup(group, currentCatalogKeys, indexes) {
  const zhCandidates = uniqueBy(indexes.byZh.get(group.currentPlaceNameZh) ?? [], (entry) => entry.geonameId);
  const enCandidates = uniqueBy(indexes.byEn.get(normalizeToken(group.currentPlaceNameEn)) ?? [], (entry) => entry.geonameId);
  const slugCandidates = uniqueBy(indexes.bySlug.get(group.currentPlaceKey) ?? [], (entry) => entry.geonameId);

  const existingCatalogCandidates = zhCandidates.filter(
    (candidate) => currentCatalogKeys.has(candidate.placeKey) && candidate.placeKey !== group.currentPlaceKey,
  );

  if (existingCatalogCandidates.length === 1 && zhCandidates.length === 1) {
    return {
      matchStatus: "unique_existing_catalog_key",
      recommendedAction: "can_canonicalize_to_existing_catalog",
      confidenceReason: "Exactly one Chinese-name GeoNames candidate exists and it already exists in the current Place Catalog under a different key.",
      candidates: existingCatalogCandidates,
    };
  }

  if (zhCandidates.length === 1) {
    return {
      matchStatus: "unique_zh_exact",
      recommendedAction: "can_auto_add_place",
      confidenceReason: "Exactly one Chinese-name GeoNames candidate exists via city name or filtered Chinese alternate names.",
      candidates: zhCandidates,
    };
  }

  if (zhCandidates.length > 1) {
    return {
      matchStatus: "ambiguous_multi_candidate",
      recommendedAction: "needs_human_review",
      confidenceReason: "Multiple Chinese-name GeoNames candidates exist for this unresolved rail place group.",
      candidates: zhCandidates,
    };
  }

  const riskyCandidates = uniqueBy([...enCandidates, ...slugCandidates], (entry) => entry.geonameId);
  if (riskyCandidates.length === 1) {
    return {
      matchStatus: "unique_en_or_slug_only",
      recommendedAction: "do_not_auto_resolve",
      confidenceReason: "Only one English/ascii/slug-based candidate exists, but no exact Chinese candidate was found.",
      candidates: riskyCandidates,
    };
  }

  if (riskyCandidates.length > 1) {
    return {
      matchStatus: "ambiguous_multi_candidate",
      recommendedAction: "needs_human_review",
      confidenceReason: "Multiple English/ascii/slug-based candidates exist and no exact Chinese candidate was found.",
      candidates: riskyCandidates,
    };
  }

  return {
    matchStatus: "no_candidate",
    recommendedAction: "needs_human_review",
    confidenceReason: "No exact Chinese or safe English/slug GeoNames candidate was found from the local China cities1000 dataset.",
    candidates: [],
  };
}

function buildGroupedUnresolvedRows(railStations, resolver, transportPlaceData) {
  const groups = new Map();

  for (const station of railStations) {
    const resolution = resolveRailStationPlace(station, resolver, {
      transportPlaceData,
    });
    if (resolution.status === "resolved") {
      continue;
    }

    const groupKey = [
      normalizeText(station.placeKey),
      normalizeText(station.placeNameZh),
      normalizeText(station.placeNameEn),
    ].join("||");
    const existing = groups.get(groupKey) ?? {
      currentPlaceKey: normalizeText(station.placeKey),
      currentPlaceNameZh: normalizeText(station.placeNameZh),
      currentPlaceNameEn: normalizeText(station.placeNameEn),
      affectedStationCount: 0,
      telecodes: [],
      stationNamesZh: [],
      mappingConfidenceValues: [],
      placeRuleValues: [],
      issueTypeValues: [],
    };

    existing.affectedStationCount += 1;
    if (existing.telecodes.length < 8) {
      existing.telecodes.push(normalizeText(station.code));
    }
    if (existing.stationNamesZh.length < 8) {
      existing.stationNamesZh.push(normalizeText(station.nameZh) || normalizeText(station.nameEn));
    }
    existing.mappingConfidenceValues.push(normalizeText(station.placeConfidence));
    existing.placeRuleValues.push(normalizeText(station.placeRule));
    existing.issueTypeValues.push(normalizeText(resolution.issueType));
    groups.set(groupKey, existing);
  }

  return [...groups.values()].sort(
    (left, right) =>
      right.affectedStationCount - left.affectedStationCount ||
      left.currentPlaceKey.localeCompare(right.currentPlaceKey, "en"),
  );
}

function serializeCandidateReviewCsv(rows) {
  const header = [
    "currentPlaceKey",
    "currentPlaceNameZh",
    "currentPlaceNameEn",
    "affectedStationCount",
    "sampleTelecodes",
    "sampleStationNamesZh",
    "mappingConfidenceSummary",
    "placeRuleSummary",
    "issueTypeSummary",
    "matchStatus",
    "recommendedAction",
    "candidateCount",
    "candidateGeonameIds",
    "candidateNames",
    "candidateAsciiNames",
    "candidateNameZh",
    "candidateCountryCode",
    "candidateAdminCodes",
    "candidateLatitude",
    "candidateLongitude",
    "candidateFeatureCodes",
    "candidatePopulation",
    "candidateTimezone",
    "candidateAlreadyInPlaceCatalog",
    "candidateExistingPlaceKey",
    "confidenceReason",
    "reviewStatus",
    "reviewerNotes",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      header
        .map((column) => escapeCsv(row[column]))
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

function createOutputRows(groupedUnresolvedRows, currentCatalogKeys, indexes) {
  return groupedUnresolvedRows.map((group) => {
    const classification = classifyGroup(group, currentCatalogKeys, indexes);
    const candidates = classification.candidates;

    return {
      currentPlaceKey: group.currentPlaceKey,
      currentPlaceNameZh: group.currentPlaceNameZh,
      currentPlaceNameEn: group.currentPlaceNameEn,
      affectedStationCount: String(group.affectedStationCount),
      sampleTelecodes: group.telecodes.join(" | "),
      sampleStationNamesZh: group.stationNamesZh.join(" | "),
      mappingConfidenceSummary: summarizeValues(group.mappingConfidenceValues),
      placeRuleSummary: summarizeValues(group.placeRuleValues),
      issueTypeSummary: summarizeValues(group.issueTypeValues),
      matchStatus: classification.matchStatus,
      recommendedAction: classification.recommendedAction,
      candidateCount: String(candidates.length),
      candidateGeonameIds: joinCandidateField(candidates, (candidate) => String(candidate.geonameId)),
      candidateNames: joinCandidateField(candidates, (candidate) => candidate.name),
      candidateAsciiNames: joinCandidateField(candidates, (candidate) => candidate.asciiName),
      candidateNameZh: joinCandidateField(candidates, (candidate) => [...candidate.zhNames][0] ?? ""),
      candidateCountryCode: joinCandidateField(candidates, (candidate) => candidate.countryCode),
      candidateAdminCodes: joinCandidateField(
        candidates,
        (candidate) =>
          [candidate.admin1Code, candidate.admin2Code, candidate.admin3Code, candidate.admin4Code]
            .filter(Boolean)
            .join("/"),
      ),
      candidateLatitude: joinCandidateField(candidates, (candidate) => candidate.latitude),
      candidateLongitude: joinCandidateField(candidates, (candidate) => candidate.longitude),
      candidateFeatureCodes: joinCandidateField(candidates, (candidate) => candidate.featureCode),
      candidatePopulation: joinCandidateField(candidates, (candidate) => candidate.population),
      candidateTimezone: joinCandidateField(candidates, (candidate) => candidate.timezone),
      candidateAlreadyInPlaceCatalog: joinCandidateField(
        candidates,
        (candidate) => (currentCatalogKeys.has(candidate.placeKey) ? "yes" : "no"),
      ),
      candidateExistingPlaceKey: joinCandidateField(
        candidates,
        (candidate) => (currentCatalogKeys.has(candidate.placeKey) ? candidate.placeKey : ""),
      ),
      confidenceReason: classification.confidenceReason,
      reviewStatus:
        classification.recommendedAction === "can_auto_add_place"
          ? "candidate-auto-add"
          : classification.recommendedAction === "can_canonicalize_to_existing_catalog"
            ? "candidate-canonicalize"
            : "needs-review",
      reviewerNotes: "",
    };
  });
}

function printSummary(rows) {
  const matchStatusCounts = new Map();
  const recommendedActionCounts = new Map();

  for (const row of rows) {
    matchStatusCounts.set(row.matchStatus, (matchStatusCounts.get(row.matchStatus) ?? 0) + 1);
    recommendedActionCounts.set(row.recommendedAction, (recommendedActionCounts.get(row.recommendedAction) ?? 0) + 1);
  }

  console.log(`Grouped unresolved place rows: ${rows.length}`);
  console.log("Match status counts:");
  for (const [matchStatus, count] of [...matchStatusCounts.entries()].sort()) {
    console.log(`- ${matchStatus}: ${count}`);
  }

  console.log("\nRecommended action counts:");
  for (const [recommendedAction, count] of [...recommendedActionCounts.entries()].sort()) {
    console.log(`- ${recommendedAction}: ${count}`);
  }

  const kuxRow = rows.find((row) => row.currentPlaceKey === "cn-hengdaohezi");
  if (kuxRow) {
    console.log("\nKUX / 横道河子 group:");
    console.log(JSON.stringify(kuxRow, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [railStations, placeCatalog, transportPlaceData] = await Promise.all([
    loadJson(args.railStationsPath),
    loadJson(args.placeCatalogPath),
    loadJson(args.transportPlacePath),
  ]);

  const resolver = buildRailPlaceCatalogResolver(placeCatalog);
  const groupedUnresolvedRows = buildGroupedUnresolvedRows(railStations, resolver, transportPlaceData);
  const { entries: chinaCities1000, geonameIds } = await parseChinaCities1000(args.cities1000Path);
  await applyAlternateNames(args.alternateNamesPath, chinaCities1000, geonameIds);
  const indexes = buildGeoNamesIndexes(chinaCities1000);
  const currentCatalogKeys = new Set(
    placeCatalog
      .filter((entry) => normalizeToken(entry.countryCode) === "cn")
      .map((entry) => entry.placeKey),
  );

  const outputRows = createOutputRows(groupedUnresolvedRows, currentCatalogKeys, indexes);
  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await writeFile(args.outputPath, serializeCandidateReviewCsv(outputRows), "utf8");

  printSummary(outputRows);
  console.log(`\nCandidate review CSV: ${args.outputPath}`);
}

await main();
