import assert from "node:assert/strict";
import type { Core } from "cytoscape";
import { chromium } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 300, y: 0 },
    ],
    edges: [{ id: "e", source: "a", target: "b" }],
  };
  await page.addInitScript((raw) => {
    localStorage.setItem("graph-editor-graph", raw);
  }, JSON.stringify(fixture));
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3123/en");
  await page.locator('[data-canvas-ready="true"]').waitFor();

  // Establish a zoom snapshot with the edge outside the hitbox SVG viewport.
  // A subsequent pan only translates the overlay layer, without rebuilding it.
  await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    cy.zoom(1);
    cy.pan({ x: -2000, y: 300 });
  });
  await page.waitForTimeout(250);
  const target = await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    cy.pan({ x: 400, y: 300 });
    const rect = container.getBoundingClientRect();
    return { x: rect.left + 475, y: rect.top + 300 };
  });
  assert.equal(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      target,
    ),
    "path",
    "an edge panned into view must retain its SVG stroke hitbox",
  );
  await page.mouse.click(target.x, target.y);
  await page
    .getByRole("button", { name: "Edit edge label", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Edit edge label", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "the panned edge uses the current selection callback",
  );

  await page.keyboard.down("Shift");
  await page.waitForTimeout(50);
  assert.notEqual(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      target,
    ),
    "path",
    "range-selection modifiers disable the memoized path hitboxes",
  );
  await page.keyboard.up("Shift");
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      target,
    ),
    "path",
    "edge interaction returns after range-selection modifiers are released",
  );

  // Hit areas keep their screen-space sizes as graph geometry zooms. Verify
  // both desktop and mobile, including the pill's wider area at maximum zoom.
  /* eslint-disable no-await-in-loop -- Viewport and zoom changes must settle in order. */
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(250);
    for (const zoom of [0.04, 0.35, 1.5]) {
      await page.evaluate((nextZoom) => {
        const container = [...document.querySelectorAll("div")].find(
          (element) => "_cyreg" in element,
        ) as HTMLDivElement & { _cyreg: { cy: Core } };
        // eslint-disable-next-line no-underscore-dangle
        container._cyreg.cy.zoom(nextZoom);
      }, zoom);
      await page.waitForTimeout(100);
      const geometry = await page.evaluate(() => {
        const container = [...document.querySelectorAll("div")].find(
          (element) => "_cyreg" in element,
        ) as HTMLDivElement & { _cyreg: { cy: Core } };
        // eslint-disable-next-line no-underscore-dangle
        const cy = container._cyreg.cy;
        const offset = container.getBoundingClientRect();
        const node = cy.getElementById("a");
        const position = node.renderedPosition();
        const button = document.querySelector<HTMLButtonElement>(
          'button[aria-label="Select node A"]',
        )!;
        const edge = button.parentElement!.querySelector("svg + button")!;
        const bounds = button.getBoundingClientRect();
        const edgeBounds = edge.getBoundingClientRect();
        const midpoint = cy.getElementById("e").renderedMidpoint();
        return {
          nodeDx: bounds.x + bounds.width / 2 - offset.x - position.x,
          nodeDy: bounds.y + bounds.height / 2 - offset.y - position.y,
          nodeWidth: bounds.width,
          expectedWidth: Math.max(72, node.renderedOuterWidth() + 24),
          nodeHeight: bounds.height,
          edgeDx: edgeBounds.x + edgeBounds.width / 2 - offset.x - midpoint.x,
          edgeDy: edgeBounds.y + edgeBounds.height / 2 - offset.y - midpoint.y,
          edgeWidth: edgeBounds.width,
          edgeHeight: edgeBounds.height,
          cursor: getComputedStyle(button).cursor,
          touchAction: getComputedStyle(button).touchAction,
        };
      });
      for (const offset of [
        geometry.nodeDx,
        geometry.nodeDy,
        geometry.edgeDx,
        geometry.edgeDy,
      ]) {
        assert.ok(Math.abs(offset) < 0.02, "zoomed hitbox stays centered");
      }
      assert.ok(Math.abs(geometry.nodeWidth - geometry.expectedWidth) < 0.02);
      assert.equal(geometry.nodeHeight, 72);
      assert.equal(geometry.edgeWidth, 44);
      assert.equal(geometry.edgeHeight, width === 390 ? 44 : 32);
      assert.equal(geometry.cursor, "grab");
      assert.equal(geometry.touchAction, "none");
    }
  }
  /* eslint-enable no-await-in-loop */
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    cy.zoom(1);
    cy.pan({ x: 400, y: 300 });
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("Tab");
  const focusRingWidth = await page.evaluate(() => {
    const node = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Select node A"]',
    )!;
    node.focus({ preventScroll: true });
    return getComputedStyle(node).boxShadow;
  });
  assert.ok(focusRingWidth.includes("3px"), "keyboard focus remains visible");

  // Opening a panel must switch its graph subscriptions back on. Settings,
  // history and exported text continue to reflect edits made with chrome idle.
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("radio", { name: "Weights: Weighted", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("radio", { name: "Weights: Weighted", exact: true })
      .getAttribute("aria-checked"),
    "true",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exported = page.locator("pre[aria-label]");
  assert.equal((await exported.innerText()).trim(), "2 1\n0 1");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("pre[aria-label]")?.textContent?.trim() ===
      "2 1\n0 1 1",
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    const png = cy.png.bind(cy);
    let count = 0;
    cy.png = ((options: Parameters<Core["png"]>[0]) => {
      count++;
      return png(options);
    }) as Core["png"];
    Object.assign(window, { readPngExportCount: () => count });
  });
  const pngExportCount = () =>
    page.evaluate(() =>
      (
        window as unknown as { readPngExportCount: () => number }
      ).readPngExportCount(),
    );
  await page.getByRole("button", { name: "PNG image", exact: true }).click();
  const preview = page.locator('img[src^="blob:"]').first();
  await preview.waitFor();
  await preview.evaluate((image) => (image as HTMLImageElement).decode());
  await page.waitForTimeout(500);
  const initialExports = await pngExportCount();
  const previousPreviewUrl = await preview.getAttribute("src");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "PNG image", exact: true }).click();
  await preview.waitFor();
  await page.waitForTimeout(500);
  assert.equal(
    await pngExportCount(),
    initialExports,
    "reopening PNG without edits reuses its preview without redundant exports",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page
    .getByRole("button", { name: "Select node A", exact: true })
    .dblclick();
  const labelInput = page.getByRole("textbox", {
    name: "Edit node label",
    exact: true,
  });
  await labelInput.fill("Changed A");
  await labelInput.press("Enter");
  await page
    .getByRole("button", { name: "Select node Changed A", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "PNG image", exact: true }).click();
  await page.waitForFunction((previous: string | null) => {
    const image = document.querySelector(
      'img[src^="blob:"]',
    ) as HTMLImageElement | null;
    return (
      image !== null &&
      image.src !== previous &&
      image.complete &&
      image.naturalWidth > 0
    );
  }, previousPreviewUrl);
  await page.waitForTimeout(500);
  assert.equal(initialExports, 1, "opening PNG creates one settled preview");
  assert.equal(
    await pngExportCount(),
    initialExports + 1,
    "reopening PNG after an edit creates one fresh preview",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Canvas pan, selection, modifiers, and live panel regressions passed",
  );

  const rangePage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const rangeErrors: string[] = [];
  rangePage.on("pageerror", (error) => rangeErrors.push(error.message));
  const rangeGraph = {
    ...createEmptyGraphModel({ allowSelfLoops: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 180, y: 0 },
      { id: "c", label: "C", order: 2, x: 90, y: 160 },
      { id: "d", label: "D", order: 3, x: 700, y: 500 },
    ],
    edges: [
      { id: "straight", source: "a", target: "b" },
      {
        id: "curve",
        source: "a",
        target: "c",
        routing: { bowPx: 180, bowT: 0.5 },
      },
      { id: "loop", source: "b", target: "b" },
      { id: "remote", source: "c", target: "d" },
    ],
  };
  await rangePage.addInitScript((raw) => {
    localStorage.setItem("graph-editor-graph", raw);
  }, serializeGraphModel(rangeGraph));
  await rangePage.goto(process.env.BASE_URL ?? "http://127.0.0.1:3123/en");
  await rangePage.locator('[data-canvas-ready="true"]').waitFor();
  const rangeRect = await rangePage.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    if (cy.nodes().length !== 4 || cy.edges().length !== 4)
      throw new Error(
        "Range selection fixture must load all four nodes and edges",
      );
    cy.zoom(1);
    cy.pan({ x: 400, y: 350 });
    const rect = container.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  });
  await rangePage.waitForTimeout(250);
  async function verifyRangePreview(
    filter: "all" | "nodes" | "edges",
    keys: readonly [string, string?],
  ) {
    await rangePage.keyboard.down(keys[0]);
    if (keys[1]) await rangePage.keyboard.down(keys[1]);
    await rangePage.mouse.move(rangeRect.x + 330, rangeRect.y + 200);
    await rangePage.mouse.down();
    await rangePage.mouse.move(rangeRect.x + 800, rangeRect.y + 650, {
      steps: 6,
    });
    await rangePage.waitForTimeout(100);
    const rangePreview = await rangePage.evaluate((activeFilter) => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      ) as HTMLDivElement & { _cyreg: { cy: Core } };
      // eslint-disable-next-line no-underscore-dangle
      const cy = container._cyreg.cy;
      const box = { x1: 330, y1: 200, x2: 800, y2: 650 };
      const inside = (point: { x: number; y: number }) =>
        point.x >= box.x1 &&
        point.x <= box.x2 &&
        point.y >= box.y1 &&
        point.y <= box.y2;
      const expectedNodes =
        activeFilter === "edges"
          ? []
          : cy
              .nodes()
              .filter((node) => {
                const bounds = node.renderedBoundingBox({
                  includeNodes: true,
                  includeEdges: false,
                  includeLabels: false,
                  includeOverlays: false,
                  includeUnderlays: false,
                });
                return (
                  bounds.x1 >= box.x1 &&
                  bounds.y1 >= box.y1 &&
                  bounds.x2 <= box.x2 &&
                  bounds.y2 <= box.y2
                );
              })
              .map((node) => node.id());
      const expectedEdges =
        activeFilter === "nodes"
          ? []
          : cy
              .edges()
              .filter((edge) => {
                const read = (
                  method: "renderedControlPoints" | "renderedSegmentPoints",
                ) => {
                  try {
                    return edge[method]() ?? [];
                  } catch {
                    return [];
                  }
                };
                return [
                  edge.renderedSourceEndpoint(),
                  edge.renderedTargetEndpoint(),
                  ...read("renderedControlPoints"),
                  ...read("renderedSegmentPoints"),
                ]
                  .filter(
                    (point) =>
                      point &&
                      Number.isFinite(point.x) &&
                      Number.isFinite(point.y),
                  )
                  .every(inside);
              })
              .map((edge) => edge.id());
      return {
        expectedNodes: expectedNodes.toSorted(),
        expectedEdges: expectedEdges.toSorted(),
        actualNodes: cy
          .nodes(".range-preview")
          .map((node) => node.id())
          .toSorted(),
        actualEdges: cy
          .edges(".range-preview")
          .map((edge) => edge.id())
          .toSorted(),
      };
    }, filter);
    assert.deepEqual(
      rangePreview.actualNodes,
      rangePreview.expectedNodes,
      `${filter} node preview`,
    );
    assert.deepEqual(
      rangePreview.actualEdges,
      rangePreview.expectedEdges,
      `${filter} edge preview`,
    );
    if (filter !== "nodes") {
      assert.ok(rangePreview.actualEdges.includes("straight"));
      assert.ok(rangePreview.actualEdges.includes("loop"));
      assert.ok(!rangePreview.actualEdges.includes("curve"));
      assert.ok(!rangePreview.actualEdges.includes("remote"));
    }
    await rangePage.mouse.up();
    if (keys[1]) await rangePage.keyboard.up(keys[1]);
    await rangePage.keyboard.up(keys[0]);
    await rangePage.waitForTimeout(50);
    assert.equal(
      await rangePage.evaluate(() => {
        const container = [...document.querySelectorAll("div")].find(
          (element) => "_cyreg" in element,
        ) as HTMLDivElement & { _cyreg: { cy: Core } };
        // eslint-disable-next-line no-underscore-dangle
        return container._cyreg.cy.elements(".range-preview").length;
      }),
      0,
      "range preview clears on pointer release",
    );
  }
  await verifyRangePreview("all", ["Shift"]);
  await verifyRangePreview("nodes", ["Control", "Shift"]);
  await verifyRangePreview("edges", ["Control", "Alt"]);
  assert.deepEqual(rangeErrors, []);
  await rangePage.close();
  console.log(
    "Range preview all/nodes/edges, curves, loops and cleanup passed",
  );

  const largePage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const largeErrors: string[] = [];
  largePage.on("pageerror", (error) => largeErrors.push(error.message));
  const largeGraph = {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: 1000 }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: `${index}`,
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 1000}`,
      target: `n${(index + 1) % 1000}`,
    })),
  };
  await largePage.addInitScript((raw) => {
    if (localStorage.getItem("graph-editor-graph") === null) {
      localStorage.setItem("graph-editor-graph", raw);
    }
  }, JSON.stringify(largeGraph));
  await largePage.goto(process.env.BASE_URL ?? "http://127.0.0.1:3123/en");
  await largePage.locator('[data-canvas-ready="true"]').waitFor();
  assert.equal(
    await largePage.locator('button[aria-label^="Select node "]').count(),
    1000,
  );
  await largePage.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    cy.zoom(1);
    cy.pan({ x: 200, y: 250 });
  });
  await largePage.waitForTimeout(250);
  const node = largePage.getByRole("button", {
    name: "Select node 0",
    exact: true,
  });
  const bounds = (await node.boundingBox())!;
  await largePage.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await largePage.mouse.down();
  await largePage.mouse.move(
    bounds.x + bounds.width / 2 + 65,
    bounds.y + bounds.height / 2 + 75,
    { steps: 8 },
  );
  await largePage.mouse.up();
  await largePage.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph")!).nodes[0].x !== 0,
  );
  const movedX: number = await largePage.evaluate(
    () => JSON.parse(localStorage.getItem("graph-editor-graph")!).nodes[0].x,
  );
  await largePage.getByRole("button", { name: "Undo", exact: true }).click();
  await largePage.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph")!).nodes[0].x === 0,
  );
  await largePage.getByRole("button", { name: "Redo", exact: true }).click();
  await largePage.waitForFunction(
    (x) =>
      JSON.parse(localStorage.getItem("graph-editor-graph")!).nodes[0].x === x,
    movedX,
  );
  await largePage.reload();
  await largePage.locator('[data-canvas-ready="true"]').waitFor();
  assert.equal(
    await largePage.evaluate(() => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      ) as HTMLDivElement & { _cyreg: { cy: Core } };
      // eslint-disable-next-line no-underscore-dangle
      return container._cyreg.cy.getElementById("n0").position().x;
    }),
    movedX,
    "the saved move is rendered after reopening",
  );
  assert.deepEqual(largeErrors, []);
  console.log(
    "1,000-node / 5,000-edge drag, Undo, Redo, and persistence regressions passed",
  );
} finally {
  await browser.close();
}
