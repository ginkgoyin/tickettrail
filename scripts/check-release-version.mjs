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

function readCargoVersion(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(/\[package\][\s\S]*?\nversion = "([^"]+)"/);
  if (!match) {
    fail("未能从 Cargo.toml 读取 package.version。");
  }
  return match[1];
}

const packageVersion = readJson(packageJsonPath).version;
const tauriVersion = readJson(tauriConfigPath).version;
const cargoVersion = readCargoVersion(cargoTomlPath);
const versions = [packageVersion, tauriVersion, cargoVersion];
const uniqueVersions = [...new Set(versions)];

if (uniqueVersions.length !== 1) {
  fail(
    `版本号不一致：package.json=${packageVersion}, tauri.conf.json=${tauriVersion}, Cargo.toml=${cargoVersion}`,
  );
}

const githubRef = process.env.GITHUB_REF ?? "";

if (githubRef.startsWith("refs/tags/v")) {
  const tagVersion = githubRef.replace("refs/tags/v", "");
  if (tagVersion !== packageVersion) {
    fail(`标签版本 ${tagVersion} 与项目版本 ${packageVersion} 不一致。`);
  }
}

console.log(`版本校验通过：${packageVersion}`);
