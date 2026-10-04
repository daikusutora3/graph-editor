import { build } from "bun";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// bun tests/benchmarks/run-canvas-hitboxes.mjs --output /tmp/canvas-before.json
// bun tests/benchmarks/run-canvas-hitboxes.mjs --baseline /tmp/canvas-before.json
// --overlay-source and --hitboxes-source compare saved original modules using
// the current dependencies; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is optional.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-hitboxes-"));
const bundle = join(temporary, "canvas-hitboxes.js");
let browser;
try {
  // Override only this module in memory when comparing a saved original
  // against current dependencies. The checkout is never replaced or reset.
  const sourceIndex = process.argv.indexOf("--overlay-source");
  const savedSource =
    sourceIndex >= 0
      ? readFileSync(process.argv[sourceIndex + 1], "utf8")
      : null;
  const hitboxesSourceIndex = process.argv.indexOf("--hitboxes-source");
  const savedHitboxesSource =
    hitboxesSourceIndex >= 0
      ? readFileSync(process.argv[hitboxesSourceIndex + 1], "utf8")
      : null;
  const buildResult = await build({
    entrypoints: [join(repository, "tests/benchmarks/canvas-hitboxes.tsx")],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "canvas-hitboxes.js",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "saved-hitbox-source",
        setup(builder) {
          if (savedSource !== null) {
            builder.onLoad(
              { filter: /GraphCanvasHitboxOverlays\.tsx$/ },
              () => ({
                contents: savedSource,
                loader: "tsx",
              }),
            );
          }
          if (savedHitboxesSource !== null) {
            builder.onLoad({ filter: /graph-canvas-hitboxes\.ts$/ }, () => ({
              contents: savedHitboxesSource,
              loader: "ts",
            }));
          }
        },
      },
    ],
  });
  if (!buildResult.success) throw new Error(buildResult.logs.join("\n"));
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  await page.addScriptTag({ path: bundle });
  const report = await page.evaluate(() =>
    globalThis.runCanvasHitboxBenchmark(),
  );
  report.hitboxReads = await page.evaluate(() =>
    globalThis.runCanvasHitboxReadBenchmark(),
  );
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(report, null, 2),
    );
  }
  const baselineIndex = process.argv.indexOf("--baseline");
  if (baselineIndex >= 0) {
    const baseline = JSON.parse(
      readFileSync(process.argv[baselineIndex + 1], "utf8"),
    );
    report.comparison = report.results.map((result) => {
      const previous = baseline.results.find(
        (candidate) => candidate.operation === result.operation,
      );
      return {
        operation: result.operation,
        beforeMedianMs: previous?.medianMs,
        afterMedianMs: result.medianMs,
        ratio: previous ? result.medianMs / previous.medianMs : null,
      };
    });
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  rmSync(temporary, { recursive: true, force: true });
}
