import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
const base = process.env.BASE_URL ?? "http://127.0.0.1:3323";
try {
  await page.goto(base);
  await page.locator('[data-canvas-ready="true"]').waitFor();
  // Hold only the delayed panel focus, so the user can type before it runs.
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    const callbacks: Array<() => void> = [];
    Object.assign(window, {
      releasePanelFocus: () =>
        callbacks.splice(0).forEach((callback) => callback()),
    });
    window.setTimeout = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (delay === 30 && typeof callback === "function") {
        callbacks.push(() => callback(...args));
        return original(() => {}, 0);
      }
      return original(callback, delay, ...args);
    }) as typeof window.setTimeout;
  });
  const load = page.getByRole("button", {
    name: "グラフを読み込む",
    exact: true,
  });
  const input = page.locator("textarea");
  await load.click();
  await input.fill("4 4\n1 2\n2 3\n2 4\n3 4");
  await page.evaluate(() =>
    (
      window as unknown as { releasePanelFocus: () => void }
    ).releasePanelFocus(),
  );
  assert(
    await input.evaluate((element) => document.activeElement === element),
    "Initial focus must not interrupt an already focused input",
  );
  assert.equal(await input.inputValue(), "4 4\n1 2\n2 3\n2 4\n3 4");
  await page.keyboard.press("Escape");
  await page
    .locator('[data-editor-panel="starter"]')
    .waitFor({ state: "detached" });
  assert(
    await load.evaluate((element) => document.activeElement === element),
    "Closing restores the opener",
  );
  await load.focus();
  await page.keyboard.press("Enter");
  await input.waitFor();
  await page.evaluate(() =>
    (
      window as unknown as { releasePanelFocus: () => void }
    ).releasePanelFocus(),
  );
  assert(
    await page
      .locator('[data-editor-panel="starter"]')
      .evaluate((element) => element.contains(document.activeElement)),
    "Opening by keyboard still moves focus into the panel",
  );
  console.log(
    "Panel focus: immediate typing, Escape restoration and keyboard entry passed",
  );
} finally {
  await browser.close();
}
