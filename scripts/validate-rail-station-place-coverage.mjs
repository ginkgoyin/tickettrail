import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRailStationPlaceCoverageReport,
  serializeRailStationPlaceReviewCsv,
} from "./lib/rail-station-place-coverage.mjs";

const DEFAULT_RAIL_STATIONS_PATH = path.resolve("src/data/rail-stations.generated.json");
const DEFAULT_PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_TRANSPORT_PLACE_PATH = path.resolve("src/data/transport-place.generated.json");
const DEFAULT_REVIEW_OUTPUT_PATH = path.resolve("docs/reviews/rail-station-place-review.csv");

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function parseArgs(argv) {
  const args = {
    railStationsPath: DEFAULT_RAIL_STATIONS_PATH,
    placeCatalogPath: DEFAULT_PLACE_CATALOG_PATH,
    transportPlacePath: DEFAULT_TRANSPORT_PLACE_PATH,
    reviewOutputPath: DEFAULT_REVIEW_OUTPUT_PATH,
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

    if (value === "--review-out" && argv[index + 1]) {
      args.reviewOutputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--review-out=")) {
      args.reviewOutputPath = path.resolve(value.slice("--review-out=".length));
    }
  }

  return args;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function printSummary(report) {
  const { summary, topMissingPlaceKeys } = report;
  console.log(`Rail stations total: ${summary.totalStations}`);
  console.log(`With placeKey: ${summary.withPlaceKey}`);
  console.log(`Valid placeKey in CN place catalog: ${summary.validPlaceKeyCount}`);
  console.log(`Missing placeKey: ${summary.missingPlaceKeyCount}`);
  console.log(`placeKey not found in CN place catalog: ${summary.placeKeyNotInCatalogCount}`);
  console.log(`Resolved by transport-place mapping: ${summary.resolvedByTransportMappingCount}`);
  console.log(`Resolved by deterministic canonicalization: ${summary.resolvedByCanonicalizationCount}`);
  console.log(`Needs review / unresolved: ${summary.unresolvedReviewCount}`);

  console.log("\nTop unresolved place keys:");
  topMissingPlaceKeys.slice(0, 15).forEach((entry) => {
    const examples = entry.stations
      .map((station) => `${station.telecode}:${normalizeText(station.stationNameZh) || normalizeText(station.stationNameEn)}`)
      .join("; ");
    console.log(`- ${entry.placeKey}: ${entry.count} stations (${examples})`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [railStations, placeCatalog, transportPlaceData] = await Promise.all([
    loadJson(args.railStationsPath),
    loadJson(args.placeCatalogPath),
    loadJson(args.transportPlacePath),
  ]);

  const report = buildRailStationPlaceCoverageReport(railStations, placeCatalog, {
    transportPlaceData,
  });

  await mkdir(path.dirname(args.reviewOutputPath), { recursive: true });
  await writeFile(
    args.reviewOutputPath,
    serializeRailStationPlaceReviewCsv(report.reviewRows),
    "utf8",
  );

  printSummary(report);
  console.log(`\nReview CSV: ${args.reviewOutputPath}`);
}

await main();
