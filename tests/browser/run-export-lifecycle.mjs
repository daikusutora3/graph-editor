import { build } from "bun";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-export-lifecycle-"));
let browser;
try {
  const result = await build({
    entrypoints: [
      join(repository, "tests/browser/export-lifecycle-harness.tsx"),
    ],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "export-lifecycle.js",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "export-lifecycle-instrumentation",
        setup(builder) {
          builder.onLoad({ filter: /export-graph\.ts$/ }, (args) => {
            const source = readFileSync(args.path, "utf8");
            const anchor = "export function* createGraphExportTask(";
            if (!source.includes(anchor))
              throw new Error("Missing export task instrumentation anchor");
            return {
              loader: "ts",
              contents:
                source.replace(
                  anchor,
                  "function* createUninstrumentedGraphExportTask(",
                ) +
                `
export function createGraphExportTask(model: GraphModel, format: GraphExportFormat): Generator<void, string> {
  const task = createUninstrumentedGraphExportTask(model, format);
  return (globalThis as unknown as { wrapExportTask: (model: GraphModel, format: GraphExportFormat, task: Generator<void, string>) => Generator<void, string> }).wrapExportTask(model, format, task);
}
`,
            };
          });
          builder.onLoad({ filter: /file-actions\.ts$/ }, (args) => {
            const source = readFileSync(args.path, "utf8");
            const anchor =
              "export function downloadBlob(blob: Blob, fileName: string) {";
            if (!source.includes(anchor))
              throw new Error("Missing download instrumentation anchor");
            return {
              loader: "ts",
              contents: source.replace(
                anchor,
                `${anchor}
(globalThis as unknown as { captureExportDownload: (blob: Blob, fileName: string) => void }).captureExportDownload(blob, fileName);
return;
`,
              ),
            };
          });
        },
      },
    ],
  });
  if (!result.success) throw new Error(result.logs.join("\n"));
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addScriptTag({ path: join(temporary, "export-lifecycle.js") });
  const report = await page.evaluate(() => globalThis.verifyExportLifecycle());
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  rmSync(temporary, { recursive: true, force: true });
}
