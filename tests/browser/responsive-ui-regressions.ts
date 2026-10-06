// Browser interactions depend on the previous action and run sequentially.
/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import type { Locale } from "../../features/graph-editor/i18n/locale";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const locales = (process.env.LOCALES ?? "ja,en,zh-Hans").split(",") as Locale[];
const widths = (process.env.WIDTHS ?? "320,375,767,768,1280")
  .split(",")
  .map(Number);
const browser = await chromium.launch();
const errors: string[] = [];

async function assertFits(page: Page, selector: string) {
  const findings = await page.locator(selector).evaluateAll((elements) =>
    elements.flatMap((element) => {
      if (!element.getClientRects().length) return [];
      const r = element.getBoundingClientRect();
      return r.left < -1 ||
        r.right > innerWidth + 1 ||
        r.top < -1 ||
        r.bottom > innerHeight + 1
        ? [
            {
              label: element.getAttribute("aria-label") ?? element.textContent,
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            },
          ]
        : [];
    }),
  );
  assert.deepEqual(
    findings,
    [],
    `Controls must fit: ${JSON.stringify(findings)}`,
  );
}

try {
  for (const locale of locales) {
    const messages = messagesByLocale[locale];
    for (const theme of ["light", "dark"] as const) {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        await context.addInitScript(
          (value) => localStorage.setItem("graph-editor-theme", value),
          theme,
        );
        const page = await context.newPage();
        page.setDefaultTimeout(10_000);
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          locale === "ja" ? base : `${base}/${locale.toLowerCase()}`,
        );
        await page.locator('[data-canvas-ready="true"]').waitFor();
        const load = page.getByRole("button", {
          name: messages.chrome.openStarter,
          exact: true,
        });
        await load.click();
        const dialog = page.locator('[data-editor-panel="starter"]');
        await page.locator("textarea").fill("4 4\n1 2\n2 3\n2 4\n3 4");
        const apply = page.getByRole("button", {
          name: messages.chrome.starterApply,
          exact: true,
        });
        await page.waitForFunction(
          (label) =>
            [
              ...document.querySelectorAll<HTMLButtonElement>(
                '[data-editor-panel="starter"] button',
              ),
            ].some((e) => e.textContent === label && !e.disabled),
          messages.chrome.starterApply,
        );
        await assertFits(page, '[data-editor-panel="starter"] button');
        await apply.click();
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(
          () =>
            document.querySelectorAll("button.ge-select-node-hitbox").length ===
            4,
        );
        await page.locator("button.ge-select-node-hitbox").first().click();
        const palette = page.getByRole("radiogroup", {
          name: messages.canvas.nodeColor,
          exact: true,
        });
        await assertFits(page, '[role="toolbar"] [role="radio"]');
        const last = palette.getByRole("radio").last();
        await last.click();
        assert.equal(await last.getAttribute("aria-checked"), "true");
        await page.waitForFunction(
          () =>
            JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")
              ?.nodes[0]?.color === "green",
        );
        await palette.getByRole("radio").first().focus();
        await page.keyboard.press("End");
        assert.equal(
          await last.evaluate((element) => document.activeElement === element),
          true,
          "Keyboard reaches the final color",
        );
        await page.keyboard.press("Home");
        await page.waitForFunction(
          () =>
            (JSON.parse(localStorage.getItem("graph-editor-graph") ?? "null")
              ?.nodes[0]?.color ?? "paper") === "paper",
        );
        if (width < 768) {
          const sizes = await page
            .locator(
              '[data-editor-chrome-control="true"][role="toolbar"] button',
            )
            .evaluateAll((elements) =>
              elements.map((e) => {
                const r = e.getBoundingClientRect();
                return [r.width, r.height];
              }),
            );
          assert(
            sizes.every(([w, h]) => w >= 43.9 && h >= 43.9),
            "Mobile toolbar retains 44px targets",
          );
        }
        await load.click();
        await page.locator("textarea").fill("not a graph");
        await page.waitForFunction(
          () =>
            document.querySelector(
              '[data-editor-panel="starter"] [role="alert"], [data-editor-panel="starter"] [role="status"]',
            )?.textContent?.length,
        );
        await page.waitForTimeout(350);
        await assertFits(page, '[data-editor-panel="starter"] button');
        assert.equal(await dialog.locator("button").last().isDisabled(), true);
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert.equal(
          await load.evaluate((element) => document.activeElement === element),
          true,
          "Closing returns focus to the opener",
        );
        await page.setViewportSize({ width, height: 390 });
        await load.click();
        // Reopening intentionally clears the previous input.
        await page.waitForFunction(
          () => document.querySelector("textarea")?.value === "",
        );
        await dialog.evaluate((element) =>
          Promise.allSettled(
            element.getAnimations().map((animation) => animation.finished),
          ),
        );
        await page.locator("textarea").fill("not a graph");
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              '[data-editor-panel="starter"] [role="alert"], [data-editor-panel="starter"] [role="status"]',
            ).length >= 2,
        );
        await dialog.evaluate((element) =>
          Promise.allSettled(
            element.getAnimations().map((animation) => animation.finished),
          ),
        );
        const warning = dialog
          .locator('[role="alert"], [role="status"]')
          .last();
        await warning.scrollIntoViewIfNeeded();
        const [warningBounds, inputBounds] = await Promise.all([
          warning.boundingBox(),
          page.locator("textarea").boundingBox(),
        ]);
        assert(
          warningBounds &&
            inputBounds &&
            warningBounds.y >= inputBounds.y + inputBounds.height,
          `Warnings follow the input in short windows: ${JSON.stringify({ warningBounds, inputBounds, input: await page.locator("textarea").inputValue(), warning: await warning.innerText() })}`,
        );
        await assertFits(page, '[data-editor-panel="starter"] button');
        await page
          .getByRole("button", {
            name: messages.chrome.starterUseSample,
            exact: true,
          })
          .click();
        const scroll = page.locator("[data-sample-scroll]");
        await scroll.waitFor();
        assert(
          (await scroll.boundingBox())!.height >= 100,
          "Short windows retain usable gallery space",
        );
        const firstInput = page
          .locator('[data-sample-kind="path"] input')
          .first();
        await firstInput.fill("12");
        await page.waitForFunction(() =>
          document
            .querySelector('[data-sample-kind="path"] [data-sample-stats]')
            ?.textContent?.includes("12"),
        );
        await firstInput.press("Enter");
        await dialog.waitFor({ state: "detached" });
        await page.waitForFunction(
          () =>
            document.querySelectorAll("button.ge-select-node-hitbox").length ===
            12,
        );
        console.log(
          `${locale} ${theme} ${width}: import, pointer/keyboard colors, targets, focus and short gallery passed`,
        );
        await context.close();
      }
    }
  }
  // Sweep the gaps between screenshot widths and both sides of each breakpoint.
  const sweepWidths = [
    ...new Set([
      ...Array.from({ length: 141 }, (_, i) => 320 + i * 16),
      375,
      414,
      639,
      640,
      767,
      768,
      959,
      960,
      1279,
      1280,
    ]),
  ].sort((a, b) => a - b);
  const sweepResults: { theme: string; width: number }[] = [];
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page
      .getByRole("button", { name: "cycle のサンプルを入力", exact: true })
      .click();
    await page.locator("button.ge-select-node-hitbox").first().click();
    for (const width of sweepWidths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(
        (layout) =>
          document
            .querySelector("[data-layout]")
            ?.getAttribute("data-layout") === layout,
        width < 768 ? "mobile" : width < 1280 ? "compact" : "desktop",
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await assertFits(
        page,
        ".ge-panel, [data-editor-chrome-control], [role=toolbar] button, [role=toolbar] [role=radio]",
      );
      sweepResults.push({ theme, width });
    }
    await context.close();
  }
  const output = process.env.OUTPUT_DIR ?? "/tmp/graph-editor-ui-review";
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/width-sweep.json`,
    JSON.stringify(
      { widths: sweepWidths, results: sweepResults, errors },
      null,
      2,
    ),
  );
  console.log(`Width sweep passed: ${sweepWidths.length} widths × 2 themes`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
