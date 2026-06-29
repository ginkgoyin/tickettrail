import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function decorateReviewRow(row) {
  row.affectedStationCount = Number.parseInt(row.affectedStationCount, 10) || 0;
  row.candidateCount = Number.parseInt(row.candidateCount, 10) || 0;
  row.sampleTelecodeList = splitPipeField(row.sampleTelecodes);
  row.sampleStationNameZhList = splitPipeField(row.sampleStationNamesZh);
  row.candidateGeonameIdList = splitPipeField(row.candidateGeonameIds);
  row.candidateExistingPlaceKeyList = splitPipeField(row.candidateExistingPlaceKey);
  return row;
}

function splitPipeField(value) {
  return normalizeText(value)
    .split("|")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

export async function readRailGeonamesCandidateReviewCsv(filePath) {
  const source = await readFile(filePath, "utf8");

  if (path.extname(filePath).toLowerCase() === ".json") {
    return JSON.parse(source).map((row) => decorateReviewRow({ ...row }));
  }

  const lines = source.trim().split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (const line of lines.slice(1)) {
    if (!normalizeText(line)) {
      continue;
    }

    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? ""]),
    );
    rows.push(decorateReviewRow(row));
  }

  return rows;
}

export async function readSafeRailGeonamesReviewRows(filePath) {
  const rows = await readRailGeonamesCandidateReviewCsv(filePath);
  return rows.filter((row) =>
    row.recommendedAction === "can_auto_add_place" ||
    row.recommendedAction === "can_canonicalize_to_existing_catalog",
  );
}
