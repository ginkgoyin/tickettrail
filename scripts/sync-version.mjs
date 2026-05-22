import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const tauriConfigPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function replaceCargoVersion(filePath, version) {
  const source = fs.readFileSync(filePath, "utf8");
  const next = source.replace(
    /(\[package\][\s\S]*?\nversion = ")([^"]+)(")/,
    `$1${version}$3`,
  );

  if (next === source) {
    fail("未能在 Cargo.toml 中找到可替换的 package.version。");
  }

  fs.writeFileSync(filePath, next, "utf8");
}

const nextVersion = process.argv[2]?.trim();

if (!nextVersion) {
  fail("用法：npm run version:sync -- <version>");
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(nextVersion)) {
  fail(`版本号格式不合法：${nextVersion}`);
}

const packageJson = readJson(packageJsonPath);
packageJson.version = nextVersion;
writeJson(packageJsonPath, packageJson);

const tauriConfig = readJson(tauriConfigPath);
tauriConfig.version = nextVersion;
writeJson(tauriConfigPath, tauriConfig);

replaceCargoVersion(cargoTomlPath, nextVersion);

console.log(`已同步版本号到 ${nextVersion}`);
