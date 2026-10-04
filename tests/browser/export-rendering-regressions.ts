/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { chromium, type ViewportSize } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { exportGraph } from "../../features/graph-editor/io/export-graph";

// Run against a current production build. Separate contexts prevent changes to
// the user's browser/storage, and these checks do not collect timing samples.
const longLabel = "漢😀".repeat(128);
const model = {
  ...createEmptyGraphModel(),
  nodes: Array.from({ length: 600 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: index === 590 ? longLabel : String(index),
    x: (index % 30) * 100,
    y: Math.floor(index / 30) * 100,
  })),
  edges: [],
};
const raw = serializeGraphModel(model);
const expected = exportGraph(model, "tikz");
const longLine = expected
  .split("\n")
  .findIndex((line) => line.includes(longLabel));
assert.ok(
  longLine > 500,
  "long Unicode line starts outside the visible chunks",
);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

async function verifyRendering(name: string, viewport: ViewportSize) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(20_000);
  try {
    await page.addInitScript((text) => {
      localStorage.setItem("graph-editor-graph", text);
    }, raw);
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:3314/en");
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Export format" })
      .selectOption("tikz");
    const output = page.locator("pre[aria-label^='Exported']");
    await page.waitForFunction(() =>
      document
        .querySelector("pre[aria-label^='Exported']")
        ?.textContent?.includes("\\endgroup"),
    );
    assert.equal(
      await output.textContent(),
      expected,
      `${name}: exact DOM text`,
    );

    const longChunk = output
      .locator("[data-export-chunk]")
      .nth(Math.floor(longLine / 50));
    for (let visit = 0; visit < 2; visit += 1) {
      await longChunk.scrollIntoViewIfNeeded();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      const pan = await output.evaluate((element) => {
        const pre = element as HTMLPreElement;
        const range = Math.max(0, pre.scrollWidth - pre.clientWidth);
        pre.scrollLeft = Math.min(range, 800);
        return {
          range,
          scrollLeft: pre.scrollLeft,
          clientWidth: pre.clientWidth,
          chunkWidths: [
            ...pre.querySelectorAll<HTMLElement>("[data-export-chunk]"),
          ].map((chunk) => ({
            width: chunk.clientWidth,
            scrollWidth: chunk.scrollWidth,
          })),
        };
      });
      assert.ok(
        pan.range > pan.clientWidth,
        `${name}: visit ${visit} exposes the long line's width: ${JSON.stringify(pan)}`,
      );
      assert.ok(
        pan.scrollLeft > 0,
        `${name}: visit ${visit} can pan horizontally`,
      );
      assert.equal(
        await output.textContent(),
        expected,
        `${name}: pan preserves all text`,
      );

      const alignment = await output.evaluate((element) => {
        const pre = element as HTMLPreElement;
        const gutter = pre.previousElementSibling!;
        const textChunks = [
          ...pre.querySelectorAll<HTMLElement>("[data-export-chunk]"),
        ];
        const gutterChunks = [
          ...gutter.querySelectorAll<HTMLElement>("[data-export-chunk]"),
        ];
        return {
          textCount: textChunks.length,
          gutterCount: gutterChunks.length,
          offsets: textChunks.map(
            (chunk, index) =>
              chunk.getBoundingClientRect().top -
              gutterChunks[index]!.getBoundingClientRect().top,
          ),
          lastText: textChunks.at(-1)!.textContent,
          lastNumbers: gutterChunks.at(-1)!.textContent,
        };
      });
      assert.equal(
        alignment.textCount,
        alignment.gutterCount,
        `${name}: both columns have the same chunk count`,
      );
      assert.ok(
        alignment.offsets.every((offset) => Math.abs(offset) < 1),
        `${name}: every gutter chunk aligns, including the last partial chunk`,
      );
      assert.ok(
        alignment.lastText!.endsWith("\n"),
        `${name}: final chunk retains trailing empty line`,
      );
      assert.ok(
        alignment.lastNumbers!.endsWith(String(expected.split("\n").length)),
        `${name}: final gutter line retains its number`,
      );

      if (visit === 0) {
        await output.evaluate((element) => {
          const scroller = element.closest<HTMLElement>(".ge-scrollbar")!;
          scroller.scrollTop = 0;
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        const retainedPan = await output.evaluate((element) => ({
          width: element.scrollWidth,
          left: element.scrollLeft,
        }));
        assert.equal(
          retainedPan.width,
          pan.range + pan.clientWidth,
          `${name}: long line width remains usable while its chunk is offscreen`,
        );
        assert.equal(
          retainedPan.left,
          pan.scrollLeft,
          `${name}: vertical scrolling preserves the horizontal offset`,
        );
      }
    }

    const selection = await output.evaluate((element, text) => {
      const pre = element as HTMLPreElement;
      const plain = pre.cloneNode(false) as HTMLPreElement;
      plain.setAttribute("aria-label", "Plain export selection reference");
      plain.style.position = "fixed";
      plain.style.left = "-100000px";
      plain.style.width = `${pre.clientWidth}px`;
      plain.textContent = text;
      document.body.append(plain);
      const select = (node: Node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selected = window.getSelection()!;
        selected.removeAllRanges();
        selected.addRange(range);
        return selected.toString();
      };
      const chunked = select(pre);
      const reference = select(plain);
      window.getSelection()!.removeAllRanges();
      plain.remove();
      return { chunked, reference };
    }, expected);
    assert.equal(
      selection.chunked,
      selection.reference,
      `${name}: selection matches a plain pre, including browser trailing-newline behavior`,
    );
    assert.deepEqual(errors, [], `${name}: no page errors`);
    console.log(
      `${name}: export DOM, selection, gutter alignment and repeated horizontal pan passed`,
    );
  } finally {
    await context.close();
  }
}

try {
  await verifyRendering("desktop", { width: 1440, height: 1000 });
  await verifyRendering("mobile", { width: 390, height: 844 });
} finally {
  await browser.close();
}
