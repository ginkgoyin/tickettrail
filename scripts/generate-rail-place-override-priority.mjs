import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRailGeonamesCandidateReviewCsv } from "./lib/rail-geonames-review.mjs";

const DEFAULT_INPUT_PATH = path.resolve("docs/reviews/rail-geonames-candidate-review.csv");
const DEFAULT_OUTPUT_PATH = path.resolve("docs/reviews/rail-place-override-priority.csv");
const SEARCH_ROOTS = ["docs", "tests"];

function normalizeText(value) {
  return `${value ?? ""}`.trim();
}

function escapeCsv(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  if (!/[",\r\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

function splitPipeField(value) {
  return normalizeText(value)
    .split("|")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    inputPath: DEFAULT_INPUT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--in" && argv[index + 1]) {
      args.inputPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (value.startsWith("--in=")) {
      args.inputPath = path.resolve(value.slice("--in=".length));
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

function shouldIncludeSearchFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/docs/reviews/")) {
    return false;
  }

  return /\.(md|ts|tsx|mjs)$/i.test(filePath);
}

async function readSearchCorpus() {
  const filePaths = [];

  async function walk(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
      } else if (shouldIncludeSearchFile(nextPath)) {
        filePaths.push(nextPath);
      }
    }
  }

  for (const root of SEARCH_ROOTS) {
    await walk(path.resolve(root));
  }

  return Promise.all(filePaths.map(async (filePath) => ({
    filePath,
    content: await readFile(filePath, "utf8"),
  })));
}

function countMentions(text, tokens) {
  const haystack = text.toLowerCase();
  return tokens.reduce((count, token) => {
    const normalized = normalizeText(token).toLowerCase();
    return normalized && haystack.includes(normalized) ? count + 1 : count;
  }, 0);
}

function buildCandidateSummary(row) {
  if (row.candidateCount <= 0) {
    return "No candidate";
  }

  const names = splitPipeField(row.candidateNames).slice(0, 3).join(" | ");
  const geonameIds = splitPipeField(row.candidateGeonameIds).slice(0, 3).join(" | ");
  return [names, geonameIds ? `GeoNames: ${geonameIds}` : ""].filter(Boolean).join(" / ");
}

function buildSuggestedNextReviewAction(row) {
  if (row.matchStatus === "unique_zh_exact_key_conflict") {
    return "Resolve key conflict before adding any override.";
  }
  if (row.matchStatus === "ambiguous_multi_candidate") {
    return "Choose one candidate manually before adding an override.";
  }
  if (row.matchStatus === "unique_en_or_slug_only") {
    return "Require explicit human approval before any override.";
  }
  if (row.matchStatus === "no_candidate") {
    return "Keep unresolved or add a reviewed parent/place decision later.";
  }

  return "Review manually before any override.";
}

function buildOverrideReady(row) {
  return row.matchStatus === "unique_zh_exact_key_conflict" ? "yes-after-review" : "no";
}

function computePriorityScore(row, repoCorpus) {
  const telecodes = splitPipeField(row.sampleTelecodes);
  const stationNames = splitPipeField(row.sampleStationNamesZh);
  const tokens = [
    row.currentPlaceKey,
    row.currentPlaceNameZh,
    row.currentPlaceNameEn,
    ...telecodes,
    ...stationNames,
  ];

  const repoMentions = repoCorpus.reduce((count, file) => count + countMentions(file.content, tokens), 0);
  let score = 0;

  score += Number.parseInt(row.affectedStationCount, 10) * 100;
  score += repoMentions * 25;

  if (row.matchStatus === "unique_zh_exact_key_conflict") {
    score += 400;
  } else if (row.matchStatus === "ambiguous_multi_candidate") {
    score += 300;
  } else if (row.matchStatus === "unique_en_or_slug_only") {
    score += 150;
  }

  if (tokens.some((token) => ["KUX", "横道河子东", "横道河子", "cn-hengdaohezi"].includes(normalizeText(token)))) {
    score += 250;
  }

  return { score, repoMentions };
}

function serializePriorityCsv(rows) {
  const header = [
    "currentPlaceKey",
    "currentPlaceNameZh",
    "currentPlaceNameEn",
    "affectedStationCount",
    "sampleTelecodes",
    "sampleStationNamesZh",
    "matchStatus",
    "recommendedAction",
    "candidateSummary",
    "suggestedNextReviewAction",
    "overrideReady",
    "repoMentionCount",
    "reviewerDecision",
    "reviewerNotes",
  ];

  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push([
      row.currentPlaceKey,
      row.currentPlaceNameZh,
      row.currentPlaceNameEn,
      row.affectedStationCount,
      row.sampleTelecodes,
      row.sampleStationNamesZh,
      row.matchStatus,
      row.recommendedAction,
      row.candidateSummary,
      row.suggestedNextReviewAction,
      row.overrideReady,
      row.repoMentionCount,
      row.reviewerDecision,
      row.reviewerNotes,
    ].map(escapeCsv).join(","));
  });

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [rows, repoCorpus] = await Promise.all([
    readRailGeonamesCandidateReviewCsv(args.inputPath),
    readSearchCorpus(),
  ]);

  const priorityRows = rows.map((row) => {
    const { score, repoMentions } = computePriorityScore(row, repoCorpus);
    return {
      ...row,
      candidateSummary: buildCandidateSummary(row),
      suggestedNextReviewAction: buildSuggestedNextReviewAction(row),
      overrideReady: buildOverrideReady(row),
      repoMentionCount: repoMentions,
      reviewerDecision: "",
      reviewerNotes: "",
      _score: score,
    };
  }).sort((left, right) =>
    right._score - left._score
    || (Number.parseInt(right.affectedStationCount, 10) - Number.parseInt(left.affectedStationCount, 10))
    || normalizeText(left.currentPlaceKey).localeCompare(normalizeText(right.currentPlaceKey), "en"),
  );

  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await writeFile(args.outputPath, serializePriorityCsv(priorityRows), "utf8");

  console.log(`Generated ${priorityRows.length} priority review rows -> ${args.outputPath}`);
}

await main();
