import { build } from "bun";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = mkdtempSync(join(tmpdir(), "graph-editor-dormant-work-"));
let browser;
try {
  const result = await build({
    entrypoints: [join(repository, "tests/browser/dormant-work-harness.tsx")],
    target: "browser",
    format: "iife",
    outdir: temporary,
    naming: "dormant-work.js",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "dormant-parser-counters",
        setup(builder) {
          for (const [filter, anchor, kind] of [
            [
              /import-graph\.ts$/,
              "  const evaluation = evaluateGraphInputInternal(input, options);",
              "input",
            ],
            [
              /stored-graph\.ts$/,
              "export function parseStoredGraph(raw: string | null): GraphModel | null {",
              "stored",
            ],
            [
              /graph-starter-state\.ts$/,
              "function makeStarterParseKey(inputText: string, options: ImportOptions) {",
              "key",
            ],
          ]) {
            builder.onLoad({ filter }, (args) => {
              const source = readFileSync(args.path, "utf8");
              if (!source.includes(anchor))
                throw new Error(`Missing ${kind} instrumentation anchor`);
              const count = `(globalThis as { recordDormantWork: (kind: string) => void }).recordDormantWork(${JSON.stringify(kind)});`;
              return {
                loader: "ts",
                contents: source.replace(
                  anchor,
                  kind === "input"
                    ? `${count}\n${anchor}`
                    : `${anchor}\n${count}`,
                ),
              };
            });
          }
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
  await page.addScriptTag({ path: join(temporary, "dormant-work.js") });
  const report = await page.evaluate(() => globalThis.verifyDormantWork());
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify(report));
} finally {
  await browser?.close();
  rmSync(temporary, { recursive: true, force: true });
}
