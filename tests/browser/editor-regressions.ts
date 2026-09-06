import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

mkdirSync("/tmp/graph-editor-review", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.BASE_URL ?? "http://127.0.0.1:3100/en";
const fixture = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "0", order: 0, x: 0, y: 0 },
    { id: "b", label: "1", order: 1, x: 300, y: 0 },
    { id: "c", label: "2", order: 2, x: 100, y: 0 },
  ],
  edges: [{ id: "e", source: "a", target: "b" }],
};
await page.addInitScript((raw) => {
  localStorage.setItem("graph-editor-graph", raw);
  const appendChild = Element.prototype.appendChild;
  (window as unknown as { allowCanvas: boolean }).allowCanvas = false;
  Element.prototype.appendChild = function <T extends Node>(
    this: Element,
    child: T,
  ): T {
    if (
      child instanceof HTMLCanvasElement &&
      this.closest("[data-canvas-ready]") &&
      !(window as unknown as { allowCanvas: boolean }).allowCanvas
    )
      throw new Error("Injected canvas initialization failure");
    return Reflect.apply(appendChild, this, [child]);
  };
}, JSON.stringify(fixture));
const ready = () => page.locator('[data-canvas-ready="true"]').waitFor();
const button = (name: string) =>
  page.getByRole("button", { name, exact: true });
const saved = () =>
  page.evaluate(() => localStorage.getItem("graph-editor-graph"));
async function settle() {
  await page.waitForTimeout(450);
}
try {
  await page.goto(base);
  console.log("Loaded; testing recovery");
  const retry = page.getByRole("button", { name: /Retry/ });
  await retry.waitFor();
  // Retain the real retry handler to also exercise a remount after successful display.
  await retry.evaluate((element) => {
    const key = Object.keys(element).find((property) =>
      property.startsWith("__reactProps$"),
    )!;
    (window as unknown as { retryCanvas: () => void }).retryCanvas = (
      element as unknown as Record<string, { onClick: () => void }>
    )[key]!.onClick;
  });
  await retry.click();
  await retry.waitFor();
  await page.evaluate(() => {
    (window as unknown as { allowCanvas: boolean }).allowCanvas = true;
  });
  await retry.click();
  await ready();
  assert.equal(await button("Undo").isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: /^Select node / }).count(),
    3,
  );
  await button("Node").click();
  await page
    .locator('[data-canvas-ready="true"]')
    .click({ position: { x: 1000, y: 650 } });
  await button("Select").click();
  await settle();
  assert.equal(
    await page.getByRole("button", { name: /^Select node / }).count(),
    4,
    "retry must not duplicate placement listeners",
  );
  const beforeRetry = await saved();
  await page.evaluate(() =>
    (window as unknown as { retryCanvas: () => void }).retryCanvas(),
  );
  await ready();
  assert.equal(await saved(), beforeRetry, "display retry preserves graph");
  await button("Undo").click();
  await settle();
  assert.equal(
    await page.getByRole("button", { name: /^Select node / }).count(),
    3,
    "display retry preserves history",
  );

  console.log("Recovery and undo passed");
  // No-op imports still fit immediately and do not create undo entries.
  await button("Load a graph").click();
  await settle();
  await page.locator("select").selectOption("json");
  await page.locator("textarea").fill(JSON.stringify(fixture));
  await button("Apply to graph").click();
  await ready();
  await settle();
  assert.equal(
    await button("Undo").isDisabled(),
    true,
    "same JSON does not add history",
  );
  await button("Zoom out").click();
  const zoomedOut = await page
    .getByRole("button", { name: /^Reset zoom/ })
    .innerText();
  await button("Load a graph").click();
  await settle();
  await page.locator("select").selectOption("json");
  await page.locator("textarea").fill(JSON.stringify(fixture));
  await button("Apply to graph").click();
  await ready();
  await settle();
  assert.notEqual(
    await page.getByRole("button", { name: /^Reset zoom/ }).innerText(),
    zoomedOut,
    "no-op import consumes the fit request",
  );
  assert.equal(await button("Undo").isDisabled(), true);

  console.log("Noop import passed");
  await button("Layout").click();
  await page.getByRole("button", { name: /^Line:/ }).click();
  await settle();
  const line = await saved();
  await page.getByRole("button", { name: /^Line:/ }).click();
  await settle();
  assert.equal(
    await saved(),
    line,
    "same layout does not alter the stored graph",
  );
  await button("Layout").click();
  await button("Undo").click();
  await settle();
  assert.equal(
    await button("Undo").isDisabled(),
    true,
    "same layout adds no undo entry",
  );

  await button("Select node 0").click();
  const node = button("Select node 0");
  const bounds = (await node.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 65,
    bounds.y + bounds.height / 2 + 75,
    { steps: 8 },
  );
  await page.mouse.up();
  await settle();
  assert.notEqual(
    JSON.parse((await saved())!).nodes[0].x,
    0,
    "node dragging reconnects after retry",
  );
  await button("Undo").click();
  await settle();
  assert.equal(JSON.parse((await saved())!).nodes[0].x, 0);
  // Read the actual rendered control point, then exercise the user-facing menu.
  const displayed = await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as unknown as {
      _cyreg: {
        cy: {
          getElementById: (id: string) => { data: (key: string) => number[] };
        };
      };
    };
    // Cytoscape registers its renderer on the container; inspect it only in this test.
    // eslint-disable-next-line no-underscore-dangle
    const edge = container._cyreg.cy.getElementById("e");
    return {
      bowPx: edge.data("controlPointDistances")[0]!,
      bowT: edge.data("controlPointWeights")[0]!,
    };
  });
  assert.notEqual(displayed.bowPx, 0, "fixture has an automatic curve");
  await button("Edit edge label").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Bend right", exact: true }).click();
  await settle();
  const bent = JSON.parse((await saved())!).edges[0].routing;
  assert.equal(bent.bowPx, displayed.bowPx + 48);
  assert.equal(
    bent.bowT,
    displayed.bowT,
    "menu keeps the displayed bend position",
  );
  await button("Undo").click();
  await settle();
  assert.equal(
    JSON.parse((await saved())!).edges[0].routing,
    undefined,
    "one undo removes the manual override",
  );
  // Range selection and background deselection must also reconnect on remount.
  await page
    .locator('[data-canvas-ready="true"]')
    .click({ position: { x: 400, y: 250 } });
  await page.keyboard.down("Shift");
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(1250, 760, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await settle();
  const selected = await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as unknown as {
      _cyreg: { cy: { $: (query: string) => { length: number } } };
    };
    // eslint-disable-next-line no-underscore-dangle
    return container._cyreg.cy.$("node:selected").length;
  });
  assert.equal(selected, 3, "range selection reconnects after retry");
  await page.screenshot({ path: "/tmp/graph-editor-review/regressions.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Browser regressions passed: retry, placement, undo, same JSON fit, same layout, drag, automatic bend, range selection",
  );
} catch (error) {
  console.log(await page.locator("body").innerText());
  await page.screenshot({ path: "/tmp/graph-editor-review/failure.png" });
  throw error;
} finally {
  await browser.close();
}
