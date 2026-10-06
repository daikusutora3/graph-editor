// Exercise the user's workflow, including the visual viewport shrinking independently.
/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit, type Page } from "playwright";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import type { Locale } from "../../features/graph-editor/i18n/locale";

const engine = process.env.BROWSER ?? "chromium";
const browserType = { chromium, firefox, webkit }[engine];
assert(browserType, `Unknown browser: ${engine}`);
const browser = await browserType.launch();
const base = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const output =
  process.env.OUTPUT_DIR ?? "/tmp/graph-editor-ui-followup/workflow";
await mkdir(output, { recursive: true });
const results: string[] = [];
const errors: string[] = [];

async function fits(page: Page, selector: string, height: number) {
  assert.deepEqual(
    await page.locator(selector).evaluateAll(
      (elements, limit) =>
        elements.flatMap((element) => {
          const r = element.getBoundingClientRect();
          return r.width &&
            r.height &&
            (r.left < -1 ||
              r.right > innerWidth + 1 ||
              r.top < -1 ||
              r.bottom > limit + 1)
            ? [
                {
                  text: element.textContent,
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                },
              ]
            : [];
        }),
      height,
    ),
    [],
  );
}

try {
  for (const locale of ["ja", "en", "zh-Hans"] as Locale[]) {
    const m = messagesByLocale[locale];
    for (const width of [320, 414, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        locale === "ja" ? base : `${base}/${locale.toLowerCase()}`,
      );
      await page.locator('[data-canvas-ready="true"]').waitFor();
      await fits(page, '[data-editor-chrome-control="true"]', 900);
      const load = page.getByRole("button", {
        name: m.chrome.openStarter,
        exact: true,
      });
      if (width < 768) assert.match(await load.innerText(), /\S/);
      await load.click();
      const input = page.locator("textarea");
      await input.fill("4 4\n1 2\n2 3\n2 4\n3 4");
      const apply = page.getByRole("button", {
        name: m.chrome.starterApply,
        exact: true,
      });
      if (width < 768) {
        // dvh remains 900px, but the keyboard leaves only 390px visible.
        await page.evaluate(() => {
          Object.defineProperty(window.visualViewport!, "height", {
            configurable: true,
            value: 390,
          });
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
        await page.waitForFunction(
          () =>
            document.querySelector("main")!.getBoundingClientRect().height ===
            390,
        );
        await page
          .locator('[data-editor-panel="starter"]')
          .evaluate((element) =>
            Promise.allSettled(
              element.getAnimations().map((animation) => animation.finished),
            ),
          );
        await input.scrollIntoViewIfNeeded();
        await fits(page, "textarea", 390);
        await page.screenshot({
          path: `${output}/${engine}-${locale}-${width}-keyboard.png`,
        });
        await fits(
          page,
          '[data-editor-panel="starter"] [data-panel-close], [data-editor-panel="starter"] button',
          390,
        );
      }
      await apply.click();
      await page
        .locator('[data-editor-panel="starter"]')
        .waitFor({ state: "detached" });
      if (width < 768) {
        await page.evaluate(() => {
          Reflect.deleteProperty(window.visualViewport!, "height");
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
        await page.waitForFunction(
          () =>
            document.querySelector("main")!.getBoundingClientRect().height ===
            900,
        );
      }
      const nodes = page.locator("button.ge-select-node-hitbox");
      await nodes.first().waitFor();
      assert.equal(await nodes.count(), 4);
      await nodes.first().click();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: m.chrome.export, exact: true })
        .click();
      const panel = page.locator('[data-editor-panel="export"]');
      await panel
        .getByRole("button", { name: m.exportPanel.purposes.save, exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLSelectElement>(
            '[data-editor-panel="export"] select',
          )?.value === "json",
      );
      await page.waitForFunction(() =>
        document
          .querySelector('[data-editor-panel="export"] pre')
          ?.textContent?.includes('"nodes"'),
      );
      const json = JSON.parse((await panel.locator("pre").textContent())!);
      assert.equal(json.nodes.length, 4);
      const downloadPromise = page.waitForEvent("download");
      await panel
        .getByRole("button", { name: m.chrome.saveAs("json"), exact: true })
        .click();
      const download = await downloadPromise;
      assert(download.suggestedFilename().endsWith(".json"));
      await panel
        .getByRole("button", { name: m.exportPanel.purposes.data, exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLSelectElement>(
            '[data-editor-panel="export"] select',
          )?.value === "edge-list",
      );
      await fits(page, '[data-editor-panel="export"] button', 900);
      await page.screenshot({
        path: `${output}/${engine}-${locale}-${width}-export.png`,
      });
      await panel
        .getByRole("button", {
          name: m.exportPanel.purposes.image,
          exact: true,
        })
        .click();
      await page.locator('[data-editor-panel="png"]').waitFor();
      await page.keyboard.press("Escape");
      await page
        .locator('[data-editor-panel="png"]')
        .waitFor({ state: "detached" });
      await page.reload();
      await nodes.first().waitFor();
      assert.equal(await nodes.count(), 4, "Graph survives export and reload");
      results.push(
        `${locale} ${width}: import, keyboard viewport, edit selection, JSON download, data/image export, persistence`,
      );
      console.log(`${engine} ${results.at(-1)} passed`);
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/${engine}.json`,
    JSON.stringify({ engine, results, errors }, null, 2),
  );
} finally {
  await browser.close();
}
