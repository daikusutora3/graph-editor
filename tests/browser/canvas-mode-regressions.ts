import assert from "node:assert/strict";
import type { Core } from "cytoscape";
import { chromium } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

/* eslint-disable no-await-in-loop -- Mode changes and pointer gestures must settle in order. */

declare global {
  interface Window {
    modeTestCy: Core;
    modeTestNode: HTMLButtonElement;
    modeTestEdge: HTMLButtonElement;
    modeTestEdgeReads: number;
    modeTestNodeClassChanges: number;
    modeTestOriginalMidpoint: () => { x: number; y: number };
  }
}

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const graph = {
      ...createEmptyGraphModel({ autoEdgeRouting: false }),
      nodes: [
        { id: "a", label: "A", order: 0, x: 0, y: 0 },
        { id: "b", label: "B", order: 1, x: 300, y: 0 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    await page.addInitScript((raw) => {
      localStorage.setItem("graph-editor-graph", raw);
    }, JSON.stringify(graph));
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3335/en");
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.evaluate(() => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      ) as HTMLDivElement & { _cyreg: { cy: Core } };
      // eslint-disable-next-line no-underscore-dangle
      window.modeTestCy = container._cyreg.cy;
      window.modeTestNode = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Select node A"]',
      )!;
      window.modeTestEdge = document.querySelector<HTMLButtonElement>(
        ".ge-select-edge-hitbox",
      )!;
      const edge = window.modeTestCy.getElementById("e");
      window.modeTestOriginalMidpoint = edge.renderedMidpoint;
      window.modeTestEdgeReads = 0;
      window.modeTestNodeClassChanges = 0;
      window.modeTestCy.on("class", "node", () => {
        window.modeTestNodeClassChanges++;
      });
      edge.renderedMidpoint = function () {
        window.modeTestEdgeReads++;
        return window.modeTestOriginalMidpoint.call(edge);
      };
    });
    await page.keyboard.press("e");
    await page.getByRole("button", { name: "Edge", exact: true }).waitFor();
    await page.waitForFunction(() => {
      const overlay = document.querySelector<HTMLElement>(
        "[data-selection-hitboxes]",
      );
      return overlay?.inert && getComputedStyle(overlay).display === "none";
    });
    assert.equal(
      await page
        .getByRole("button", { name: "Select node A", exact: true })
        .count(),
      0,
      "hidden selection buttons are absent from the accessible button surface",
    );
    assert.equal(await page.locator(".ge-select-node-hitbox").count(), 2);
    assert.equal(await page.locator(".ge-select-edge-hitbox").count(), 1);
    const hiddenFocus = await page.evaluate(() => {
      window.modeTestNode.focus();
      return document.activeElement === window.modeTestNode;
    });
    assert.equal(
      hiddenFocus,
      false,
      "a retained hidden node cannot receive focus",
    );
    await page.getByRole("button", { name: "Edge", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("[data-selection-hitboxes]")),
      ),
      false,
      "Tab skips the dormant selection overlay",
    );

    // Zoom and pan still update the active edge targets, but dormant edge
    // label geometry must not be read or exposed until select mode returns.
    await page.evaluate(() => {
      window.modeTestEdgeReads = 0;
      window.modeTestCy.zoom(0.7);
      window.modeTestCy.pan({ x: 100, y: 300 });
    });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.modeTestEdgeReads), 0);
    const activePoint = await page.evaluate(() => {
      const cy = window.modeTestCy;
      const rect = cy.container()!.getBoundingClientRect();
      const position = cy.getElementById("a").renderedPosition();
      const x = rect.left + position.x;
      const y = rect.top + position.y;
      return {
        x,
        y,
        edgeModeTarget: document
          .elementFromPoint(x, y)
          ?.getAttribute("data-edge-node-hitbox"),
      };
    });
    assert.equal(activePoint.edgeModeTarget, "true");

    await page.keyboard.press("n");
    const blank = await page.evaluate(() => {
      const rect = window.modeTestCy.container()!.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.8,
        y: rect.top + rect.height * 0.7,
      };
    });
    await page.mouse.click(blank.x, blank.y);
    await page.waitForFunction(() => window.modeTestCy.nodes().length === 3);
    assert.equal(await page.evaluate(() => window.modeTestEdgeReads), 0);
    await page.keyboard.press("v");
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".ge-select-node-hitbox").length === 3 &&
        getComputedStyle(document.querySelector("[data-selection-hitboxes]")!)
          .display !== "none",
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.modeTestNode ===
          document.querySelector('button[aria-label="Select node A"]'),
      ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.modeTestEdge ===
          document.querySelector(".ge-select-edge-hitbox"),
      ),
      true,
    );
    const alignment = await page.evaluate(() => {
      const cy = window.modeTestCy;
      const rect = cy.container()!.getBoundingClientRect();
      const node = cy.getElementById("a").renderedPosition();
      const bounds = window.modeTestNode.getBoundingClientRect();
      return {
        x: bounds.x + bounds.width / 2 - rect.x - node.x,
        y: bounds.y + bounds.height / 2 - rect.y - node.y,
        liveEdgeReads: window.modeTestEdgeReads,
      };
    });
    assert.ok(Math.abs(alignment.x) < 0.02 && Math.abs(alignment.y) < 0.02);
    assert.ok(alignment.liveEdgeReads > 0);
    assert.equal(
      await page.evaluate(() => window.modeTestNodeClassChanges),
      0,
      "mode changes with no edge draft never dirty unrelated node classes",
    );

    await page.keyboard.press("e");
    await page
      .getByRole("button", { name: "Connect edge to node A", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => window.modeTestCy.nodes(".edge-source").length),
      1,
    );
    await page.keyboard.press("v");
    await page.waitForFunction(
      () => window.modeTestCy.nodes(".edge-source").length === 0,
    );
    assert.equal(
      await page.evaluate(() => window.modeTestNodeClassChanges),
      2,
      "setting and clearing a draft only changes the actual source node",
    );

    // Switching modes during a real pointer drag cancels the transient move.
    const beforeMove = await page.evaluate(() => ({
      ...window.modeTestCy.getElementById("a").position(),
    }));
    const nodeBounds = await page
      .getByRole("button", { name: "Select node A", exact: true })
      .boundingBox();
    assert.ok(nodeBounds);
    const nodePoint = {
      x: nodeBounds.x + nodeBounds.width / 2,
      y: nodeBounds.y + nodeBounds.height / 2,
    };
    await page.mouse.move(nodePoint.x, nodePoint.y);
    await page.mouse.down();
    await page.mouse.move(nodePoint.x + 40, nodePoint.y + 40, { steps: 4 });
    assert.notDeepEqual(
      await page.evaluate(() => ({
        ...window.modeTestCy.getElementById("a").position(),
      })),
      beforeMove,
    );
    await page.keyboard.press("e");
    await page.waitForFunction((position) => {
      const current = window.modeTestCy.getElementById("a").position();
      return current.x === position.x && current.y === position.y;
    }, beforeMove);
    await page.mouse.up();
    await page.keyboard.press("v");
    await page
      .getByRole("button", { name: "Select node A", exact: true })
      .waitFor();
    assert.deepEqual(
      await page.evaluate(() => ({
        ...window.modeTestCy.getElementById("a").position(),
      })),
      beforeMove,
    );

    // Activity's cleanup restores a bend and drops the previous pointer
    // session, so releasing the pointer later cannot commit the cancelled bend.
    const edgeBounds = await page
      .locator(".ge-select-edge-hitbox")
      .boundingBox();
    assert.ok(edgeBounds);
    const edgePoint = {
      x: edgeBounds.x + edgeBounds.width / 2,
      y: edgeBounds.y + edgeBounds.height / 2,
    };
    const originalBow = await page.evaluate(() =>
      window.modeTestCy.getElementById("e").data("bow"),
    );
    await page.mouse.move(edgePoint.x, edgePoint.y);
    await page.mouse.down();
    await page.mouse.move(edgePoint.x + 10, edgePoint.y + 70, { steps: 4 });
    assert.notEqual(
      await page.evaluate(() =>
        window.modeTestCy.getElementById("e").data("bow"),
      ),
      originalBow,
    );
    await page.keyboard.press("e");
    await page.waitForFunction(
      (bow) => window.modeTestCy.getElementById("e").data("bow") === bow,
      originalBow,
    );
    await page.mouse.up();
    await page.keyboard.press("v");
    await page.locator(".ge-select-edge-hitbox").click();
    assert.equal(
      await page.locator(".ge-select-edge-hitbox").getAttribute("aria-pressed"),
      "true",
    );
    await page.waitForTimeout(150);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("graph-editor-graph")!),
    );
    assert.deepEqual(
      {
        x: saved.nodes.find((node: { id: string }) => node.id === "a").x,
        y: saved.nodes.find((node: { id: string }) => node.id === "a").y,
      },
      beforeMove,
    );
    assert.equal(
      saved.edges.find((edge: { id: string }) => edge.id === "e").routing,
      undefined,
    );
    for (const key of ["e", "v", "e", "v"]) await page.keyboard.press(key);
    await page
      .getByRole("button", { name: "Select node A", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Select node A", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Select node B",
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Canvas mode regressions passed: desktop/mobile, dormant overlays, live geometry, pointer cancellation and focus.",
  );
} finally {
  await browser.close();
}
