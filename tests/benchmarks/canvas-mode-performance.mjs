import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

/* eslint-disable no-await-in-loop -- Each actual interaction must settle before the next measurement. */

// Serve the current production out/ and run alone (no builds/other timings).
// BASE_URL=http://127.0.0.1:3335/en bun tests/benchmarks/canvas-mode-performance.mjs --output /tmp/mode-before.json
const fixture = {
  version: 1,
  settings: {
    directed: false,
    weighted: false,
    indexBase: 0,
    allowSelfLoops: true,
    allowMultiEdges: true,
    autoEdgeRouting: false,
    snapToGrid: false,
    showNodeLabels: true,
    arrowScale: 1,
    weightKind: "number",
  },
  nodes: Array.from({ length: 1000 }, (_, i) => ({
    id: `n${i}`,
    order: i,
    label: String(i),
    x: (i % 32) * 90,
    y: Math.floor(i / 32) * 90,
  })),
  edges: Array.from({ length: 5000 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i % 1000}`,
    target: `n${(i + 1) % 1000}`,
  })),
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const reports = [];
const sampleCount = Number(process.env.SAMPLES ?? 5);
const settleMode = (page, mode) =>
  page.waitForFunction((desired) => {
    const selectedNodes = document.querySelectorAll(
      ".ge-select-node-hitbox",
    ).length;
    const selectedEdges = document.querySelectorAll(
      ".ge-select-edge-hitbox",
    ).length;
    const edgeNodes = document.querySelectorAll(
      '[data-edge-node-hitbox="true"]',
    ).length;
    const overlay = document.querySelector("[data-selection-hitboxes]");
    const selectionVisible = overlay
      ? getComputedStyle(overlay).display !== "none"
      : selectedNodes > 0;
    const label = desired === "select" ? "Select" : "Edge";
    const toolbar = document.querySelector('[role="toolbar"]');
    const pressed =
      toolbar
        ?.querySelector(`button[aria-label="${label}"]`)
        ?.getAttribute("aria-pressed") === "true";
    return (
      pressed &&
      (desired === "select"
        ? selectionVisible &&
          selectedNodes === 1000 &&
          selectedEdges === 5000 &&
          edgeNodes === 0
        : !selectionVisible && edgeNodes === 1000)
    );
  }, mode);
const frames = (page, count = 3) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++)
      await new Promise((resolve) => requestAnimationFrame(resolve));
  }, count);
async function measure(page, source, destination) {
  await page.evaluate(() => {
    const state = {
      frames: [],
      tasks: [],
      last: performance.now(),
      start: null,
      active: true,
      eventType: null,
    };
    const onEvent = (event) => {
      if (state.start !== null) return;
      if (
        event.type === "keydown" &&
        !["e", "v"].includes(event.key.toLowerCase())
      )
        return;
      if (
        event.type === "click" &&
        !event.target.closest(
          '[role="toolbar"] button[aria-label="Select"], [role="toolbar"] button[aria-label="Edge"]',
        )
      )
        return;
      state.start = performance.now();
      state.eventType = event.type;
    };
    window.addEventListener("keydown", onEvent, true);
    window.addEventListener("click", onEvent, true);
    const observer = new PerformanceObserver((list) => {
      state.tasks.push(
        ...list.getEntries().map((entry) => ({
          start: entry.startTime,
          duration: entry.duration,
        })),
      );
    });
    observer.observe({ type: "longtask", buffered: false });
    const frame = (time) => {
      if (!state.active) return;
      if (state.start !== null) state.frames.push(time - state.last);
      state.last = time;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.modePerformance = {
      state,
      stop() {
        state.active = false;
        observer.disconnect();
        window.removeEventListener("keydown", onEvent, true);
        window.removeEventListener("click", onEvent, true);
        return {
          frameGaps: state.frames,
          maxFrameGapMs: Math.max(...state.frames),
          eventType: state.eventType,
          elapsedMs: performance.now() - state.start,
          longTasks: state.tasks.filter((entry) => entry.start >= state.start),
        };
      },
    };
  });
  await frames(page, 2);
  if (source === "keyboard")
    await page.keyboard.press(destination === "edge" ? "e" : "v");
  else
    await page
      .getByRole("button", {
        name: destination === "edge" ? "Edge" : "Select",
        exact: true,
      })
      .click();
  await settleMode(page, destination);
  await frames(page, 3);
  const metrics = await page.evaluate(() => window.modePerformance.stop());
  assert.ok(
    metrics.frameGaps.length > 0 && metrics.eventType,
    "real event measured",
  );
  return { source, destination, ...metrics };
}
try {
  for (let run = 0; run < sampleCount; run++) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (raw) => localStorage.setItem("graph-editor-graph", raw),
      JSON.stringify(fixture),
    );
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3335/en");
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await settleMode(page, "select");
    await page.waitForTimeout(500);
    const initialCounts = await page.evaluate(() => ({
      nodeButtons: document.querySelectorAll(".ge-select-node-hitbox").length,
      edgeButtons: document.querySelectorAll(".ge-select-edge-hitbox").length,
      edgeModeButtons: document.querySelectorAll(
        '[data-edge-node-hitbox="true"]',
      ).length,
    }));
    assert.deepEqual(initialCounts, {
      nodeButtons: 1000,
      edgeButtons: 5000,
      edgeModeButtons: 0,
    });
    const metrics = [];
    // First keyboard edge mount and first select remount are the cold samples.
    for (const source of ["keyboard", "toolbar"]) {
      metrics.push(await measure(page, source, "edge"));
      metrics.push(await measure(page, source, "select"));
    }
    // Real keyboard events queued as fast as protocol permits. Final mode wins.
    for (const key of ["e", "v", "e", "v", "e", "v"])
      await page.keyboard.press(key);
    await settleMode(page, "select");
    await page.locator(".ge-select-node-hitbox").first().focus();
    await page.keyboard.press("Tab");
    const selectFocus = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute("aria-label"),
      connected: document.activeElement?.isConnected,
      ring: getComputedStyle(document.activeElement).boxShadow,
    }));
    assert.equal(selectFocus.label, "Select node 1");
    assert.ok(selectFocus.connected && selectFocus.ring.includes("3px"));
    await page.keyboard.press("e");
    await settleMode(page, "edge");
    await page.locator('[data-edge-node-hitbox="true"]').first().focus();
    await page.keyboard.press("Tab");
    const edgeFocus = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute("aria-label"),
      connected: document.activeElement?.isConnected,
      ring: getComputedStyle(document.activeElement).boxShadow,
    }));
    assert.ok(edgeFocus.connected && edgeFocus.ring.includes("3px"));
    await page.keyboard.press("v");
    await settleMode(page, "select");
    const finalCounts = await page.evaluate(() => {
      const firstEdgeButton = document.querySelector(".ge-select-edge-hitbox");
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      );
      return {
        // eslint-disable-next-line no-underscore-dangle
        nodes: container._cyreg.cy.nodes().length,
        // eslint-disable-next-line no-underscore-dangle
        edges: container._cyreg.cy.edges().length,
        nodeButtons: document.querySelectorAll(".ge-select-node-hitbox").length,
        edgeButtons: document.querySelectorAll(".ge-select-edge-hitbox").length,
        paths:
          firstEdgeButton.previousElementSibling.querySelectorAll("path")
            .length,
      };
    });
    assert.deepEqual(finalCounts, {
      nodes: 1000,
      edges: 5000,
      nodeButtons: 1000,
      edgeButtons: 5000,
      paths: 5000,
    });
    assert.deepEqual(errors, []);
    reports.push({
      run,
      metrics,
      initialCounts,
      finalCounts,
      selectFocus,
      edgeFocus,
      errors,
    });
    await page.close();
  }
  const summary = [
    "keyboard:edge",
    "keyboard:select",
    "toolbar:edge",
    "toolbar:select",
  ].map((name) => {
    const values = reports.map((report) =>
      report.metrics.find(
        (metric) => `${metric.source}:${metric.destination}` === name,
      ),
    );
    const maxGaps = values
      .map((value) => value.maxFrameGapMs)
      .sort((a, b) => a - b);
    return {
      name,
      medianMaxFrameGapMs: maxGaps[Math.floor(maxGaps.length / 2)],
      maxFrameGapMs: Math.max(...maxGaps),
      longTaskCount: values.reduce(
        (sum, value) => sum + value.longTasks.length,
        0,
      ),
    };
  });
  const result = {
    fixture: { nodes: 1000, edges: 5000, autoEdgeRouting: false },
    sampleCount,
    summary,
    reports,
  };
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0)
    writeFileSync(
      process.argv[outputIndex + 1],
      JSON.stringify(result, null, 2),
    );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
