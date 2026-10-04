import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import type { Core } from "cytoscape";
import { chromium } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

/* eslint-disable no-await-in-loop -- Each viewport update must settle before measuring the next one. */

// Build and serve out/ first. Run separately from builds and other timings.
// BASE_URL=http://127.0.0.1:3123/en bun tests/benchmarks/canvas-viewport-performance.ts
// --output /tmp/canvas-viewport.json records frame gaps and browser long tasks.
const browser = await chromium.launch();
const reports: unknown[] = [];
try {
  for (const [nodeCount, edgeCount] of [
    [100, 400],
    [1000, 5000],
  ]) {
    const graph = {
      ...createEmptyGraphModel({ allowMultiEdges: true }),
      nodes: Array.from({ length: nodeCount }, (_, index) => ({
        id: `n${index}`,
        order: index,
        label: String(index),
        x: (index % 32) * 90,
        y: Math.floor(index / 32) * 90,
      })),
      edges: Array.from({ length: edgeCount }, (_, index) => ({
        id: `e${index}`,
        source: `n${index % nodeCount}`,
        target: `n${(index + 1) % nodeCount}`,
      })),
    };
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((raw) => {
      localStorage.setItem("graph-editor-graph", raw);
    }, JSON.stringify(graph));
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3123/en");
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(async () => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      ) as HTMLDivElement & { _cyreg: { cy: Core } };
      // eslint-disable-next-line no-underscore-dangle
      const cy = container._cyreg.cy;
      const frames: number[] = [];
      const tasks: number[] = [];
      let active = true;
      let last = performance.now();
      function frame(time: number) {
        if (!active) return;
        frames.push(time - last);
        last = time;
        requestAnimationFrame(frame);
      }
      const observer = new PerformanceObserver((list) => {
        tasks.push(...list.getEntries().map((entry) => entry.duration));
      });
      observer.observe({ type: "longtask", buffered: false });
      requestAnimationFrame(frame);
      const nextFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const panHandlers: number[] = [];
      for (let index = 0; index < 45; index++) {
        await nextFrame();
        const start = performance.now();
        cy.pan({ x: 300 + index * 3, y: 250 + index * 2 });
        panHandlers.push(performance.now() - start);
      }
      const panFrames = frames.splice(0);
      const panTasks = tasks.splice(0);
      const zoomHandlers: number[] = [];
      for (let index = 0; index < 15; index++) {
        await nextFrame();
        const start = performance.now();
        cy.zoom(0.3 + index * 0.01);
        zoomHandlers.push(performance.now() - start);
        await nextFrame();
        await nextFrame();
      }
      await nextFrame();
      await nextFrame();
      active = false;
      observer.disconnect();
      const statistics = (values: number[]) => ({
        medianMs: values.toSorted((a, b) => a - b)[
          Math.floor(values.length / 2)
        ],
        maxMs: Math.max(...values),
      });
      return {
        nodeCount: cy.nodes().length,
        edgeCount: cy.edges().length,
        panHandler: statistics(panHandlers),
        panFrames: statistics(panFrames),
        panTasks,
        zoomHandler: statistics(zoomHandlers),
        zoomFrames: statistics(frames),
        zoomTasks: tasks,
      };
    });
    assert.equal(
      metrics.nodeCount,
      nodeCount,
      "all benchmark nodes are loaded",
    );
    assert.equal(
      metrics.edgeCount,
      edgeCount,
      "all benchmark edges are loaded",
    );
    assert.deepEqual(errors, [], "benchmark page has no runtime errors");
    reports.push({ ...metrics, errors });
    await page.close();
  }
  console.log(JSON.stringify(reports, null, 2));
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(reports, null, 2),
    );
  }
} finally {
  await browser.close();
}
