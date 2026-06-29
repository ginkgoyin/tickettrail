import { readFile } from "node:fs/promises";
import path from "node:path";
import { deriveRailPlaceMetadata } from "./lib/derive-rail-place.mjs";
import {
  readRailStationPlaceOverrides,
  validateRailStationPlaceOverrides,
} from "./lib/rail-station-place-overrides.mjs";

const DEFAULT_OVERRIDES_PATH = path.resolve("data-sources/rail/rail-station-place-overrides.json");
const DEFAULT_RAIL_STATIONS_PATH = path.resolve("src/data/rail-stations.generated.json");
const DEFAULT_PLACE_CATALOG_PATH = path.resolve("src/data/place-catalog.generated.json");

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function parseArgs(argv) {
  const args = {
    overridesPath: DEFAULT_OVERRIDES_PATH,
    railStationsPath: DEFAULT_RAIL_STATIONS_PATH,
    placeCatalogPath: DEFAULT_PLACE_CATALOG_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--overrides" && argv[index + 1]) {
      args.overridesPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--overrides=")) {
      args.overridesPath = path.resolve(value.slice("--overrides=".length));
      continue;
    }

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
    }
  }

  return args;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function prepareStationsForOverrideValidation(stations) {
  return stations.map((station) => ({
    ...station,
    ...deriveRailPlaceMetadata({
      nameZh: station.nameZh,
      pinyin: station.pinyin,
      nameEn: station.nameEn,
    }),
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [overrides, generatedStations, placeCatalog] = await Promise.all([
    readRailStationPlaceOverrides(args.overridesPath),
    loadJson(args.railStationsPath),
    loadJson(args.placeCatalogPath),
  ]);

  const rawStations = prepareStationsForOverrideValidation(generatedStations);
  const result = validateRailStationPlaceOverrides(overrides, rawStations, placeCatalog);

  if (result.errors.length > 0) {
    throw new Error(result.errors.join("\n"));
  }

  console.log(`Override file: ${args.overridesPath}`);
  console.log(`Overrides total: ${result.totalOverrideCount}`);
  console.log(`Overrides enabled: ${result.activeOverrideCount}`);
  console.log(`Overrides approved: ${result.approvedOverrideCount}`);

  if (result.approvedOverrideCount > 0) {
    console.log("\nApproved override matches:");
    result.matchedByOverrideId.forEach((codes, overrideId) => {
      console.log(`- ${overrideId}: ${codes.join(", ")}`);
    });
  } else {
    console.log("\nNo approved overrides are currently configured.");
  }
}

await main();
