import { build } from "bun";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// bun tests/benchmarks/run-export-matrix.mjs --output /tmp/export-matrix.json
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-matrix-"));
let browser;
try {
  const result = await build({
    entrypoints: [
      join(repository, "tests/benchmarks/export-matrix-performance.ts"),
    ],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "matrix.js",
  });
  if (!result.success) throw new Error(result.logs.join("\n"));
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addScriptTag({ path: join(temporary, "matrix.js") });
  const report = await page.evaluate(() =>
    globalThis.runExportMatrixBenchmark(),
  );
  if (errors.length) throw new Error(errors.join("\n"));
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
