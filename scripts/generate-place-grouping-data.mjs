import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { generatePlaceGroupingData } from "./lib/place-grouping-data.mjs";

const DEFAULT_SOURCE = path.resolve("data-sources/place/place-grouping-reviewed.json");
const DEFAULT_PLACE_CATALOG = path.resolve("src/data/place-catalog.generated.json");
const DEFAULT_OUTPUT = path.resolve("src/data/place-grouping.generated.json");

function parseArgs(argv) {
  const options = {
    sourcePath: DEFAULT_SOURCE,
    placeCatalogPath: DEFAULT_PLACE_CATALOG,
    outputPath: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--source" && argv[index + 1]) {
      options.sourcePath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--source=")) {
      options.sourcePath = path.resolve(value.slice("--source=".length));
      continue;
    }

    if (value === "--place-catalog" && argv[index + 1]) {
      options.placeCatalogPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value.startsWith("--place-catalog=")) {
      options.placeCatalogPath = path.resolve(value.slice("--place-catalog=".length));
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
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await generatePlaceGroupingData(options);

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(entries)}\n`, "utf8");

  const outputStat = await stat(options.outputPath);
  console.log(`Generated ${entries.length} place grouping records -> ${options.outputPath}`);
  console.log(`Output size: ${outputStat.size} bytes`);
}

await main();
