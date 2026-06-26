import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
import { readSafeRailGeonamesReviewRows } from "./lib/rail-geonames-review.mjs";

const GEONAMES_BASE_URL = "https://download.geonames.org/export/dump";
const DEFAULT_CITY_SOURCE = "cities5000";
const SUPPORTED_CITY_SOURCES = new Set(["cities500", "cities1000", "cities5000"]);
const DEFAULT_CACHE_DIR = path.resolve("data-sources/geonames");
const DEFAULT_OUTPUT = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_ALIAS_LIMIT = 4;
const DEFAULT_RAIL_REVIEW_CSV = path.resolve("docs/reviews/rail-geonames-candidate-review.csv");
const ZH_LANGUAGE_PRIORITY = ["zh-cn", "zh-hans", "zh"];
const EN_LANGUAGE_PRIORITY = ["en"];

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function normalizeSlugSegment(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLanguageCode(value) {
  return normalizeText(value).toLowerCase();
}

function parseArgs(argv) {
  const options = {
    citySource: DEFAULT_CITY_SOURCE,
    cacheDir: DEFAULT_CACHE_DIR,
    outputPath: DEFAULT_OUTPUT,
    aliasLimit: DEFAULT_ALIAS_LIMIT,
    forceDownload: false,
    railReviewCsvPath: DEFAULT_RAIL_REVIEW_CSV,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--download") {
      options.forceDownload = true;
      continue;
    }

    if (value === "--city-source" && argv[index + 1]) {
      options.citySource = normalizeText(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--city-source=")) {
      options.citySource = normalizeText(value.slice("--city-source=".length));
      continue;
    }

    if (value === "--cache-dir" && argv[index + 1]) {
      options.cacheDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--cache-dir=")) {
      options.cacheDir = path.resolve(value.slice("--cache-dir=".length));
      continue;
    }

    if (value === "--out" && argv[index + 1]) {
      options.outputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--out=")) {
      options.outputPath = path.resolve(value.slice("--out=".length));
      continue;
    }

    if (value === "--alias-limit" && argv[index + 1]) {
      options.aliasLimit = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (value.startsWith("--alias-limit=")) {
      options.aliasLimit = Number.parseInt(value.slice("--alias-limit=".length), 10);
      continue;
    }

    if (value === "--rail-review-csv" && argv[index + 1]) {
      options.railReviewCsvPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--rail-review-csv=")) {
      options.railReviewCsvPath = path.resolve(value.slice("--rail-review-csv=".length));
      continue;
    }
  }

  if (!SUPPORTED_CITY_SOURCES.has(options.citySource)) {
    throw new Error(`Unsupported city source: ${options.citySource}`);
  }

  if (!Number.isFinite(options.aliasLimit) || options.aliasLimit < 0) {
    throw new Error("aliasLimit must be a non-negative integer.");
  }

  return options;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(url, outputPath) {
  if (process.platform === "win32") {
    const quotePowerShellLiteral = (value) => `'${value.replace(/'/g, "''")}'`;
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Invoke-WebRequest -Uri ${quotePowerShellLiteral(url)} -OutFile ${quotePowerShellLiteral(path.resolve(outputPath))}`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Failed to download ${url}`);
    }

    return;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(arrayBuffer));
}

function expandArchive(archivePath, destinationDir) {
  const normalizedArchive = path.resolve(archivePath);
  const normalizedDestination = path.resolve(destinationDir);

  if (process.platform === "win32") {
    const quotePowerShellLiteral = (value) => `'${value.replace(/'/g, "''")}'`;
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath ${quotePowerShellLiteral(normalizedArchive)} -DestinationPath ${quotePowerShellLiteral(normalizedDestination)} -Force`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `Failed to expand ${normalizedArchive}`);
    }

    return;
  }

  const result = spawnSync("unzip", ["-o", normalizedArchive, "-d", normalizedDestination], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to expand ${normalizedArchive}`);
  }
}

async function ensureDownloadedFile(url, filePath, { forceDownload = false } = {}) {
  if (forceDownload || !(await fileExists(filePath))) {
    console.log(`Downloading ${url}`);
    await downloadToFile(url, filePath);
  }
}

