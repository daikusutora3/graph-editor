import { build } from "bun";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// --gallery-source compares a saved original without replacing the checkout.
// Counts and Profiler instrumentation are confined to this temporary build.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-gallery-"));
const sourceIndex = process.argv.indexOf("--gallery-source");
const savedSource =
  sourceIndex >= 0 ? readFileSync(process.argv[sourceIndex + 1], "utf8") : null;
let browser;
try {
  const result = await build({
    entrypoints: [join(repository, "tests/benchmarks/sample-gallery.tsx")],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "sample-gallery.js",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "gallery-render-counter",
        setup(builder) {
          builder.onLoad({ filter: /SampleGalleryPane\.tsx$/ }, (args) => {
            const source = savedSource ?? readFileSync(args.path, "utf8");
            const anchor = "  const { locale, messages } = useI18n();";
            if (!source.includes(anchor))
              throw new Error("Card instrumentation anchor missing");
            return {
              loader: "tsx",
              contents: source.replace(
                anchor,
                `${anchor}\n  (globalThis as { recordGalleryCardRender: (kind: string) => void }).recordGalleryCardRender(sample.kind);`,
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
  await page.addScriptTag({ path: join(temporary, "sample-gallery.js") });
  const report = await page.evaluate(
    (requireIsolation) =>
      globalThis.runSampleGalleryBenchmark(requireIsolation),
    savedSource === null,
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
