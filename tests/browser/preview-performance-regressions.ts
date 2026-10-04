import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium, type ViewportSize } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

// Run against the current static build. Timing is reported, not asserted, so
// machine load cannot turn the behavioral regression checks into flaky tests.
const base = process.env.BASE_URL ?? "http://127.0.0.1:3335/en";
const large: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    indexBase: 1,
    allowMultiEdges: true,
    allowSelfLoops: true,
    autoEdgeRouting: true,
  }),
  nodes: Array.from({ length: 1_000 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: String(index + 1),
    x: Math.cos(index) * index,
    y: Math.sin(index) * index,
  })),
  edges: Array.from({ length: 5_000 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % 1_000}`,
    target: `n${(index + Math.floor(index / 1_000) + 1) % 1_000}`,
  })),
};
const small: GraphModel = {
  ...createEmptyGraphModel({ directed: true, allowSelfLoops: true }),
  nodes: [
    { id: "latest-a", order: 0, label: "最新 A", x: 0, y: 0 },
    { id: "latest-b", order: 1, label: "B", x: 80, y: 0 },
    { id: "latest-c", order: 2, label: "C", x: 40, y: 80 },
  ],
  edges: [
    { id: "latest-ab", source: "latest-a", target: "latest-b" },
    { id: "latest-loop", source: "latest-c", target: "latest-c" },
  ],
};
const largeText = JSON.stringify(large);
// Captured from the original production preview. This covers every path,
// circle, arrow, style and order; only React's generated marker ID is normalized.
const largeSvgHash =
  "dc08fec1c79f0a0354de49ae2e612bf5f40d89779f9dbc2099504d619a9fd6d9";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

async function verifyPreview(viewport: ViewportSize, lifecycle: boolean) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const panel = page.locator('[data-editor-panel="starter"]');
  const input = panel.locator('textarea[name="graph-input"]');
  const format = panel.getByRole("combobox", { name: "Format", exact: true });
  const preview = panel.locator('[aria-label="Preview"]');
  const waitNodes = (count: number) =>
    page.waitForFunction(
      (expected) =>
        document.querySelectorAll(
          '[data-editor-panel="starter"] [aria-label="Preview"] circle',
        ).length === expected,
      count,
    );
  try {
    await page.goto(base);
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await button("Load a graph").click();
    await input.waitFor();
    await format.selectOption("json");
    await page.evaluate(() => {
      const gaps: number[] = [];
      let previous = performance.now();
      let active = true;
      const frame = () => {
        const next = performance.now();
        gaps.push(next - previous);
        previous = next;
        if (active) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      Object.assign(globalThis, {
        takePreviewFrameGaps: () => {
          active = false;
          return gaps;
        },
      });
    });
    await input.fill(largeText);
    await waitNodes(1_000);
    await page.waitForTimeout(60);
    const gaps = await page.evaluate(() =>
      (
        globalThis as typeof globalThis & {
          takePreviewFrameGaps: () => number[];
        }
      ).takePreviewFrameGaps(),
    );
    const svg = await preview
      .locator("svg")
      .evaluate((element) =>
        element.outerHTML.replace(/sample-arrow-[\w-]+/g, "sample-arrow-ID"),
      );
    assert.equal(createHash("sha256").update(svg).digest("hex"), largeSvgHash);
    assert.equal(await button("Apply to graph").isEnabled(), true);
    assert.equal(await preview.locator("svg > path").count(), 5_000);
    assert.equal(await preview.locator("marker").count(), 1);
    if (lifecycle) {
      // Replace pending work and its format, then verify the current input wins.
      await input.fill(`${largeText}\n`);
      await page.waitForTimeout(155);
      await format.selectOption("contest-edge-list");
      await input.fill(JSON.stringify(small));
      await format.selectOption("json");
      await waitNodes(3);
      assert.equal(
        await preview.locator("text").first().textContent(),
        "最新 A",
      );
      assert.equal(await preview.locator("svg > path").count(), 2);
      assert.equal(await button("Apply to graph").isEnabled(), true);

      await input.fill(largeText);
      await page.waitForTimeout(155);
      await panel.getByRole("button", { name: "Close", exact: true }).click();
      await panel.waitFor({ state: "detached" });
      await button("Load a graph").click();
      await input.waitFor();
      assert.equal(await input.inputValue(), "");
      assert.equal(await preview.locator("svg").count(), 0);
      assert.equal(await button("Apply to graph").isEnabled(), false);

      await format.selectOption("json");
      await input.fill(JSON.stringify(small));
      await waitNodes(3);
      await button("Apply to graph").click();
      await panel.waitFor({ state: "detached" });
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")
            ?.nodes?.[0]?.label === "最新 A",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null"),
      );
      assert.deepEqual(saved, small);
    }
    assert.deepEqual(errors, []);
    return Math.max(...gaps);
  } finally {
    await context.close();
  }
}

try {
  const desktopGaps = [];
  for (let index = 0; index < 5; index++) {
    desktopGaps.push(
      // eslint-disable-next-line no-await-in-loop -- Timing samples must run without competing browser work.
      await verifyPreview({ width: 1440, height: 1000 }, index === 0),
    );
  }
  const mobileGap = await verifyPreview({ width: 390, height: 844 }, true);
  console.log(JSON.stringify({ desktopGaps, mobileGap }));
} finally {
  await browser.close();
}
