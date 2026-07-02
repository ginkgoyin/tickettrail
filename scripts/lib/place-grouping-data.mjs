import { readFile } from "node:fs/promises";
import path from "node:path";

const GROUPING_LEVELS = new Set(["municipality", "prefecture", "league", "autonomous_prefecture"]);

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

export async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const normalizedRaw = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalizedRaw);
}

export async function loadPlaceCatalogIndex(placeCatalogPath) {
  const places = await readJsonFile(placeCatalogPath);
  const index = new Map();

  for (const place of places) {
    const placeKey = normalizeText(place.placeKey);
    if (!placeKey) {
      continue;
    }

    index.set(placeKey, place);
  }

  return index;
}

export function buildPlaceGroupingEntries(sourceEntries, placeCatalogIndex) {
  if (!Array.isArray(sourceEntries)) {
    throw new Error("Place grouping source must be an array.");
  }

  const seenPlaceKeys = new Set();

  return sourceEntries.map((entry, index) => {
    const placeKey = normalizeText(entry.placeKey);
    const summaryPlaceKey = normalizeText(entry.summaryPlaceKey);
    const groupingLevel = normalizeText(entry.groupingLevel);
    const notes = normalizeText(entry.notes) || undefined;

    if (!placeKey) {
      throw new Error(`Place grouping row ${index + 1} is missing placeKey.`);
    }

    if (seenPlaceKeys.has(placeKey)) {
      throw new Error(`Duplicate place grouping placeKey: ${placeKey}`);
    }
    seenPlaceKeys.add(placeKey);

    if (!summaryPlaceKey) {
      throw new Error(`Place grouping row ${index + 1} is missing summaryPlaceKey.`);
    }

    if (placeKey === summaryPlaceKey) {
      throw new Error(`Place grouping row ${index + 1} cannot group ${placeKey} to itself.`);
    }

    if (!GROUPING_LEVELS.has(groupingLevel)) {
      throw new Error(
        `Place grouping row ${index + 1} has invalid groupingLevel: ${groupingLevel || "<empty>"}`,
      );
    }

    const place = placeCatalogIndex.get(placeKey);
    if (!place) {
      throw new Error(`Place grouping row ${index + 1} references unknown placeKey: ${placeKey}`);
    }

    const summaryPlace = placeCatalogIndex.get(summaryPlaceKey);
    if (!summaryPlace) {
      throw new Error(
        `Place grouping row ${index + 1} references unknown summaryPlaceKey: ${summaryPlaceKey}`,
      );
    }

    return {
      placeKey,
      summaryPlaceKey,
      summaryPlaceNameZh: normalizeText(summaryPlace.nameZh) || undefined,
      summaryPlaceNameEn: normalizeText(summaryPlace.nameEn) || undefined,
      groupingLevel,
      groupingSource: "reviewed",
      notes,
    };
  });
}

export async function generatePlaceGroupingData({
  sourcePath,
  placeCatalogPath,
}) {
  const [sourceEntries, placeCatalogIndex] = await Promise.all([
    readJsonFile(sourcePath),
    loadPlaceCatalogIndex(placeCatalogPath),
  ]);

  return buildPlaceGroupingEntries(sourceEntries, placeCatalogIndex);
}

export function resolveProjectPath(...segments) {
  return path.resolve(...segments);
}