async function ensureExtractedFile(zipPath, extractedFilePath) {
  if (await fileExists(extractedFilePath)) {
    return;
  }

  await mkdir(path.dirname(extractedFilePath), { recursive: true });
  expandArchive(zipPath, path.dirname(extractedFilePath));
}

function splitTabbedLine(line, minimumColumns) {
  const columns = line.split("\t");
  if (columns.length < minimumColumns) {
    return null;
  }

  return columns;
}

function addUniqueValue(target, value, excludedValues = new Set()) {
  const trimmed = normalizeText(value);
  if (!trimmed || excludedValues.has(trimmed.toLowerCase())) {
    return;
  }

  target.add(trimmed);
}

function choosePreferredLabel(candidates, fallbackValues = []) {
  for (const candidate of candidates) {
    if (normalizeText(candidate)) {
      return normalizeText(candidate);
    }
  }

  for (const fallbackValue of fallbackValues) {
    if (normalizeText(fallbackValue)) {
      return normalizeText(fallbackValue);
    }
  }

  return undefined;
}

function createAlternateNameAccumulator() {
  return {
    preferredEn: undefined,
    en: [],
    preferredZh: undefined,
    zh: [],
    aliasCandidates: new Set(),
  };
}

async function parseCityRows(cityFilePath) {
  const places = [];
  const geonameIds = new Set();
  const rl = createInterface({
    input: createReadStream(cityFilePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const columns = splitTabbedLine(line, 19);
    if (!columns) {
      continue;
    }

    const geonameId = Number.parseInt(columns[0], 10);
    const name = normalizeText(columns[1]);
    const asciiName = normalizeText(columns[2]);
    const alternateNamesRaw = normalizeText(columns[3]);
    const latitude = Number.parseFloat(columns[4]);
    const longitude = Number.parseFloat(columns[5]);
    const featureClass = normalizeText(columns[6]);
    const countryCode = normalizeText(columns[8]).toUpperCase();
    const admin1Code = normalizeText(columns[10]) || undefined;
    const admin2Code = normalizeText(columns[11]) || undefined;
    const population = Number.parseInt(columns[14], 10);
    const timezone = normalizeText(columns[17]) || undefined;

    if (!Number.isFinite(geonameId) || !name || !countryCode) {
      continue;
    }

    if (featureClass !== "P" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    const alternateNames = alternateNamesRaw
      ? alternateNamesRaw.split(",").map((value) => normalizeText(value)).filter(Boolean)
      : [];

    const place = {
      geonameId,
      name,
      asciiName: asciiName || undefined,
      alternateNames,
      countryCode,
      admin1Code,
      admin2Code,
      latitude,
      longitude,
      timezone,
      population: Number.isFinite(population) ? population : undefined,
    };

    geonameIds.add(geonameId);
    places.push(place);
  }

  return { places, geonameIds };
}

async function parseAlternateNames(alternateNamesFilePath, geonameIds) {
  const altNamesByGeonameId = new Map();
  const rl = createInterface({
    input: createReadStream(alternateNamesFilePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const columns = splitTabbedLine(line, 4);
    if (!columns) {
      continue;
    }

    const geonameId = Number.parseInt(columns[1], 10);
    if (!geonameIds.has(geonameId)) {
      continue;
    }

    const languageCode = normalizeLanguageCode(columns[2]);
    const alternateName = normalizeText(columns[3]);
    const isPreferredName = normalizeText(columns[4]) === "1";

    if (!alternateName) {
      continue;
    }

    const state = altNamesByGeonameId.get(geonameId) ?? createAlternateNameAccumulator();
    if (!altNamesByGeonameId.has(geonameId)) {
      altNamesByGeonameId.set(geonameId, state);
    }

    if (EN_LANGUAGE_PRIORITY.includes(languageCode)) {
      if (isPreferredName && !state.preferredEn) {
        state.preferredEn = alternateName;
      }
      if (!state.en.includes(alternateName)) {
        state.en.push(alternateName);
      }
      continue;
    }

    if (ZH_LANGUAGE_PRIORITY.includes(languageCode)) {
      if (isPreferredName && !state.preferredZh) {
        state.preferredZh = alternateName;
      }
      if (!state.zh.includes(alternateName)) {
        state.zh.push(alternateName);
      }
      continue;
    }

    if (languageCode === "abbr" || languageCode === "iata" || languageCode === "icao" || languageCode === "link") {
      continue;
    }

    addUniqueValue(state.aliasCandidates, alternateName);
  }

  return altNamesByGeonameId;
}

function buildBasePlaceKey(place) {
  const country = normalizeSlugSegment(place.countryCode);
  const nameSegment = normalizeSlugSegment(place.asciiName || place.nameEn || place.name);

  if (!country || !nameSegment) {
    return undefined;
  }

  return `${country}-${nameSegment}`;
}

function assignPlaceKeys(intermediatePlaces) {
  const groups = new Map();

  intermediatePlaces.forEach((place) => {
    const basePlaceKey = buildBasePlaceKey(place);
    if (!basePlaceKey) {
      return;
    }

    const group = groups.get(basePlaceKey) ?? [];
    group.push(place);
    groups.set(basePlaceKey, group);
  });

  const usedKeys = new Set();
  const sortByPrimaryPlacePriority = (left, right) => {
    const leftPopulation = left.population ?? -1;
    const rightPopulation = right.population ?? -1;

    if (rightPopulation !== leftPopulation) {
      return rightPopulation - leftPopulation;
    }

    return left.geonameId - right.geonameId;
  };

  groups.forEach((group) => group.sort(sortByPrimaryPlacePriority));

  intermediatePlaces.forEach((place) => {
    const basePlaceKey = buildBasePlaceKey(place);
    if (!basePlaceKey) {
      place.placeKey = `place-${place.geonameId}`;
      usedKeys.add(place.placeKey);
      return;
    }

    const group = groups.get(basePlaceKey) ?? [];
    let resolvedKey = basePlaceKey;

    if (group.length > 1 && group[0] !== place) {
      const admin1Segment = normalizeSlugSegment(place.admin1Code);
      resolvedKey = admin1Segment ? `${basePlaceKey}-${admin1Segment}` : `${basePlaceKey}-${place.geonameId}`;

      if (usedKeys.has(resolvedKey)) {
        resolvedKey = `${basePlaceKey}-${place.geonameId}`;
      }
    }

    if (usedKeys.has(resolvedKey)) {
      resolvedKey = `${basePlaceKey}-${place.geonameId}`;
    }

    place.placeKey = resolvedKey;
    usedKeys.add(resolvedKey);
  });
}

function buildAliasList(place, alternateState, aliasLimit) {
  const excludedValues = new Set(
    [place.name, place.nameEn, place.nameZh, place.asciiName]
      .map((value) => normalizeText(value).toLowerCase())
      .filter(Boolean),
  );
  const aliases = new Set();

  place.alternateNames.forEach((alternateName) => addUniqueValue(aliases, alternateName, excludedValues));
  alternateState.en.forEach((alternateName) => addUniqueValue(aliases, alternateName, excludedValues));
  alternateState.zh.forEach((alternateName) => addUniqueValue(aliases, alternateName, excludedValues));
  alternateState.aliasCandidates.forEach((alternateName) => addUniqueValue(aliases, alternateName, excludedValues));

  const values = [...aliases].sort((left, right) => left.localeCompare(right, "en"));
  return values.slice(0, aliasLimit);
}

function toIntermediatePlace(place, alternateState, aliasLimit) {
  const nameEn = choosePreferredLabel(
    [alternateState.preferredEn, ...alternateState.en],
    [place.name, place.asciiName],
  );
  const nameZh = choosePreferredLabel(
    [alternateState.preferredZh, ...alternateState.zh],
    [],
  );
  const aliases = buildAliasList(
    {
      ...place,
      nameEn,
      nameZh,
    },
    alternateState,
    aliasLimit,
  );

  let confidence = "high";
  if (!nameZh || !alternateState.preferredEn) {
    confidence = "medium";
  }
  if (!nameEn) {
    confidence = "low";
  }

  return {
    geonameId: place.geonameId,
    nameEn,
    nameZh,
    asciiName: place.asciiName,
    countryCode: place.countryCode,
    admin1Code: place.admin1Code,
    admin2Code: place.admin2Code,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    population: place.population,
    aliases: aliases.length > 0 ? aliases : undefined,
    source: "geonames",
    sourceId: String(place.geonameId),
    coordinatePrecision: "city",
    confidence,
    placeKey: "",
    name: place.name,
    alternateNames: place.alternateNames,
  };
}

function validatePlaces(places) {
  const placeKeys = new Set();
  const geonameIds = new Set();

  for (const place of places) {
    if (!place.placeKey || placeKeys.has(place.placeKey)) {
      throw new Error(`Invalid or duplicate placeKey: ${place.placeKey}`);
    }
    placeKeys.add(place.placeKey);

    if (!Number.isInteger(place.geonameId) || geonameIds.has(place.geonameId)) {
      throw new Error(`Invalid or duplicate geonameId: ${place.geonameId}`);
    }
    geonameIds.add(place.geonameId);

    if (!normalizeText(place.nameEn || place.nameZh || place.asciiName)) {
      throw new Error(`Place ${place.placeKey} is missing all display labels.`);
    }

    if (!place.countryCode) {
      throw new Error(`Place ${place.placeKey} is missing countryCode.`);
    }

    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
      throw new Error(`Place ${place.placeKey} has invalid coordinates.`);
    }

    if (place.coordinatePrecision !== "city") {
      throw new Error(`Place ${place.placeKey} has invalid coordinatePrecision.`);
    }

    if (!["high", "medium", "low"].includes(place.confidence)) {
      throw new Error(`Place ${place.placeKey} has invalid confidence.`);
    }

    if (place.aliases?.some((alias) => [place.nameEn, place.nameZh, place.asciiName].includes(alias))) {
      throw new Error(`Place ${place.placeKey} contains a standard display label inside aliases.`);
    }
  }
}

function sortPlaces(left, right) {
  return (
    left.countryCode.localeCompare(right.countryCode, "en") ||
    normalizeText(left.nameEn || left.asciiName || left.nameZh).localeCompare(
      normalizeText(right.nameEn || right.asciiName || right.nameZh),
      "en",
    ) ||
    left.geonameId - right.geonameId
  );
}

function stripIntermediateFields(place) {
  const { name, alternateNames, ...finalPlace } = place;
  return finalPlace;
}

function parseCandidateGeonameIds(reviewRows) {
  return new Set(
    reviewRows
      .filter((row) => row.recommendedAction === "can_auto_add_place")
      .flatMap((row) => row.candidateGeonameIdList ?? [])
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value)),
  );
}

async function loadRailNeededChinaPlaces(options, alternateNamesTxtPath) {
  if (!(await fileExists(options.railReviewCsvPath))) {
    return [];
  }

  const reviewRows = await readSafeRailGeonamesReviewRows(options.railReviewCsvPath);
  const candidateGeonameIds = parseCandidateGeonameIds(reviewRows);
  if (candidateGeonameIds.size === 0) {
    return [];
  }

  const cities1000ZipPath = path.join(options.cacheDir, "cities1000.zip");
  const cities1000TxtPath = path.join(options.cacheDir, "cities1000.txt");
  await ensureDownloadedFile(`${GEONAMES_BASE_URL}/cities1000.zip`, cities1000ZipPath, options);
  await ensureExtractedFile(cities1000ZipPath, cities1000TxtPath);

  const { places: rawPlaces } = await parseCityRows(cities1000TxtPath);
  const filteredPlaces = rawPlaces.filter((place) => candidateGeonameIds.has(place.geonameId));
  const filteredGeonameIds = new Set(filteredPlaces.map((place) => place.geonameId));
  const alternateNamesByGeonameId = await parseAlternateNames(alternateNamesTxtPath, filteredGeonameIds);

  return filteredPlaces.map((place) =>
    toIntermediatePlace(
      place,
      alternateNamesByGeonameId.get(place.geonameId) ?? createAlternateNameAccumulator(),
      options.aliasLimit,
    ),
  );
}

function mergeRailNeededChinaPlaces(basePlaces, railNeededPlaces) {
  const mergedPlaces = [...basePlaces];
  const geonameIds = new Set(basePlaces.map((place) => place.geonameId));
  const placeKeys = new Map(basePlaces.map((place) => [place.placeKey, place.geonameId]));
  const addedPlaces = [];
  const skippedConflicts = [];

  for (const place of railNeededPlaces) {
    if (geonameIds.has(place.geonameId)) {
      continue;
    }

    const resolvedPlaceKey = buildBasePlaceKey(place);
    if (!resolvedPlaceKey) {
      skippedConflicts.push({ geonameId: place.geonameId, reason: "missing_place_key" });
      continue;
    }

    const conflictingGeonameId = placeKeys.get(resolvedPlaceKey);
    if (conflictingGeonameId && conflictingGeonameId !== place.geonameId) {
      skippedConflicts.push({ geonameId: place.geonameId, placeKey: resolvedPlaceKey, conflictingGeonameId });
      continue;
    }

    place.placeKey = resolvedPlaceKey;
    geonameIds.add(place.geonameId);
    placeKeys.set(place.placeKey, place.geonameId);
    addedPlaces.push(place);
    mergedPlaces.push(stripIntermediateFields(place));
  }

  return {
    mergedPlaces: mergedPlaces.sort(sortPlaces),
    addedCount: addedPlaces.length,
    skippedConflicts,
  };
}
async function generatePlaceCatalog(options) {
  const cityZipPath = path.join(options.cacheDir, `${options.citySource}.zip`);
  const cityTxtPath = path.join(options.cacheDir, `${options.citySource}.txt`);
  const alternateNamesZipPath = path.join(options.cacheDir, "alternateNamesV2.zip");
  const alternateNamesTxtPath = path.join(options.cacheDir, "alternateNamesV2.txt");
  await ensureDownloadedFile(`${GEONAMES_BASE_URL}/${options.citySource}.zip`, cityZipPath, options);
  await ensureDownloadedFile(`${GEONAMES_BASE_URL}/alternateNamesV2.zip`, alternateNamesZipPath, options);

  await ensureExtractedFile(cityZipPath, cityTxtPath);
  await ensureExtractedFile(alternateNamesZipPath, alternateNamesTxtPath);

  const { places: rawPlaces, geonameIds } = await parseCityRows(cityTxtPath);
  const alternateNamesByGeonameId = await parseAlternateNames(alternateNamesTxtPath, geonameIds);

  const intermediatePlaces = rawPlaces.map((place) =>
    toIntermediatePlace(
      place,
      alternateNamesByGeonameId.get(place.geonameId) ?? createAlternateNameAccumulator(),
      options.aliasLimit,
    ),
  );

  assignPlaceKeys(intermediatePlaces);

  const basePlaces = intermediatePlaces
    .map(stripIntermediateFields)
    .sort(sortPlaces);

  const railNeededPlaces = await loadRailNeededChinaPlaces(options, alternateNamesTxtPath);
  const { mergedPlaces, addedCount, skippedConflicts } = mergeRailNeededChinaPlaces(basePlaces, railNeededPlaces);

  validatePlaces(mergedPlaces);
  return {
    places: mergedPlaces,
    railNeededChinaAddedCount: addedCount,
    railNeededChinaSkippedConflicts: skippedConflicts,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await generatePlaceCatalog(options);

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(result.places)}\n`, "utf8");

  const outputStat = await stat(options.outputPath);
  console.log(`Generated ${result.places.length} place catalog records -> ${options.outputPath}`);
  console.log(`Output size: ${outputStat.size} bytes`);
  console.log(`City source: ${options.citySource}`);
  console.log(`Rail-needed China additions applied: ${result.railNeededChinaAddedCount}`);
  console.log(`Rail-needed China additions skipped for conflicts: ${result.railNeededChinaSkippedConflicts.length}`);
}

await main();
