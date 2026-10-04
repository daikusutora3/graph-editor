/* oxlint-disable no-await-in-loop -- Preview changes depend on the previous image. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Core } from "cytoscape";
import { chromium, type Page, type ViewportSize } from "playwright";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3335/en";
const graph = {
  ...createEmptyGraphModel({ directed: true, autoEdgeRouting: false }),
  nodes: Array.from({ length: 100 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: `頂点 ${index}`,
    x: (index % 10) * 100,
    y: Math.floor(index / 10) * 100,
  })),
  edges: Array.from({ length: 400 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % 100}`,
    target: `n${(index + Math.floor(index / 100) + 1) % 100}`,
  })),
};

async function changeZoom(page: Page, zoom: number) {
  await page.evaluate((value) => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    container._cyreg.cy.zoom(value);
  }, zoom);
}

async function changePan(page: Page) {
  await page.evaluate(() => {
    const container = [...document.querySelectorAll("div")].find(
      (element) => "_cyreg" in element,
    ) as HTMLDivElement & { _cyreg: { cy: Core } };
    // eslint-disable-next-line no-underscore-dangle
    const cy = container._cyreg.cy;
    const pan = cy.pan();
    cy.pan({ x: pan.x + 80, y: pan.y + 40 });
  });
}

async function verify(viewport: ViewportSize) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const panel = page.locator('[data-editor-panel="png"]');
  const image = panel.getByRole("img", { name: "Preview of the PNG export" });
  const count = () =>
    page.evaluate(() =>
      (
        window as unknown as { readPreviewExportCount: () => number }
      ).readPreviewExportCount(),
    );
  const waitFresh = async (previous: string | null) => {
    await page.waitForFunction((old) => {
      const current = document.querySelector<HTMLImageElement>(
        '[data-editor-panel="png"] img[src^="blob:"]',
      );
      return (
        current &&
        current.src !== old &&
        current.complete &&
        current.naturalWidth > 0
      );
    }, previous);
    await page.waitForTimeout(350);
  };
  const imageHash = () =>
    image.evaluate(async (element) => {
      // connect-src intentionally excludes blob:. Capture test-created blobs
      // instead of weakening production CSP to fetch an image's source.
      const bytes = await (
        window as unknown as {
          readPreviewImageBytes: (url: string) => Promise<ArrayBuffer>;
        }
      ).readPreviewImageBytes((element as HTMLImageElement).src);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    });
  try {
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);
      const queries: { query: MediaQueryList; matches: boolean }[] = [];
      window.matchMedia = (text) => {
        const query = matchMedia(text);
        if (text.startsWith("(resolution:"))
          queries.push({ query, matches: query.matches });
        return query;
      };
      Object.assign(window, {
        signalDisplayDensityChange: () => {
          // CDP changes DPR and query matches without emitting the resolution
          // change event. Deliver that standard event to the real app listener.
          // Snapshot first because handling a change registers the next query.
          for (const entry of queries.slice()) {
            const matches = entry.query.matches;
            if (matches === entry.matches) continue;
            entry.matches = matches;
            entry.query.dispatchEvent(
              new MediaQueryListEvent("change", {
                matches,
                media: entry.query.media,
              }),
            );
          }
        },
      });
    });
    await page.addInitScript((raw) => {
      localStorage.setItem("graph-editor-graph", raw);
    }, JSON.stringify(graph));
    await page.goto(base);
    await page.locator('[data-canvas-ready="true"]').waitFor();
    await page.evaluate(() => {
      const container = [...document.querySelectorAll("div")].find(
        (element) => "_cyreg" in element,
      ) as HTMLDivElement & { _cyreg: { cy: Core } };
      // eslint-disable-next-line no-underscore-dangle
      const cy = container._cyreg.cy;
      const png = cy.png.bind(cy);
      const createUrl = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (object) => {
        const url = createUrl(object);
        if (object instanceof Blob) blobs.set(url, object);
        return url;
      };
      let calls = 0;
      cy.png = ((options: Parameters<Core["png"]>[0]) => {
        calls++;
        return png(options);
      }) as Core["png"];
      Object.assign(window, {
        readPreviewExportCount: () => calls,
        readPreviewImageBytes: (url: string) => blobs.get(url)!.arrayBuffer(),
      });
    });
    await page.getByRole("button", { name: "PNG image", exact: true }).click();
    await waitFresh(null);
    const fullUrl = await image.getAttribute("src");
    const fullHash = await imageHash();
    assert.equal(await count(), 1, "opening full PNG creates one preview");
    for (const zoom of [0.2, 0.5, 1, 1.5]) {
      await changeZoom(page, zoom);
      await page.waitForTimeout(350);
      assert.equal(await count(), 1, "full PNG does not depend on zoom");
      assert.equal(await image.getAttribute("src"), fullUrl);
    }
    await changePan(page);
    await page.waitForTimeout(350);
    assert.equal(await count(), 1, "full PNG does not depend on pan");
    assert.equal(await image.getAttribute("src"), fullUrl);
    // Exercise the real desktop zoom controls too; mobile uses touch gestures.
    if (viewport.width > 768) {
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
      // Canvas controls intentionally close this floating panel.
      await panel.waitFor({ state: "detached" });
      await page
        .getByRole("button", { name: "PNG image", exact: true })
        .click();
      await image.waitFor();
      await page.waitForTimeout(350);
      assert.equal(await count(), 1);
      assert.equal(await image.getAttribute("src"), fullUrl);
    }
    const downloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    const download = await downloadPromise;
    const downloaded = readFileSync((await download.path())!);
    assert.equal(
      createHash("sha256").update(downloaded).digest("hex"),
      fullHash,
    );
    assert.equal(await count(), 2, "saving still exports the current graph");

    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    await changeZoom(page, 0.2);
    await page.getByRole("button", { name: "PNG image", exact: true }).click();
    await image.waitFor();
    await page.waitForTimeout(350);
    assert.equal(await count(), 2, "reopening full PNG after zoom reuses it");
    assert.equal(await image.getAttribute("src"), fullUrl);

    await panel
      .getByRole("radio", { name: "Image size: Current zoom" })
      .click();
    await waitFresh(fullUrl);
    let previous = await image.getAttribute("src");
    let previousCount = await count();
    const width = await image.evaluate(
      (element) => (element as HTMLImageElement).naturalWidth,
    );
    await changeZoom(page, 0.4);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.ok(
      (await image.evaluate(
        (element) => (element as HTMLImageElement).naturalWidth,
      )) > width,
      "natural PNG follows current zoom",
    );
    previous = await image.getAttribute("src");
    previousCount = await count();
    const naturalHash = await imageHash();
    await changeZoom(page, 0.404);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.notEqual(
      await imageHash(),
      naturalHash,
      "natural PNG follows zoom changes within the same rounded percentage",
    );
    const naturalDownloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    const naturalDownload = await naturalDownloadPromise;
    assert.equal(
      createHash("sha256")
        .update(readFileSync((await naturalDownload.path())!))
        .digest("hex"),
      await imageHash(),
      "natural PNG preview matches the saved PNG after fractional zoom",
    );
    previous = await image.getAttribute("src");
    previousCount = await count();
    await changePan(page);
    await page.waitForTimeout(350);
    assert.equal(await count(), previousCount, "natural PNG ignores pan");
    assert.equal(await image.getAttribute("src"), previous);
    previous = await image.getAttribute("src");
    await panel
      .getByRole("radio", { name: "Image size: Fixed canvas" })
      .click();
    await waitFresh(previous);
    previous = await image.getAttribute("src");
    previousCount = await count();
    const fixedHash = await imageHash();
    await changeZoom(page, 0.6);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.notEqual(await imageHash(), fixedHash);
    assert.deepEqual(
      await image.evaluate((element) => ({
        width: (element as HTMLImageElement).naturalWidth,
        height: (element as HTMLImageElement).naturalHeight,
      })),
      { width: 1920, height: 1080 },
    );
    previous = await image.getAttribute("src");
    previousCount = await count();
    const beforeFractionalFixedHash = await imageHash();
    await changeZoom(page, 0.604);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.notEqual(
      await imageHash(),
      beforeFractionalFixedHash,
      "fixed canvas follows zoom changes within the same rounded percentage",
    );
    previous = await image.getAttribute("src");
    previousCount = await count();
    await changePan(page);
    await page.waitForTimeout(350);
    assert.equal(await count(), previousCount, "fixed canvas ignores pan");
    assert.equal(await image.getAttribute("src"), previous);

    previous = await image.getAttribute("src");
    await panel.getByRole("radio", { name: "Scope: Viewport" }).click();
    await waitFresh(previous);
    previous = await image.getAttribute("src");
    previousCount = await count();
    const viewportHash = await imageHash();
    await changeZoom(page, 0.3);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.notEqual(await imageHash(), viewportHash);

    previous = await image.getAttribute("src");
    previousCount = await count();
    const beforeFractionalViewportHash = await imageHash();
    await changeZoom(page, 0.304);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.notEqual(
      await imageHash(),
      beforeFractionalViewportHash,
      "viewport PNG follows zoom changes within the same rounded percentage",
    );

    previous = await image.getAttribute("src");
    previousCount = await count();
    const beforePanHash = await imageHash();
    await changePan(page);
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    const pannedHash = await imageHash();
    assert.notEqual(pannedHash, beforePanHash, "viewport PNG follows pan");
    const viewportDownloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    const viewportDownload = await viewportDownloadPromise;
    assert.equal(
      createHash("sha256")
        .update(readFileSync((await viewportDownload.path())!))
        .digest("hex"),
      pannedHash,
      "the viewport preview matches the saved PNG after panning",
    );
    await page.waitForTimeout(350);
    previous = await image.getAttribute("src");
    previousCount = await count();
    await page.setViewportSize({
      width: viewport.width + 20,
      height: viewport.height,
    });
    await waitFresh(previous);
    assert.equal(
      await count(),
      previousCount + 1,
      "viewport PNG follows resize",
    );

    // Keep the CDP session alive: detaching it resets emulated display scale.
    // Change only display density; CSS dimensions and graph zoom stay fixed.
    const display = await context.newCDPSession(page);
    const changeDisplayScale = async (deviceScaleFactor: number) => {
      await display.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width + 20,
        height: viewport.height,
        deviceScaleFactor,
        mobile: false,
      });
      await page.evaluate(() =>
        (
          window as unknown as { signalDisplayDensityChange: () => void }
        ).signalDisplayDensityChange(),
      );
    };
    previous = await image.getAttribute("src");
    await panel
      .getByRole("radio", { name: "Scope: Full", exact: true })
      .click();
    await waitFresh(previous);
    previous = await image.getAttribute("src");
    previousCount = await count();
    const beforeDisplayScaleFullHash = await imageHash();
    await changeDisplayScale(2);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => devicePixelRatio), 2);
    assert.equal(await count(), previousCount, "fixed-size full ignores DPR");
    assert.equal(await image.getAttribute("src"), previous);
    const fullDprDownloadPromise = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    const fullDprDownload = await fullDprDownloadPromise;
    assert.equal(
      createHash("sha256")
        .update(readFileSync((await fullDprDownload.path())!))
        .digest("hex"),
      beforeDisplayScaleFullHash,
      "full PNG remains identical at a different display density",
    );
    await changeDisplayScale(1);
    await changeZoom(page, 0.25);
    await page.waitForTimeout(350);

    for (const name of [
      "Image size: Current zoom",
      "Image size: Fixed canvas",
      "Scope: Viewport",
    ]) {
      previous = await image.getAttribute("src");
      await panel.getByRole("radio", { name }).click();
      await waitFresh(previous);
      previous = await image.getAttribute("src");
      previousCount = await count();
      const beforeDprHash = await imageHash();
      await changeDisplayScale(2);
      await waitFresh(previous);
      assert.equal(await count(), previousCount + 1);
      const afterDprHash = await imageHash();
      assert.notEqual(afterDprHash, beforeDprHash, `${name} follows DPR`);
      const dprDownloadPromise = page.waitForEvent("download");
      await panel.getByRole("button", { name: "Save", exact: true }).click();
      const dprDownload = await dprDownloadPromise;
      assert.equal(
        createHash("sha256")
          .update(readFileSync((await dprDownload.path())!))
          .digest("hex"),
        afterDprHash,
        `${name} preview matches the saved PNG at a different display density`,
      );
      await page.waitForTimeout(350);
      previous = await image.getAttribute("src");
      previousCount = await count();
      await changeDisplayScale(1);
      await waitFresh(previous);
      assert.equal(await count(), previousCount + 1);
    }
    previous = await image.getAttribute("src");
    previousCount = await count();
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await panel.waitFor({ state: "detached" });
    await changeDisplayScale(2);
    await page.waitForTimeout(350);
    assert.equal(
      await count(),
      previousCount,
      "hidden preview does not export",
    );
    await page.getByRole("button", { name: "PNG image", exact: true }).click();
    await waitFresh(previous);
    assert.equal(await count(), previousCount + 1);
    assert.deepEqual(errors, []);
    console.log(
      `PNG preview zoom, pan, resize, DPR, reopening and exact download passed: ${viewport.width}px`,
    );
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  await verify({ width: 1440, height: 1000 });
  await verify({ width: 390, height: 844 });
} finally {
  await browser.close();
}
