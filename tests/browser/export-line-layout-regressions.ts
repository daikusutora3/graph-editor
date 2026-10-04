/* oxlint-disable no-await-in-loop -- Browser visits and cancellation checks depend on the preceding state. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, type Page, type ViewportSize } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { exportGraph } from "../../features/graph-editor/io/export-graph";

// Keep the large labels and weights in the exported source, while avoiding a
// separate canvas glyph workload. Each label remains within the model limit.
const seedModel: GraphModel = {
  ...createEmptyGraphModel({
    autoEdgeRouting: false,
    showNodeLabels: false,
    weightKind: "string",
  }),
  nodes: Array.from({ length: 1_000 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: "漢".repeat(256),
    x: (index % 40) * 40,
    y: Math.floor(index / 40) * 40,
  })),
  edges: Array.from({ length: 5_000 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % 1_000}`,
    target: `n${(index + 1) % 1_000}`,
    weight: "字".repeat(256),
  })),
};
// Storage normalizes property order before the graph reaches the UI.
const model = parseGraphModelJson(serializeGraphModel(seedModel))!;
const raw = serializeGraphModel(model);
assert.ok(raw.length > 1_500_000 && !raw.includes("\n"));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const base = process.env.BASE_URL ?? "http://127.0.0.1:3335/en";

async function openGraph(
  page: Page,
  graph: GraphModel,
  canvasUnavailable = false,
) {
  await page.addInitScript((text) => {
    localStorage.setItem("graph-editor-graph", text);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) =>
          Object.assign(globalThis, { copiedLineExport: value }),
      },
    });
  }, serializeGraphModel(graph));
  await page.goto(base);
  await page.locator('[data-canvas-ready="true"]').waitFor();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  if (canvasUnavailable) {
    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        "getContext",
      )!;
      Object.assign(globalThis, {
        restoreLineCanvasContext: () =>
          Object.defineProperty(
            HTMLCanvasElement.prototype,
            "getContext",
            descriptor,
          ),
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: () => null,
      });
    });
  }
  await page
    .getByRole("combobox", { name: "Export format" })
    .selectOption("json");
}

async function verifyLarge(name: string, viewport: ViewportSize) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const output = page.locator("pre[aria-label^='Exported']");
  const format = page.getByRole("combobox", { name: "Export format" });
  const waitReady = () =>
    page.waitForFunction(
      (expected) =>
        document.querySelector("pre[aria-label^='Exported']")?.textContent ===
        expected,
      raw,
    );
  try {
    await openGraph(page, model);
    await waitReady();
    assert.ok(await output.locator("[data-export-line-chunk]").count());
    assert.equal(await output.getAttribute("aria-busy"), "false");
    const initialWidth = await output.evaluate(
      (element) => element.scrollWidth,
    );

    const selection = await output.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selected = window.getSelection()!;
      selected.removeAllRanges();
      selected.addRange(range);
      const all = selected.toString();
      const spans = element.querySelectorAll<HTMLElement>(
        "[data-export-line-chunk]",
      );
      const first = spans[0]!.firstChild!;
      const second = spans[1]!.firstChild!;
      range.setStart(first, first.textContent!.length - 8);
      range.setEnd(second, 8);
      selected.removeAllRanges();
      selected.addRange(range);
      const boundary = selected.toString();
      selected.removeAllRanges();
      return { all, boundary, boundaryOffset: first.textContent!.length };
    });
    assert.equal(
      selection.all,
      raw,
      `${name}: native selection preserves source`,
    );
    assert.equal(
      selection.boundary,
      raw.slice(selection.boundaryOffset - 8, selection.boundaryOffset + 8),
    );

    const chunkCount = await output.locator("[data-export-line-chunk]").count();
    for (const index of [1, Math.floor(chunkCount / 2), chunkCount - 1, 0]) {
      await output.evaluate((element, target) => {
        const pre = element as HTMLPreElement;
        const chunk = pre.querySelectorAll<HTMLElement>(
          "[data-export-line-chunk]",
        )[target]!;
        pre.scrollLeft = Number.parseFloat(chunk.style.left);
      }, index);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const geometry = await output.evaluate((element, target) => {
        const pre = element as HTMLPreElement;
        const chunks = pre.querySelectorAll<HTMLElement>(
          "[data-export-line-chunk]",
        );
        const chunk = chunks[target]!;
        const text = chunk.firstChild!;
        const textLength = text.textContent!.length;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 1);
        const first = range.getBoundingClientRect();
        range.setStart(text, textLength - 1);
        range.setEnd(text, textLength);
        const last = range.getBoundingClientRect();
        const chunkBounds = chunk.getBoundingClientRect();
        const style = getComputedStyle(pre);
        const reference = document.createElement("span");
        reference.style.cssText =
          "position:fixed;left:0;top:-100px;visibility:hidden;display:inline-block;white-space:pre";
        for (const property of [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "fontStyle",
          "fontKerning",
          "fontVariantNumeric",
          "fontFeatureSettings",
          "letterSpacing",
          "wordSpacing",
          "textRendering",
        ] as const) {
          reference.style[property] = style[property];
        }
        reference.textContent = text.textContent;
        document.body.append(reference);
        const naturalWidth = reference.getBoundingClientRect().width;
        reference.remove();
        return {
          width: pre.scrollWidth,
          firstOffset: first.left - chunkBounds.left,
          measuredWidth: Number.parseFloat(chunk.style.width),
          naturalWidth,
          lastOffset: last.right - chunkBounds.left,
          lastText: text.textContent!.slice(-8),
        };
      }, index);
      assert.equal(geometry.width, initialWidth, `${name}: width survives pan`);
      assert.ok(Math.abs(geometry.firstOffset) < 1, JSON.stringify(geometry));
      assert.ok(
        Math.abs(geometry.measuredWidth - geometry.naturalWidth) < 1,
        `${name}: measured chunk width matches its actual font: ${JSON.stringify(geometry)}`,
      );
      assert.ok(
        Math.abs(geometry.lastOffset - geometry.naturalWidth) < 1,
        `${name}: the chunk's final character is preserved: ${JSON.stringify(geometry)}`,
      );
      if (index === chunkCount - 1) {
        assert.equal(geometry.lastText, raw.slice(-8));
      }
    }

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () =>
          (globalThis as typeof globalThis & { copiedLineExport: string })
            .copiedLineExport,
      ),
      raw,
    );
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Save as .json", exact: true })
      .click();
    assert.equal(readFileSync((await (await downloaded).path())!, "utf8"), raw);

    if (name === "desktop") {
      // Exercise the actual font-loading notification with a changed font size.
      const firstChunkWidth = await output
        .locator("[data-export-line-chunk]")
        .first()
        .evaluate((element) =>
          Number.parseFloat((element as HTMLElement).style.width),
        );
      await output.evaluate((element) => {
        (element as HTMLElement).style.fontSize = "15px";
        document.fonts.dispatchEvent(new Event("loadingdone"));
      });
      await page.waitForFunction((previous) => {
        const chunk = document.querySelector<HTMLElement>(
          "[data-export-line-chunk]",
        );
        return Boolean(
          chunk && Number.parseFloat(chunk.style.width) > previous * 1.1,
        );
      }, firstChunkWidth);
      await waitReady();
      assert.ok(
        (await output.evaluate((element) => element.scrollWidth)) >
          initialWidth,
        "font change discards previously measured widths",
      );

      await format.selectOption("edge-list");
      assert.equal(await output.textContent(), exportGraph(model, "edge-list"));
      await format.selectOption("json");
      await format.selectOption("edge-list");
      await page.waitForTimeout(700);
      assert.equal(await output.textContent(), exportGraph(model, "edge-list"));
      await format.selectOption("json");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(220);
      assert.equal(await output.count(), 0);
      await page.getByRole("button", { name: "Export", exact: true }).click();
      await waitReady();
      assert.equal(await output.textContent(), raw);

      // A graph-setting update changes the source while pending measurement is
      // discarded with the panel; old callbacks must not restore the old text.
      await format.selectOption("edge-list");
      await format.selectOption("json");
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("checkbox", { name: "Snap drags to grid", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")
            ?.settings.snapToGrid,
      );
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const changedRaw = serializeGraphModel({
        ...model,
        settings: { ...model.settings, snapToGrid: true },
      });
      await page.waitForFunction(
        (expected) =>
          document.querySelector("pre[aria-label^='Exported']")?.textContent ===
          expected,
        changedRaw,
      );
      await page.waitForTimeout(700);
      assert.equal(await output.textContent(), changedRaw);
    }
    assert.deepEqual(errors, [], `${name}: no page errors`);
    console.log(
      `${name}: long source selection, glyph widths, pan, copy and download passed`,
    );
  } finally {
    await context.close();
  }
}

async function verifyFallback(label: string, canvasUnavailable = false) {
  const graph: GraphModel = {
    ...model,
    nodes: model.nodes
      .slice(0, 80)
      .map((node, index) => (index === 0 ? { ...node, label } : node)),
    edges: model.edges.slice(0, 80).map((edge, index) => ({
      ...edge,
      source: `n${index}`,
      target: `n${(index + 1) % 80}`,
    })),
  };
  const expected = serializeGraphModel(graph);
  assert.ok(expected.length > 32_768);
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  try {
    await openGraph(page, graph, canvasUnavailable);
    const output = page.locator("pre[aria-label^='Exported']");
    await page.waitForFunction(
      (text) =>
        document.querySelector("pre[aria-label^='Exported']")?.textContent ===
        text,
      expected,
    );
    assert.equal(await output.locator("[data-export-line-chunk]").count(), 0);
    assert.equal(await output.textContent(), expected);
    assert.equal(await output.getAttribute("aria-busy"), "false");
    if (canvasUnavailable) {
      await page.evaluate(() =>
        (
          globalThis as typeof globalThis & {
            restoreLineCanvasContext: () => void;
          }
        ).restoreLineCanvasContext(),
      );
    }
  } finally {
    await context.close();
  }
}

try {
  await verifyLarge("desktop", { width: 1440, height: 1000 });
  await verifyLarge("mobile", { width: 390, height: 844 });
  for (const label of ["العربية", "か\u3099", "ｶﾞ"])
    await verifyFallback(label);
  await verifyFallback("正常", true);
  console.log(
    "Bidi, combining marks and halfwidth voiced-kana fallbacks passed",
  );
} finally {
  await browser.close();
}
