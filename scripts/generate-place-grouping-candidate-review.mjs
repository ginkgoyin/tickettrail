import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");
const REVIEWED_GROUPING_PATH = path.resolve("data-sources/place/place-grouping-reviewed.json");
const RAIL_STATIONS_PATH = path.resolve("src/data/rail-stations.generated.json");
const OUTPUT_PATH = path.resolve("docs/reviews/place-grouping-candidate-review.csv");

const MUNICIPALITY_KEYS = new Set([
  "cn-beijing",
  "cn-tianjin",
  "cn-shanghai",
  "cn-chongqing",
]);

const REQUIRED_EXAMPLES = [
  { specificPlaceKey: "cn-danyang", suggestedSummaryPlaceKey: "cn-zhenjiang", label: "Danyang -> Zhenjiang" },
  { specificPlaceKey: "cn-hailin", suggestedSummaryPlaceKey: "cn-mudanjiang", label: "Hailin -> Mudanjiang" },
  { specificPlaceKey: "cn-baodi", suggestedSummaryPlaceKey: "cn-tianjin", label: "Baodi -> Tianjin" },
  { specificPlaceKey: "cn-huairou", suggestedSummaryPlaceKey: "cn-beijing", label: "Huairou -> Beijing" },
  { specificPlaceKey: "cn-taigu", suggestedSummaryPlaceKey: "cn-jinzhong", label: "Taigu -> Jinzhong" },
  { specificPlaceKey: "cn-shenmu", suggestedSummaryPlaceKey: "cn-yulin", label: "Shenmu -> Yulin" },
  { specificPlaceKey: "cn-zhongning", suggestedSummaryPlaceKey: "cn-zhongwei", label: "Zhongning -> Zhongwei" },
  { specificPlaceKey: "cn-funing", suggestedSummaryPlaceKey: "cn-yancheng", label: "Funing -> Yancheng" },
  { specificPlaceKey: "cn-qianan", suggestedSummaryPlaceKey: "cn-tangshan", label: "Qianan -> Tangshan" },
  { specificPlaceKey: "cn-hengdaohezi", suggestedSummaryPlaceKey: "cn-mudanjiang", label: "Hengdaohezi -> Mudanjiang" },
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function formatCsv(rows, headers) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(',')),
  ].join('\n');
}

function buildRailUsageIndex(railStations, placeCatalogByKey) {
  const usage = new Map();

  for (const station of railStations) {
    const placeKey = normalizeText(station.placeKey);
    if (!placeKey || !placeCatalogByKey.has(placeKey)) {
      continue;
    }

    const bucket = usage.get(placeKey) ?? {
      stationCount: 0,
      sampleCodes: [],
      sampleNamesZh: [],
    };

    bucket.stationCount += 1;

    if (bucket.sampleCodes.length < 4 && normalizeText(station.code)) {
      bucket.sampleCodes.push(normalizeText(station.code));
    }

    if (bucket.sampleNamesZh.length < 4 && normalizeText(station.nameZh)) {
      bucket.sampleNamesZh.push(normalizeText(station.nameZh));
    }

    usage.set(placeKey, bucket);
  }

  return usage;
}

function buildAppliedRow(entry, placeCatalogByKey, railUsage) {
  const specific = placeCatalogByKey.get(entry.placeKey);
  const summary = placeCatalogByKey.get(entry.summaryPlaceKey);
  const usage = railUsage.get(entry.placeKey) ?? { stationCount: 0, sampleCodes: [], sampleNamesZh: [] };

  return {
    specificPlaceKey: entry.placeKey,
    specificNameZh: specific?.nameZh ?? "",
    specificNameEn: specific?.nameEn ?? "",
    specificCountryCode: specific?.countryCode ?? "",
    specificAdmin1Code: specific?.admin1Code ?? "",
    specificAdmin2Code: specific?.admin2Code ?? "",
    specificFeatureCode: specific?.featureCode ?? "",
    suggestedSummaryPlaceKey: entry.summaryPlaceKey,
    suggestedSummaryNameZh: summary?.nameZh ?? "",
    suggestedSummaryNameEn: summary?.nameEn ?? "",
    groupingLevel: entry.groupingLevel,
    confidence: "reviewed",
    reason: "Reviewed seed grouping already applied to runtime Journey/Summary grouping.",
    source: "data-sources/place/place-grouping-reviewed.json",
    riskLevel: "low",
    reviewStatus: "already_applied",
    reviewerDecision: "already_applied",
    reviewerNotes: normalizeText(entry.notes),
    stationCount: usage.stationCount,
    sampleStationCodes: usage.sampleCodes.join(' | '),
    sampleStationNamesZh: usage.sampleNamesZh.join(' | '),
  };
}

