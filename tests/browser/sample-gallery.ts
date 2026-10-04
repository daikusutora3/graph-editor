import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const artifacts = "/tmp/graph-editor-sample-review";
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch();
const errors: string[] = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.setDefaultTimeout(10_000);
page.on("pageerror", (error) => errors.push(error.message));
const card = (kind: string) => page.locator(`[data-sample-kind="${kind}"]`);
const search = page.getByRole("searchbox");
const stats = (kind: string) => card(kind).locator("[data-sample-stats]");
const saved = async (): Promise<GraphModel> =>
  JSON.parse(
    (await page.evaluate(() => localStorage.getItem("graph-editor-graph"))) ??
      "null",
  );
async function waitStats(kind: string, text: string) {
  await page.waitForFunction(
    ({ kind: sampleKind, text: expectedText }) =>
      document
        .querySelector(`[data-sample-kind="${sampleKind}"] [data-sample-stats]`)
        ?.textContent?.includes(expectedText),
    { kind, text },
  );
}
async function clipboard() {
  return page.evaluate(() => navigator.clipboard.readText());
}
async function openGallery() {
  await page.getByRole("button", { name: "Load a graph", exact: true }).click();
  await page.getByRole("button", { name: "Use a sample", exact: true }).click();
  await card("path").waitFor();
}
async function screenshot(name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${artifacts}/${name}.png` });
}
try {
  await page.goto(`${base}/en`);
  await page.getByRole("button", { name: /Choose a sample/ }).click();
  await card("path").waitFor();
  assert.equal(await page.locator("[data-sample-kind]").count(), 79);
  await screenshot("desktop-light");

  await search.fill("cycle");
  const cycleInput = card("cycle").getByRole("textbox", {
    name: "Nodes",
    exact: true,
  });
  const beforeParameterEdit = await saved();
  await cycleInput.click();
  await cycleInput.press("ControlOrMeta+A");
  await cycleInput.press("Backspace");
  assert.equal(await cycleInput.inputValue(), "");
  await cycleInput.pressSequentially("12", { delay: 40 });
  await waitStats("cycle", "12 nodes / 12 edges");
  await cycleInput.fill("");
  await page.keyboard.insertText("１２");
  assert.equal(await cycleInput.inputValue(), "１２");
  await waitStats("cycle", "12 nodes / 12 edges");

  const ime = await context.newCDPSession(page);
  await cycleInput.fill("");
  await ime.send("Input.imeSetComposition", {
    text: "じゅうご",
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(
    await cycleInput.inputValue(),
    "じゅうご",
    "unconverted IME text stays editable",
  );
  await ime.send("Input.imeSetComposition", {
    text: "１５",
    selectionStart: 2,
    selectionEnd: 2,
  });
  const compositionEnterPrevented = await cycleInput.evaluate((element) => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert(
    compositionEnterPrevented,
    "IME confirmation Enter cannot submit a sample",
  );
  assert.deepEqual(await saved(), beforeParameterEdit);
  await ime.send("Input.insertText", { text: "１５" });
  assert.equal(await cycleInput.inputValue(), "１５");
  await waitStats("cycle", "15 nodes / 15 edges");
  await ime.detach();
  const legacyImeEnterPrevented = await cycleInput.evaluate((element) => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      keyCode: 229,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert(
    legacyImeEnterPrevented,
    "IME keyCode 229 also blocks sample submission",
  );
  assert.equal(
    await card("cycle").locator("[data-sample-adjustments]").count(),
    0,
  );
  await card("cycle")
    .getByRole("button", { name: /Copy edge list/ })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-sample-kind="cycle"] [role="status"]')
        ?.textContent === "Copied",
  );
  assert.equal((await clipboard()).split("\n")[0], "15 15");

  await cycleInput.fill("invalid");
  assert.equal(await cycleInput.inputValue(), "invalid");
  assert.equal(await cycleInput.getAttribute("aria-invalid"), "true");
  assert.equal(
    await card("cycle")
      .getByRole("button", { name: /Copy edge list/ })
      .isDisabled(),
    true,
  );
  assert.equal(
    await card("cycle")
      .getByRole("button", { name: /Create/ })
      .isDisabled(),
    true,
  );
  await cycleInput.press("Enter");
  assert.deepEqual(
    await saved(),
    beforeParameterEdit,
    "invalid input cannot create a graph",
  );
  await cycleInput.press("ControlOrMeta+A");
  await cycleInput.pressSequentially("24", { delay: 40 });
  await waitStats("cycle", "24 nodes / 24 edges");
  assert.equal(await cycleInput.getAttribute("aria-invalid"), "false");
  await card("cycle")
    .getByRole("button", { name: /Reset parameters/ })
    .click();
  await waitStats("cycle", "6 nodes / 6 edges");
  console.log(
    "Cycle keyboard replacement, fullwidth digits and IME editing passed",
  );

  await search.fill("最短路");
  assert.equal(
    await card("zeroOne").count(),
    1,
    "Japanese algorithm aliases work in English",
  );
  await search.fill("augmenting bipartite");
  assert.equal(
    await page.locator("[data-sample-kind]").count(),
    1,
    "query words match in any order",
  );
  assert.equal(await card("bipartiteMatching").count(), 1);
  await search.fill("path");
  await card("path")
    .getByRole("textbox", { name: "Nodes", exact: true })
    .fill("12");
  await waitStats("path", "12 nodes / 11 edges");
  assert.equal(
    await card("path").locator("svg circle").count(),
    12,
    "preview shows current size",
  );
  await search.fill("0−1 BFS");
  assert.equal(
    await card("zeroOne").count(),
    1,
    "Unicode dash aliases normalize",
  );
  await search.fill("path");
  assert.equal(
    await card("path").getByRole("textbox").inputValue(),
    "12",
    "search retains parameters",
  );
  await card("path").getByRole("textbox").press("Enter");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")?.nodes
        .length === 12,
  );
  assert.equal((await saved()).edges.length, 11);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")?.nodes
        .length === 0,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")?.nodes
        .length === 12,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Load a graph", exact: true })
    .waitFor();
  assert.equal(
    (await saved()).nodes.length,
    12,
    "created sample persists after reload",
  );
  await openGallery();

  await search.fill("grid");
  await card("grid")
    .getByRole("textbox", { name: "Rows", exact: true })
    .fill("5");
  await card("grid")
    .getByRole("textbox", { name: "Columns", exact: true })
    .fill("6");
  await waitStats("grid", "30 nodes / 49 edges");
  assert.equal(await card("grid").locator("svg circle").count(), 30);
  await page.getByText("Generation settings ▾", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Index", exact: true })
    .selectOption("1");
  await card("grid")
    .getByRole("button", { name: /Copy edge list/ })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-sample-kind="grid"] [role="status"]')
        ?.textContent === "Copied",
  );
  const gridInput = await clipboard();
  assert.equal(gridInput.split("\n")[0], "30 49");
  assert.equal(gridInput.split("\n")[1], "1 2");
  assert.equal(gridInput.split("\n").length, 50);
  assert.equal(
    (await saved()).nodes.length,
    12,
    "copy does not replace the current graph",
  );
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("algorithmic");
  assert.equal(await card("grid").count(), 0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  assert.equal(
    await card("grid")
      .getByRole("textbox", { name: "Rows", exact: true })
      .inputValue(),
    "5",
    "category changes retain parameters",
  );

  await search.fill("cycle");
  await card("cycle").getByRole("textbox").fill("2");
  await waitStats("cycle", "3 nodes / 3 edges");
  assert.match(
    await card("cycle").locator("[data-sample-adjustments]").innerText(),
    /Nodes = 3/,
  );
  await card("cycle").getByRole("textbox").fill("");
  assert.equal(
    await card("cycle")
      .getByRole("button", { name: /Create/ })
      .isDisabled(),
    true,
  );
  assert.equal(await card("cycle").locator("svg circle").count(), 0);
  await card("cycle").getByRole("textbox").fill("8");
  await card("cycle")
    .getByRole("button", { name: /Reset parameters/ })
    .click();
  assert.equal(await card("cycle").getByRole("textbox").inputValue(), "6");
  await search.fill("crown");
  await card("crown").getByRole("textbox").fill("11");
  await waitStats("crown", "12 nodes / 30 edges");
  assert.match(
    await card("crown").locator("[data-sample-adjustments]").innerText(),
    /Nodes = 12/,
  );

  await search.fill("random DAG");
  await waitStats("randomDag", "12 nodes / 18 edges");
  const copyRandom = async () => {
    await card("randomDag")
      .getByRole("button", { name: /Copy edge list/ })
      .click();
    await page.waitForTimeout(100);
    return clipboard();
  };
  const first = await copyRandom();
  assert.equal(await copyRandom(), first, "same seed reproduces input");
  await card("randomDag")
    .getByRole("textbox", { name: "Random seed", exact: true })
    .fill("2");
  assert.notEqual(await copyRandom(), first, "different seed changes graph");
  await card("randomDag")
    .getByRole("textbox", { name: "Nodes", exact: true })
    .fill("1");
  await waitStats("randomDag", "1 nodes / 0 edges");
  assert.match(
    await card("randomDag").locator("[data-sample-adjustments]").innerText(),
    /Edges = 0/,
  );

  await search.fill("random connected");
  await card("randomConnected")
    .getByRole("textbox", { name: "Edges", exact: true })
    .fill("5000");
  await waitStats("randomConnected", "12 nodes / 66 edges");
  await card("randomConnected").evaluate((element) => {
    element.setAttribute("data-stale-preview-observed", "false");
    const observer = new MutationObserver(() => {
      const nodeInput = element.querySelector<HTMLInputElement>(
        'input[aria-label="Nodes"]',
      );
      const create = element.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      const preview = element.querySelector("[data-sample-stats]");
      if (
        nodeInput?.value === "1000" &&
        create &&
        !create.disabled &&
        !preview?.textContent?.startsWith("1000 nodes / 5000 edges")
      ) {
        element.setAttribute("data-stale-preview-observed", "true");
        observer.disconnect();
      }
    });
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
  await card("randomConnected")
    .getByRole("textbox", { name: "Nodes", exact: true })
    .fill("1000");
  await waitStats("randomConnected", "1000 nodes / 5000 edges");
  assert.equal(
    await card("randomConnected").getAttribute("data-stale-preview-observed"),
    "false",
    "an enabled Create action always corresponds to the current preview",
  );

  await search.fill("negative edges");
  await waitStats("negativeEdges", "6 nodes / 9 edges");
  assert.match(await stats("negativeEdges").innerText(), /Directed.*Weighted/);
  await card("negativeEdges")
    .getByRole("button", { name: /Create/ })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")?.nodes
        .length === 6,
  );
  const negative = await saved();
  assert.equal(negative.settings.directed, true);
  assert.equal(negative.settings.weighted, true);
  assert.equal(negative.settings.weightKind, "number");
  assert.equal(negative.settings.indexBase, 1);
  assert(negative.edges.some((edge) => Number(edge.weight) < 0));
  await screenshot("negative-edges-canvas");
  await openGallery();
  await search.fill("multigraph");
  await waitStats("multigraph", "4 nodes / 6 edges");
  await card("multigraph")
    .getByRole("button", { name: /Create/ })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")?.nodes
        .length === 4,
  );
  const multi = await saved();
  assert.equal(multi.settings.allowMultiEdges, true);
  assert.equal(multi.settings.allowSelfLoops, true);
  assert.equal(multi.edges.length, 6);
  assert(multi.edges.some((edge) => edge.source === edge.target));
  await screenshot("multigraph-canvas");
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Desktop search, controls, previews, copy, settings, persistence and undo passed",
  );

  await Promise.all(
    ["", "/en", "/zh-hans"].flatMap((route) =>
      (["light", "dark"] as const).map(async (theme) => {
        const mobile = await browser.newContext({
          viewport: { width: 375, height: 812 },
          isMobile: true,
          hasTouch: true,
          colorScheme: theme,
        });
        const mobilePage: Page = await mobile.newPage();
        mobilePage.setDefaultTimeout(10_000);
        mobilePage.on("pageerror", (error) => errors.push(error.message));
        await mobilePage.addInitScript(
          (value) => localStorage.setItem("graph-editor-theme", value),
          theme,
        );
        await mobilePage.goto(`${base}${route}`);
        const entry =
          route === "/en"
            ? /Choose a sample/
            : route === "/zh-hans"
              ? /选择示例/
              : /サンプルから/;
        await mobilePage.getByRole("button", { name: entry }).click();
        await mobilePage.locator("[data-sample-kind]").first().waitFor();
        await mobilePage.getByRole("searchbox").fill("cycle");
        const mobileCycleInput = mobilePage
          .locator('[data-sample-kind="cycle"]')
          .getByRole("textbox");
        await mobileCycleInput.fill("");
        await mobilePage.keyboard.insertText("１２");
        assert.equal(await mobileCycleInput.inputValue(), "１２");
        await mobilePage.waitForFunction(
          () =>
            document.querySelectorAll('[data-sample-kind="cycle"] svg circle')
              .length === 12,
        );
        assert.equal(
          await mobileCycleInput.getAttribute("aria-invalid"),
          "false",
        );
        await mobilePage.getByRole("searchbox").fill("random");
        await mobilePage
          .locator('[data-sample-kind="randomDag"] [data-sample-stats]')
          .waitFor();
        await mobilePage.waitForTimeout(350);
        const geometry = await mobilePage
          .locator("[data-sample-kind]")
          .evaluateAll((elements) =>
            elements.map((el) => {
              const bounds = el.getBoundingClientRect();
              return {
                width: bounds.width,
                left: bounds.left,
                right: bounds.right,
                overflow: el.scrollWidth > el.clientWidth,
              };
            }),
          );
        assert(
          geometry.every((r) => r.left >= 0 && r.right <= 375 && !r.overflow),
          `cards fit mobile viewport: ${route} ${theme}`,
        );
        await mobilePage.screenshot({
          path: `${artifacts}/mobile-${route.replaceAll("/", "") || "ja"}-${theme}.png`,
        });
        await mobile.close();
      }),
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Japanese/English/Chinese mobile light/dark rendering passed");
} finally {
  await browser.close();
}
