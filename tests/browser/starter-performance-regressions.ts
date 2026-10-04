import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type ViewportSize } from "playwright";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

// Run against the current static build in fresh browser contexts. The network
// assertions identify the actual gallery chunk instead of hardcoding its hash.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.env.STATIC_OUT_DIR ?? join(repository, "out");
const chunkDirectory = join(output, "_next/static/chunks");
const galleryChunks = new Set(
  readdirSync(chunkDirectory)
    .filter(
      (name) =>
        name.endsWith(".js") &&
        readFileSync(join(chunkDirectory, name), "utf8").includes(
          "data-sample-kind",
        ),
    )
    .map((name) => `/_next/static/chunks/${name}`),
);
assert.equal(
  galleryChunks.size,
  1,
  "the build has one identifiable gallery chunk",
);
const base = process.env.BASE_URL ?? "http://127.0.0.1:3314/en";
const text = "4 4\n0 1\n1 2\n1 3\n2 3";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

async function verifyStarter(name: string, viewport: ViewportSize) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  const requestedGallery = new Set<string>();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (galleryChunks.has(path)) requestedGallery.add(path);
  });
  const mobile = viewport.width < 768;
  const button = (label: string) =>
    page.getByRole("button", { name: label, exact: true });
  const panel = page.locator('[data-editor-panel="starter"]');
  const input = panel.locator('textarea[name="graph-input"]');
  const format = panel.getByRole("combobox", { name: "Format", exact: true });
  const preview = panel.locator('[aria-label="Preview"]');
  const saved = async (): Promise<GraphModel | null> =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null"),
    );
  const waitPreview = () =>
    page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-editor-panel="starter"] [aria-label="Preview"] svg circle',
        ).length === 4,
    );
  const previewGeometry = () =>
    preview.evaluate((element) => ({
      nodes: [...element.querySelectorAll("circle")].map((node) => [
        node.getAttribute("cx"),
        node.getAttribute("cy"),
        node.getAttribute("r"),
      ]),
      edges: [...element.querySelectorAll("path")].map((edge) =>
        edge.getAttribute("d"),
      ),
    }));
  try {
    await page.goto(base);
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await button("Load a graph").waitFor();
    assert.equal(
      requestedGallery.size,
      0,
      `${name}: initial load skips gallery JS`,
    );

    await button("Load a graph").click();
    await input.waitFor();
    // Use an explicit format so preview/apply assertions do not depend on the
    // auto-detector's relative strengths for structurally ambiguous inputs.
    await format.selectOption("contest-edge-list");
    await input.fill(text);
    await waitPreview();
    const originalPreview = await previewGeometry();
    assert.equal(await button("Apply to graph").isEnabled(), true);
    assert.equal(
      requestedGallery.size,
      0,
      `${name}: paste-only usage skips gallery JS`,
    );

    await button("Use a sample").click();
    await page.locator('[data-sample-kind="path"]').waitFor();
    assert.equal(
      requestedGallery.size,
      1,
      `${name}: sample intent fetches gallery JS`,
    );
    await button("Back to paste").click();
    await waitPreview();
    assert.equal(
      await input.inputValue(),
      text,
      `${name}: sample switch retains input`,
    );
    assert.equal(await format.inputValue(), "contest-edge-list");
    assert.deepEqual(
      await previewGeometry(),
      originalPreview,
      `${name}: preview is restored`,
    );
    await page.waitForFunction(
      () => document.activeElement?.getAttribute("name") === "graph-input",
    );
    await button("Apply to graph").click();
    await panel.waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const graph = JSON.parse(
        localStorage.getItem("graph-editor-graph") ?? "null",
      );
      return graph?.nodes.length === 4 && graph?.edges.length === 4;
    });
    const applied = await saved();
    assert.deepEqual(
      applied?.nodes.map((node) => node.label),
      ["0", "1", "2", "3"],
    );
    assert.equal(applied?.settings.directed, false);

    await button("Load a graph").click();
    await format.selectOption("contest-edge-list");
    await input.fill(text);
    await waitPreview();
    // Observe the close at the next paint, before the 180 ms exit timer. This
    // confirms that the still-visible paste preview remains intact.
    const closing = await panel.evaluate(
      (element) =>
        new Promise<{
          state: string | undefined;
          circles: number;
          input: string;
        }>((resolveResult) => {
          element
            .querySelector<HTMLButtonElement>('[data-panel-close="true"]')!
            .click();
          requestAnimationFrame(() =>
            resolveResult({
              state: (element as HTMLElement).dataset.panelState,
              circles: element.querySelectorAll(
                '[aria-label="Preview"] svg circle',
              ).length,
              input: element.querySelector<HTMLTextAreaElement>(
                'textarea[name="graph-input"]',
              )!.value,
            }),
          );
        }),
    );
    assert.deepEqual(closing, { state: "closing", circles: 4, input: text });
    await panel.waitFor({ state: "detached" });

    await button(mobile ? "Menu" : "Settings").click();
    await page
      .getByRole("radio", { name: "Direction: Directed", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")
          ?.settings.directed,
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await button("Load a graph").click();
    await input.waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLTextAreaElement>(
          '[data-editor-panel="starter"] textarea[name="graph-input"]',
        )?.value === "",
    );
    assert.equal(
      await input.inputValue(),
      "",
      `${name}: reopen resets retained input`,
    );
    assert.equal(await format.inputValue(), "auto");
    await page.waitForTimeout(50); // Let the panel's deferred focus timer settle.
    await page.waitForFunction(() => {
      const currentPanel = document.querySelector(
        '[data-editor-panel="starter"]',
      );
      return Boolean(currentPanel?.contains(document.activeElement));
    });
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-editor-panel="starter"] [aria-label="Preview"]',
        )?.textContent === "Waiting for input",
    );
    assert.equal(
      await preview.locator("svg").count(),
      0,
      `${name}: no stale reopened preview`,
    );
    const reopenedFocus = await page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      label: document.activeElement?.getAttribute("aria-label"),
    }));
    await format.selectOption("contest-edge-list");
    await input.fill(text);
    await waitPreview();
    assert.equal(
      await preview.locator("marker").count(),
      1,
      `${name}: new preview uses directed settings`,
    );
    await button("Apply to graph").click();
    await panel.waitFor({ state: "detached" });
    await page.waitForFunction(() => {
      const graph = JSON.parse(
        localStorage.getItem("graph-editor-graph") ?? "null",
      );
      return (
        graph?.nodes.length === 4 &&
        graph?.edges.length === 4 &&
        graph.settings.directed
      );
    });
    assert.deepEqual(errors, [], `${name}: no uncaught page errors`);
    return {
      name,
      galleryRequests: requestedGallery.size,
      reopenedFocus,
      verified: true,
    };
  } finally {
    await context.close();
  }
}

try {
  const desktop = await verifyStarter("desktop", { width: 1440, height: 1000 });
  const mobile = await verifyStarter("mobile", { width: 390, height: 844 });
  console.log(JSON.stringify({ desktop, mobile }));
} finally {
  await browser.close();
}