function buildHeuristicCandidates(placeCatalog, placeCatalogByKey, reviewedEntries, railUsage) {
  const reviewedKeys = new Set(reviewedEntries.map((entry) => entry.placeKey));
  const byAdmin2 = new Map();

  for (const place of placeCatalog) {
    const admin2Code = normalizeText(place.admin2Code);
    if (!admin2Code) {
      continue;
    }

    const bucket = byAdmin2.get(admin2Code) ?? [];
    bucket.push(place);
    byAdmin2.set(admin2Code, bucket);
  }

  const candidates = [];

  for (const [placeKey, usage] of railUsage.entries()) {
    if (reviewedKeys.has(placeKey)) {
      continue;
    }

    const specific = placeCatalogByKey.get(placeKey);
    if (!specific) {
      continue;
    }

    const admin2Code = normalizeText(specific.admin2Code);
    if (!admin2Code) {
      continue;
    }

    const siblings = (byAdmin2.get(admin2Code) ?? [])
      .filter((place) => place.placeKey !== placeKey)
      .sort((left, right) => (right.population ?? 0) - (left.population ?? 0));

    const summary = siblings[0];
    if (!summary) {
      continue;
    }

    if ((summary.population ?? 0) <= (specific.population ?? 0)) {
      continue;
    }

    const groupingLevel = MUNICIPALITY_KEYS.has(summary.placeKey) ? "municipality" : "prefecture";
    const riskLevel = !normalizeText(specific.nameZh) || !specific.population ? "high" : "medium";
    const confidence = riskLevel === "high" ? "low" : "medium";

    candidates.push({
      specificPlaceKey: specific.placeKey,
      specificNameZh: specific.nameZh ?? "",
      specificNameEn: specific.nameEn ?? "",
      specificCountryCode: specific.countryCode ?? "",
      specificAdmin1Code: specific.admin1Code ?? "",
      specificAdmin2Code: specific.admin2Code ?? "",
      specificFeatureCode: specific.featureCode ?? "",
      suggestedSummaryPlaceKey: summary.placeKey,
      suggestedSummaryNameZh: summary.nameZh ?? "",
      suggestedSummaryNameEn: summary.nameEn ?? "",
      groupingLevel,
      confidence,
      reason: "Current rail station place exists in Place Catalog and shares admin2 with a larger likely city/prefecture place.",
      source: "railStations + place-catalog same-admin2 heuristic",
      riskLevel,
      reviewStatus: "needs_review",
      reviewerDecision: "",
      reviewerNotes: "",
      stationCount: usage.stationCount,
      sampleStationCodes: usage.sampleCodes.join(' | '),
      sampleStationNamesZh: usage.sampleNamesZh.join(' | '),
    });
  }

  candidates.sort((left, right) => {
    return (
      right.stationCount - left.stationCount ||
      left.riskLevel.localeCompare(right.riskLevel) ||
      left.specificPlaceKey.localeCompare(right.specificPlaceKey)
    );
  });

  return candidates.slice(0, 28);
}

function collectExampleOutcomes(placeCatalogByKey, reviewedEntries) {
  const reviewedKeys = new Set(reviewedEntries.map((entry) => entry.placeKey));

  return REQUIRED_EXAMPLES.map((example) => {
    const specific = placeCatalogByKey.get(example.specificPlaceKey);
    const summary = placeCatalogByKey.get(example.suggestedSummaryPlaceKey);

    if (reviewedKeys.has(example.specificPlaceKey)) {
      return { label: example.label, status: "already_applied", reason: "reviewed seed already applied" };
    }

    if (!specific) {
      return { label: example.label, status: "skipped", reason: "specific place key is missing from Place Catalog" };
    }

    if (!summary) {
      return { label: example.label, status: "skipped", reason: "suggested summary place key is missing or ambiguous in Place Catalog" };
    }

    return { label: example.label, status: "included", reason: "both specific and summary keys exist in Place Catalog" };
  });
}

async function main() {
  const placeCatalog = JSON.parse(await readFile(PLACE_CATALOG_PATH, "utf8"));
  const reviewedEntries = JSON.parse(await readFile(REVIEWED_GROUPING_PATH, "utf8"));
  const railStations = JSON.parse(await readFile(RAIL_STATIONS_PATH, "utf8"));

  const placeCatalogByKey = new Map(placeCatalog.map((place) => [place.placeKey, place]));
  const railUsage = buildRailUsageIndex(railStations, placeCatalogByKey);

  const appliedRows = reviewedEntries.map((entry) => buildAppliedRow(entry, placeCatalogByKey, railUsage));
  const heuristicRows = buildHeuristicCandidates(placeCatalog, placeCatalogByKey, reviewedEntries, railUsage);
  const rows = [...appliedRows, ...heuristicRows];

  const headers = [
    "specificPlaceKey",
    "specificNameZh",
    "specificNameEn",
    "specificCountryCode",
    "specificAdmin1Code",
    "specificAdmin2Code",
    "specificFeatureCode",
    "suggestedSummaryPlaceKey",
    "suggestedSummaryNameZh",
    "suggestedSummaryNameEn",
    "groupingLevel",
    "confidence",
    "reason",
    "source",
    "riskLevel",
    "reviewStatus",
    "reviewerDecision",
    "reviewerNotes",
    "stationCount",
    "sampleStationCodes",
    "sampleStationNamesZh",
  ];

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, formatCsv(rows, headers) + "\n", "utf8");

  const outcomes = collectExampleOutcomes(placeCatalogByKey, reviewedEntries);
  console.log(`Generated ${rows.length} place-grouping review rows -> ${OUTPUT_PATH}`);
  console.log(`Already applied rows: ${appliedRows.length}`);
  console.log(`Needs review rows: ${heuristicRows.length}`);
  console.log("Required example outcomes:");
  for (const outcome of outcomes) {
    console.log(`- ${outcome.label}: ${outcome.status} (${outcome.reason})`);
  }
}

await main();
