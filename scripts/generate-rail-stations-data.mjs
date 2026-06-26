import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRailPlaceCatalogResolver,
  canonicalizeRailStationPlace,
} from "./lib/rail-station-place-coverage.mjs";
import { deriveRailPlaceMetadata } from "./lib/derive-rail-place.mjs";
import { readSafeRailGeonamesReviewRows } from "./lib/rail-geonames-review.mjs";

const DEFAULT_SOURCE_URL = "https://kyfw.12306.cn/otn/resources/js/framework/station_name.js";
const DEFAULT_INPUT = path.resolve("data-sources/12306/station_name.js");
const DEFAULT_OUTPUT = path.resolve("src/data/rail-stations.generated.json");
const DEFAULT_PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_TRANSPORT_PLACE_PATH = path.resolve("src/data/transport-place.generated.json");
const DEFAULT_RAIL_REVIEW_CSV = path.resolve("docs/reviews/rail-geonames-candidate-review.csv");
const SUPPORTED_ENCODINGS = ["utf8", "gbk", "gb18030"];

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeName(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function parseArgs(argv) {
  const args = {
    download: false,
    sourceUrl: DEFAULT_SOURCE_URL,
    sourcePath: DEFAULT_INPUT,
    outputPath: DEFAULT_OUTPUT,
    placeCatalogPath: DEFAULT_PLACE_CATALOG_PATH,
    transportPlacePath: DEFAULT_TRANSPORT_PLACE_PATH,
    reviewCsvPath: DEFAULT_RAIL_REVIEW_CSV,
    encoding: "",
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--download") {
      args.download = true;
      continue;
    }

    if (value === "--source" && argv[index + 1]) {
      args.sourcePath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--source=")) {
      args.sourcePath = path.resolve(value.slice("--source=".length));
      continue;
    }

    if (value === "--out" && argv[index + 1]) {
      args.outputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--out=")) {
      args.outputPath = path.resolve(value.slice("--out=".length));
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

    if (value === "--review-csv" && argv[index + 1]) {
      args.reviewCsvPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--review-csv=")) {
      args.reviewCsvPath = path.resolve(value.slice("--review-csv=".length));
      continue;
    }

    if (value === "--encoding" && argv[index + 1]) {
      args.encoding = normalizeText(argv[index + 1]).toLowerCase();
      index += 1;
      continue;
    }

    if (value.startsWith("--encoding=")) {
      args.encoding = normalizeText(value.slice("--encoding=".length)).toLowerCase();
      continue;
    }

    if (value === "--url" && argv[index + 1]) {
      args.sourceUrl = normalizeText(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--url=")) {
      args.sourceUrl = normalizeText(value.slice("--url=".length));
      continue;
    }

    positional.push(value);
  }

  if (positional[0]) {
    args.sourcePath = path.resolve(positional[0]);
  }

  if (positional[1]) {
    args.outputPath = path.resolve(positional[1]);
  }

  return args;
}

function decodeBuffer(buffer, explicitEncoding) {
  const candidates = explicitEncoding ? [explicitEncoding] : SUPPORTED_ENCODINGS;

  for (const encoding of candidates) {
    try {
      return new TextDecoder(encoding, { fatal: false }).decode(buffer);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to decode station source using encodings: ${candidates.join(", ")}`);
}

function extractStationPayload(content) {
  const trimmed = normalizeText(content);
  if (!trimmed) {
    throw new Error("12306 station source file is empty.");
  }

  if (trimmed.startsWith("@")) {
    return trimmed;
  }

  const assignmentMatch = trimmed.match(/station_names\s*=\s*(['"])([\s\S]*?)\1\s*;?/);
  if (assignmentMatch) {
    return assignmentMatch[2];
  }

  const quotedMatch = trimmed.match(/^(['"])([\s\S]*?)\1\s*;?$/);
  if (quotedMatch) {
    return quotedMatch[2];
  }

  throw new Error("Could not find a 12306 station_names payload in the provided source file.");
}

function buildAliases(nameZh, code, pinyin, shortPinyin) {
  const aliases = [
    nameZh,
    nameZh.endsWith("\u7ad9") ? "" : `${nameZh}\u7ad9`,
    code,
    pinyin,
    shortPinyin,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

function parseStationEntries(payload) {
  return payload
    .split("@")
    .map((entry) => normalizeText(entry))
    .filter(Boolean)
    .map((entry) => {
      const [slug, nameZh, telecode, pinyin, shortPinyin, stationIndex] = entry.split("|").map(normalizeText);

      if (!nameZh || !telecode || !pinyin || !shortPinyin) {
        return null;
      }

      const code = normalizeCode(telecode);
      const normalizedName = normalizeName(nameZh);
      const placeMetadata = deriveRailPlaceMetadata({
        nameZh,
        pinyin,
        nameEn: pinyin,
      });

      return {
        id: `loc-station-${code.toLowerCase()}`,
        locationType: "station",
        code,
        nameZh,
        nameEn: pinyin,
        pinyin,
        shortPinyin,
        stationIndex: stationIndex || undefined,
        aliases: buildAliases(nameZh, code, pinyin, shortPinyin),
        countryCode: "CN",
        ...placeMetadata,
        _slug: slug,
        _normalizedName: normalizedName,
      };
    })
    .filter(Boolean);
}

function dedupeStations(stations) {
  const bestByKey = new Map();

  for (const station of stations) {
    const keys = [
      station.code ? `code:${station.code}` : "",
      station._normalizedName ? `name:${station._normalizedName}` : "",
    ].filter(Boolean);

    const existing = keys.map((key) => bestByKey.get(key)).find(Boolean);
    if (!existing) {
      for (const key of keys) {
        bestByKey.set(key, station);
      }
      continue;
    }

    existing.aliases = Array.from(new Set([...existing.aliases, ...station.aliases]));
    existing.nameEn = existing.nameEn || station.nameEn;
    existing.pinyin = existing.pinyin || station.pinyin;
    existing.shortPinyin = existing.shortPinyin || station.shortPinyin;
    existing.stationIndex = existing.stationIndex || station.stationIndex;
  }

  return Array.from(new Set(bestByKey.values())).map(({ _slug, _normalizedName, ...station }) => station);
}

function sortStations(left, right) {
  return (
    normalizeText(left.pinyin).localeCompare(normalizeText(right.pinyin), "en")
    || normalizeText(left.nameZh).localeCompare(normalizeText(right.nameZh), "zh-Hans-CN")
    || normalizeText(left.code).localeCompare(normalizeText(right.code), "en")
  );
}

async function downloadSourceFile(sourceUrl, sourcePath) {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to download 12306 station source: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, Buffer.from(arrayBuffer));

  return sourcePath;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function buildReviewedGroupKey(placeKey, placeNameZh, placeNameEn) {
  return [normalizeText(placeKey), normalizeText(placeNameZh), normalizeText(placeNameEn)].join("||");
}

async function loadReviewedCanonicalizationMap(reviewCsvPath, placeResolver) {
  try {
    const reviewRows = await readSafeRailGeonamesReviewRows(reviewCsvPath);
    const mappings = new Map();

    for (const row of reviewRows) {
      if (row.recommendedAction !== "can_canonicalize_to_existing_catalog") {
        continue;
      }

      const canonicalPlaceKey = row.candidateExistingPlaceKeyList?.[0] || normalizeText(row.candidateExistingPlaceKey);
      if (!canonicalPlaceKey) {
        continue;
      }

      const canonicalPlace = placeResolver.byKey.get(canonicalPlaceKey);
      if (!canonicalPlace) {
        continue;
      }

      mappings.set(
        buildReviewedGroupKey(row.currentPlaceKey, row.currentPlaceNameZh, row.currentPlaceNameEn),
        {
          canonicalPlaceKey,
          canonicalPlaceNameZh: canonicalPlace.nameZh || row.currentPlaceNameZh,
          canonicalPlaceNameEn: canonicalPlace.nameEn || canonicalPlace.asciiName || row.currentPlaceNameEn,
        },
      );
    }

    return mappings;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

function applyReviewedCanonicalization(station, reviewedCanonicalizationMap) {
  const reviewed = reviewedCanonicalizationMap.get(
    buildReviewedGroupKey(station.placeKey, station.placeNameZh, station.placeNameEn),
  );
  if (!reviewed) {
    return station;
  }

  return {
    ...station,
    placeKey: reviewed.canonicalPlaceKey,
    placeNameZh: reviewed.canonicalPlaceNameZh || station.placeNameZh,
    placeNameEn: reviewed.canonicalPlaceNameEn || station.placeNameEn,
    placeConfidence: "high",
    placeRule: `${normalizeText(station.placeRule) || "derived"}+reviewed-canonicalize`,
  };
}
async function generateStations({ sourcePath, outputPath, placeCatalogPath, transportPlacePath, reviewCsvPath, encoding }) {
  const sourceBuffer = await readFile(sourcePath);
  const payload = extractStationPayload(decodeBuffer(sourceBuffer, encoding || undefined));
  const rawStations = dedupeStations(parseStationEntries(payload));

  if (!rawStations.length) {
    throw new Error("No rail station entries were parsed from the provided 12306 source.");
  }

  const [placeCatalog, transportPlaceData] = await Promise.all([
    loadJson(placeCatalogPath),
    loadJson(transportPlacePath),
  ]);
  const placeResolver = buildRailPlaceCatalogResolver(placeCatalog);
  const reviewedCanonicalizationMap = await loadReviewedCanonicalizationMap(reviewCsvPath, placeResolver);
  const stations = rawStations
    .map((station) => applyReviewedCanonicalization(station, reviewedCanonicalizationMap))
    .map((station) => canonicalizeRailStationPlace(station, placeResolver, { transportPlaceData }))
    .sort(sortStations);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(stations, null, 2)}\n`, "utf8");

  return stations.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.download) {
    console.log(`Downloading 12306 station source from ${args.sourceUrl}`);
    await downloadSourceFile(args.sourceUrl, args.sourcePath);
    console.log(`Saved 12306 station source -> ${args.sourcePath}`);
  }

  const count = await generateStations(args);
  console.log(`Generated ${count} rail station records -> ${args.outputPath}`);
}

await main();
