// Measurements operate on one live page and must run sequentially.
/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { exportGraph } from "../../features/graph-editor/io/export-graph";

// Uses a fresh browser context and a test-local clipboard stub.
const seedModel = {
  ...createEmptyGraphModel({ allowSelfLoops: true }),
  nodes: Array.from({ length: 600 }, (_, i) => ({
    id: `n${i}`,
    order: i,
    label: "長いラベル".repeat(20),
    x: (i % 32) * 2,
    y: Math.floor(i / 32) * 2,
  })),
  edges: Array.from({ length: 600 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i}`,
  })),
};
const model = parseGraphModelJson(serializeGraphModel(seedModel))!;
const expected = exportGraph(model, "tikz");
const measureOnly = process.argv.includes("--measure-only");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((raw) => {
    localStorage.setItem("graph-editor-graph", raw);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copiedExport: string }).copiedExport = text;
        },
      },
    });
  }, serializeGraphModel(model));
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3314/en");
  await page.locator('[data-canvas-ready="true"]').waitFor();
  await page.waitForTimeout(2000); // Complete initial canvas routing before timing export.
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const format = page.getByRole("combobox", { name: "Export format" });
  const output = page.locator("pre[aria-label^='Exported']");
  const gaps: number[] = [];
  for (let run = 0; run < 5; run++) {
    if (run > 0) {
      // Start each sample without the completed-export cache. Reopening is
      // tested separately below so cache hits do not skew generation timing.
      await page.reload();
      await page.locator('[data-canvas-ready="true"]').waitFor();
      await page.waitForTimeout(2000);
      await page.getByRole("button", { name: "Export", exact: true }).click();
    }
    await format.selectOption("edge-list");
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const state = { gaps: [] as number[], last: 0, frame: 0, active: true };
      const tick = (time: number) => {
        if (state.last) state.gaps.push(time - state.last);
        state.last = time;
        if (state.active) state.frame = requestAnimationFrame(tick);
      };
      state.frame = requestAnimationFrame(tick);
      (window as unknown as { exportFrames: typeof state }).exportFrames =
        state;
    });
    await page.waitForTimeout(40);
    await format.selectOption("tikz");
    await page.waitForFunction(() =>
      document
        .querySelector("pre[aria-label^='Exported']")
        ?.textContent?.includes("\\endgroup"),
    );
    assert.ok((await output.textContent()) === expected, "exact TikZ output");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    gaps.push(
      await page.evaluate(() => {
        const state = (
          window as unknown as {
            exportFrames: { active: boolean; frame: number; gaps: number[] };
          }
        ).exportFrames;
        state.active = false;
        cancelAnimationFrame(state.frame);
        return Math.max(...state.gaps);
      }),
    );
  }
  const report = {
    tikzFrameGapMedianMs: gaps.toSorted((a, b) => a - b)[2],
    tikzFrameGapMaxMs: Math.max(...gaps),
  };
  console.log(JSON.stringify(report));
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0 && process.argv[outputIndex + 1])
    writeFileSync(
      process.argv[outputIndex + 1]!,
      JSON.stringify(report, null, 2),
    );
  if (!measureOnly) {
    await page.reload();
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    // Switch away while routing is scheduled; old TeX must not overwrite JSON.
    await format.selectOption("edge-list");
    await format.selectOption("tikz");
    await format.selectOption("json");
    await page.waitForTimeout(150);
    assert.ok(
      (await output.textContent()) === serializeGraphModel(model),
      "latest JSON output after pending TikZ cancellation",
    );
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => (window as unknown as { copiedExport: string }).copiedExport,
      ),
      serializeGraphModel(model),
    );
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save as .json", exact: true })
      .click();
    const download = await downloadEvent;
    assert.equal(
      readFileSync((await download.path())!, "utf8"),
      serializeGraphModel(model),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(220);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    assert.equal(await format.inputValue(), "json");
    assert.ok(
      (await output.textContent()) === serializeGraphModel(model),
      "exact JSON after reopen",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    measureOnly
      ? "Export browser measurement passed: exact TikZ"
      : "Export browser verification passed: exact TikZ, format cancellation, latest copy/download, reopen",
  );
} finally {
  await browser.close();
}
