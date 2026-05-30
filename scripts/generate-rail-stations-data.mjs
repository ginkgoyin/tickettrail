import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = path.resolve("data-sources/12306/station_name.js");
const DEFAULT_OUTPUT = path.resolve("src/data/rail-stations.generated.json");
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
    nameZh.endsWith("站") ? "" : `${nameZh}站`,
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

async function main() {
  const positionalArgs = process.argv.slice(2).filter((value) => !value.startsWith("--encoding="));
  const encodingArg = process.argv.find((value) => value.startsWith("--encoding="));
  const explicitEncoding = encodingArg ? normalizeText(encodingArg.split("=")[1]).toLowerCase() : "";
  const inputPath = path.resolve(positionalArgs[0] ?? DEFAULT_INPUT);
  const outputPath = path.resolve(positionalArgs[1] ?? DEFAULT_OUTPUT);
  const sourceBuffer = await readFile(inputPath);
  const payload = extractStationPayload(decodeBuffer(sourceBuffer, explicitEncoding || undefined));
  const stations = dedupeStations(parseStationEntries(payload)).sort(sortStations);

  if (!stations.length) {
    throw new Error("No rail station entries were parsed from the provided 12306 source.");
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(stations, null, 2)}\n`, "utf8");

  console.log(`Generated ${stations.length} rail station records -> ${outputPath}`);
}

await main();
