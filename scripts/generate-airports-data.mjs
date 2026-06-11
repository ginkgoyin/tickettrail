import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = path.resolve("airports.csv");
const DEFAULT_OUTPUT = path.resolve("src/data/airports.generated.json");
const ALLOWED_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);
const TYPE_PRIORITY = {
  large_airport: 3,
  medium_airport: 2,
  small_airport: 1,
};

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === "\"") {
      if (inQuotes && content[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && content[index + 1] === "\n") {
        index += 1;
      }

      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return value.trim();
}

function normalizePlaceSegment(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPlaceKey(countryCode, municipality, fallbackName) {
  const normalizedCountry = normalizePlaceSegment(countryCode);
  const normalizedPlace = normalizePlaceSegment(municipality || fallbackName);

  if (!normalizedCountry && !normalizedPlace) {
    return undefined;
  }

  if (!normalizedCountry) {
    return normalizedPlace || undefined;
  }

  if (!normalizedPlace) {
    return normalizedCountry || undefined;
  }

  return `${normalizedCountry}-${normalizedPlace}`;
}

function buildAliases(record) {
  const aliases = [
    record.iata_code,
    record.ident,
    record.icao_code,
    record.gps_code,
    record.local_code,
    record.name,
    record.municipality,
    record.iso_region,
    record.keywords,
  ]
    .flatMap((value) => (value ? value.split(/[;/|]/) : []))
    .map(normalizeText)
    .filter(Boolean);

  return Array.from(new Set(aliases));
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildAirportRecord(record) {
  const iataCode = normalizeText(record.iata_code).toUpperCase();
  const nameEn = normalizeText(record.name);
  const municipality = normalizeText(record.municipality) || undefined;
  const countryCode = normalizeText(record.iso_country).toUpperCase() || undefined;
  const placeNameEn = municipality || nameEn;

  return {
    id: `loc-airport-${iataCode.toLowerCase()}`,
    locationType: "airport",
    code: iataCode,
    nameEn,
    municipality,
    placeNameEn,
    placeKey: buildPlaceKey(countryCode, municipality, nameEn),
    coordinatePrecision: "exact",
    aliases: buildAliases(record),
    latitude: toNumber(record.latitude_deg),
    longitude: toNumber(record.longitude_deg),
    countryCode,
  };
}

function shouldIncludeAirport(record) {
  const type = normalizeText(record.type);
  const iataCode = normalizeText(record.iata_code);

  if (!ALLOWED_TYPES.has(type)) {
    return false;
  }

  if (!iataCode) {
    return false;
  }

  return true;
}

function compareAirportQuality(nextRecord, currentRecord) {
  const nextTypePriority = TYPE_PRIORITY[normalizeText(nextRecord.type)] ?? 0;
  const currentTypePriority = TYPE_PRIORITY[normalizeText(currentRecord.type)] ?? 0;

  if (nextTypePriority !== currentTypePriority) {
    return nextTypePriority - currentTypePriority;
  }

  const nextScheduled = normalizeText(nextRecord.scheduled_service) === "yes" ? 1 : 0;
  const currentScheduled = normalizeText(currentRecord.scheduled_service) === "yes" ? 1 : 0;

  if (nextScheduled !== currentScheduled) {
    return nextScheduled - currentScheduled;
  }

  return normalizeText(nextRecord.name).localeCompare(normalizeText(currentRecord.name), "en");
}

async function main() {
  const inputPath = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
  const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);
  const csv = await readFile(inputPath, "utf8");
  const rows = parseCsv(csv);

  if (rows.length < 2) {
    throw new Error("CSV file does not contain airport records.");
  }

  const [header, ...records] = rows;
  const columns = header.map((column) => normalizeText(column).replace(/^"|"$/g, ""));
  const bestByIata = new Map();

  for (const rawRow of records) {
    const row = Object.fromEntries(columns.map((column, index) => [column, rawRow[index] ?? ""]));

    if (!shouldIncludeAirport(row)) {
      continue;
    }

    const iataCode = normalizeText(row.iata_code).toUpperCase();
    const current = bestByIata.get(iataCode);

    if (!current || compareAirportQuality(row, current) > 0) {
      bestByIata.set(iataCode, row);
    }
  }

  const airports = Array.from(bestByIata.values())
    .map(buildAirportRecord)
    .sort((left, right) =>
      (left.countryCode ?? "").localeCompare(right.countryCode ?? "", "en")
      || ((left.aliases.find((alias) => alias !== left.code && alias !== left.nameEn) ?? "").localeCompare(
        right.aliases.find((alias) => alias !== right.code && alias !== right.nameEn) ?? "",
        "en",
      ))
      || (left.code ?? "").localeCompare(right.code ?? "", "en")
      || (left.nameEn ?? "").localeCompare(right.nameEn ?? "", "en"),
    );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(airports, null, 2)}\n`, "utf8");

  console.log(`Generated ${airports.length} airport records -> ${outputPath}`);
}

await main();
