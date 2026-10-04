import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

/* eslint-disable no-await-in-loop -- Each keyboard interaction must settle before the next measurement. */

// Build and serve out/ first, then run alone (no builds or other timings).
// BASE_URL=http://127.0.0.1:3123/en bun tests/benchmarks/canvas-modifier-performance.mjs --output /tmp/modifiers.json
// Five fresh pages, ten Shift press/release cycles each, at the graph limits.
const fixture = {
  ...createEmptyGraphModel({ allowMultiEdges: true }),
  nodes: Array.from({ length: 1000 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: String(index),
    x: (index % 32) * 90,
    y: Math.floor(index / 32) * 90,
  })),
  edges: Array.from({ length: 5000 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % 1000}`,
    target: `n${(index + 1) % 1000}`,
  })),
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const reports = [];
try {
  for (let sample = 0; sample < Number(process.env.SAMPLES ?? 5); sample++) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (raw) => localStorage.setItem("graph-editor-graph", raw),
      JSON.stringify(fixture),
    );
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3123/en");
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.evaluate(() => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      );
      // eslint-disable-next-line no-underscore-dangle
      const cy = container._cyreg.cy;
      cy.zoom(1);
      cy.pan({ x: 200, y: 250 });
    });
    await page.waitForTimeout(300);
    const state = await page.evaluateHandle(() => {
      const frames = [];
      const tasks = [];
      let active = true;
      let last = performance.now();
      const observer = new PerformanceObserver((entries) => {
        tasks.push(...entries.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ type: "longtask", buffered: false });
      function frame(time) {
        if (!active) return;
        frames.push(time - last);
        last = time;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      return {
        finish() {
          active = false;
          observer.disconnect();
          return {
            frames,
            tasks,
            nodeCount: document.querySelectorAll(".ge-select-node-hitbox")
              .length,
            edgeCount: document.querySelectorAll(".ge-select-edge-hitbox")
              .length,
            pathCount: document.querySelectorAll(
              "[data-selection-hitboxes] path",
            ).length,
          };
        },
      };
    });
    for (let cycle = 0; cycle < 10; cycle++) {
      await page.keyboard.down("Shift");
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.keyboard.up("Shift");
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    }
    const result = await state.evaluate((value) => value.finish());
    await state.dispose();
    assert.equal(result.nodeCount, 1000);
    assert.equal(result.edgeCount, 5000);
    assert.equal(result.pathCount, 5000);
    assert.deepEqual(errors, []);
    const sorted = result.frames.toSorted((a, b) => a - b);
    reports.push({
      sample,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
      pathCount: result.pathCount,
      frameMedianMs: sorted[Math.floor(sorted.length / 2)],
      frameMaxMs: Math.max(...result.frames),
      longTasks: result.tasks,
      errors,
    });
    await page.close();
  }
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(reports, null, 2),
    );
  }
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
