import { build } from "bun";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// bun tests/benchmarks/run-range-selection.mjs --output /tmp/range.json
// Run separately from builds and other timing work. The browser is isolated.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-range-"));
let browser;
try {
  const result = await build({
    entrypoints: [
      join(repository, "tests/benchmarks/range-selection-preview.ts"),
    ],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "range.js",
  });
  if (!result.success) throw new Error(result.logs.join("\n"));
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  await page.addScriptTag({ path: join(temporary, "range.js") });
  const report = await page.evaluate(() =>
    globalThis.runRangeSelectionPreviewBenchmark(),
  );
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0)
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(report, null, 2),
    );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  rmSync(temporary, { recursive: true, force: true });
}
