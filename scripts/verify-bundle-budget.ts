import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

type RouteBundleStats = Array<{
  route: string;
  firstLoadChunkPaths: string[];
  firstLoadUncompressedJsBytes: number;
}>;

const ROOT = process.cwd();
const ROUTE = "/";
const KB = 1024;
const BUDGETS = {
  firstLoadJsGzipBytes: 360 * KB,
  cssGzipBytes: 12 * KB,
  totalGzipBytes: 380 * KB,
};

const statsPath = join(ROOT, ".next/diagnostics/route-bundle-stats.json");

if (!existsSync(statsPath)) {
  console.error(
    "Bundle stats were not found. Run `bun run verify:build` before `bun run verify:bundle`.",
  );
  process.exit(1);
}

const stats = JSON.parse(readFileSync(statsPath, "utf8")) as RouteBundleStats;
const routeStats = stats.find((item) => item.route === ROUTE);

if (!routeStats) {
  console.error(`Bundle stats for route ${ROUTE} were not found.`);
  process.exit(1);
}

const jsChunks = routeStats.firstLoadChunkPaths.map((chunkPath) =>
  readAsset(chunkPath),
);
const cssChunks = readCssChunks();
const jsGzipBytes = sum(jsChunks.map((asset) => asset.gzipBytes));
const cssGzipBytes = sum(cssChunks.map((asset) => asset.gzipBytes));
const totalGzipBytes = jsGzipBytes + cssGzipBytes;
const failures = [
  assertBudget("first-load JS gzip", jsGzipBytes, BUDGETS.firstLoadJsGzipBytes),
  assertBudget("CSS gzip", cssGzipBytes, BUDGETS.cssGzipBytes),
  assertBudget("JS+CSS gzip", totalGzipBytes, BUDGETS.totalGzipBytes),
].filter(Boolean);

console.log(`Bundle budget for ${ROUTE}`);
console.log(
  `- first-load JS raw: ${formatBytes(routeStats.firstLoadUncompressedJsBytes)}`,
);
console.log(`- first-load JS gzip: ${formatBytes(jsGzipBytes)}`);
console.log(`- CSS gzip: ${formatBytes(cssGzipBytes)}`);
console.log(`- JS+CSS gzip: ${formatBytes(totalGzipBytes)}`);
console.log("- largest first-load JS chunks:");

for (const asset of [...jsChunks]
  .sort((a, b) => b.rawBytes - a.rawBytes)
  .slice(0, 5)) {
  console.log(
    `  ${asset.label}: ${formatBytes(asset.rawBytes)} raw / ${formatBytes(asset.gzipBytes)} gzip`,
  );
}

if (failures.length > 0) {
  console.error("Bundle budget failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Bundle budget passed");

function readAsset(assetPath: string) {
  const absolutePath = join(ROOT, assetPath);
  const content = readFileSync(absolutePath);

  return {
    label: assetPath.replace(".next/static/chunks/", ""),
    rawBytes: statSync(absolutePath).size,
    gzipBytes: gzipSync(content, { level: 9 }).length,
  };
}

function readCssChunks() {
  const chunkDir = join(ROOT, ".next/static/chunks");

  if (!existsSync(chunkDir)) {
    return [];
  }

  return readdirSync(chunkDir)
    .filter((fileName) => fileName.endsWith(".css"))
    .map((fileName) => readAsset(join(".next/static/chunks", fileName)));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function assertBudget(label: string, actual: number, budget: number) {
  if (actual <= budget) {
    return null;
  }

  return `${label} is ${formatBytes(actual)} over budget ${formatBytes(budget)}`;
}

function formatBytes(bytes: number) {
  return `${(bytes / KB).toFixed(1)} KB`;
}
