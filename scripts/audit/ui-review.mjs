// Capture real editor states in isolated contexts; retain before/after evidence.
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages.ts";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const output = process.env.OUTPUT_DIR ?? "/tmp/graph-editor-ui-review/before";
const widths = (
  process.env.WIDTHS ??
  "320,375,414,600,639,640,767,768,959,960,1024,1279,1280,1440,1920,2560"
)
  .split(",")
  .map(Number);
const themes = (process.env.THEMES ?? "light,dark").split(",");
const locales = (process.env.LOCALES ?? "ja").split(",");
const heights = (process.env.HEIGHTS ?? "900").split(",").map(Number);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const errors = [];
try {
  for (const locale of locales)
    for (const theme of themes)
      for (const width of widths)
        for (const height of heights) {
          const context = await browser.newContext({
            viewport: { width, height },
            colorScheme: theme,
            permissions: ["clipboard-read", "clipboard-write"],
          });
          await context.addInitScript(
            (value) => localStorage.setItem("graph-editor-theme", value),
            theme,
          );
          const page = await context.newPage();
          page.setDefaultTimeout(8000);
          page.on("pageerror", (error) =>
            errors.push({ locale, theme, width, message: error.message }),
          );
          const prefix = `${locale}-${theme}-${width}x${height}`;
          const button = (name) =>
            page.getByRole("button", { name, exact: true });
          const messages = messagesByLocale[locale];
          if (!messages) throw new Error(`Unsupported locale: ${locale}`);
          const labels = {
            load: messages.chrome.openStarter,
            sample: messages.chrome.starterUseSample,
            app: messages.appMenu.open,
            shortcuts: messages.chrome.shortcuts,
            layouts: messages.chrome.layouts,
            settings: messages.chrome.settings,
            menu: messages.chrome.menu,
            export: messages.chrome.export,
            png: messages.chrome.png,
            node: messages.toolbar.modes.node.label,
            edge: messages.toolbar.modes.edge.label,
            select: messages.toolbar.modes.select.label,
          };
          const capture = async (state) => {
            await page.mouse.move(1, Math.floor(height / 2));
            await page.waitForTimeout(240);
            const geometry = await page.evaluate(() => {
              const visible = (e) =>
                e.getClientRects().length &&
                getComputedStyle(e).visibility !== "hidden";
              const rect = (e) => {
                const r = e.getBoundingClientRect();
                return {
                  x: Math.round(r.x),
                  y: Math.round(r.y),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                };
              };
              const panels = [
                ...document.querySelectorAll(
                  "[data-editor-panel],.ge-panel,[role=toolbar]",
                ),
              ].filter(visible);
              const offscreen = panels
                .filter((e) => {
                  const r = e.getBoundingClientRect();
                  return (
                    r.left < -1 ||
                    r.right > innerWidth + 1 ||
                    r.top < -1 ||
                    r.bottom > innerHeight + 1
                  );
                })
                .map((e) => ({
                  label:
                    e.getAttribute("aria-label") ?? e.textContent.slice(0, 40),
                  ...rect(e),
                }));
              const clipped = [
                ...document.querySelectorAll(
                  "[data-editor-panel], [role=toolbar]",
                ),
              ].flatMap((container) =>
                [
                  ...container.querySelectorAll(
                    "button,input,select,[role=radio],[role=tab]",
                  ),
                ]
                  .filter(visible)
                  .filter((e) => {
                    const r = e.getBoundingClientRect(),
                      d = container.getBoundingClientRect();
                    return r.left < d.left - 1 || r.right > d.right + 1;
                  })
                  .map((e) => ({
                    label:
                      e.getAttribute("aria-label") ??
                      e.textContent.slice(0, 40),
                    ...rect(e),
                  })),
              );
              return {
                layout: document.querySelector("[data-layout]")?.dataset.layout,
                offscreen,
                clipped,
                horizontalOverflow:
                  document.documentElement.scrollWidth > innerWidth,
              };
            });
            const file = `${prefix}-${state}.png`;
            await page.screenshot({
              path: `${output}/${file}`,
              animations: "disabled",
            });
            results.push({
              locale,
              theme,
              width,
              height,
              state,
              file,
              ...geometry,
            });
          };
          const close = async () => {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(200);
          };
          await page.goto(
            locale === "ja" ? base : `${base}/${locale.toLowerCase()}`,
            { waitUntil: "networkidle" },
          );
          await page.locator('[data-canvas-ready="true"]').waitFor();
          await page.addStyleTag({
            content: "nextjs-portal { display: none !important; }",
          });
          await capture("empty");
          await button(labels.load).click();
          await capture("import-empty");
          const textarea = page.locator("textarea");
          await textarea.fill("4 4\n1 2\n2 3\n2 4\n3 4");
          await page.waitForTimeout(500);
          await capture("import-valid");
          await textarea.fill("not a graph");
          await page.waitForTimeout(500);
          await capture("import-invalid");
          await textarea.fill("");
          await button(labels.sample).click();
          await page.locator("[data-sample-kind=cycle]").waitFor();
          await capture("samples");
          await page.getByRole("searchbox").fill("cycle");
          await capture("samples-search");
          await page.getByRole("searchbox").fill("zzzznomatch");
          await capture("samples-empty");
          await close();
          await button(
            messages.samples.applyAria(
              messages.samples.item.cycle?.title ?? "cycle",
            ),
          ).click();
          await page.locator("button.ge-select-node-hitbox").first().waitFor();
          await capture("graph");
          await page.locator("button.ge-select-node-hitbox").first().click();
          await capture("node-selected");
          await page
            .locator("button.ge-select-node-hitbox")
            .first()
            .press("Enter");
          await capture("node-edit");
          await close();
          await page
            .locator("button.ge-select-node-hitbox")
            .first()
            .click({ button: "right" });
          await capture("context-menu");
          await close();
          await button(labels.select).click();
          await page.keyboard.press("ControlOrMeta+a");
          await capture("multi-selected");
          await close();
          for (const [state, label] of [
            ["layouts", labels.layouts],
            ["settings", labels.settings],
            ["menu", labels.menu],
            ["export", labels.export],
            ["png", labels.png],
            ["app-menu", labels.app],
          ]) {
            if (!(await button(label).count())) continue;
            await button(label).click();
            if (state === "png")
              await page.locator("[data-editor-panel=png] img").waitFor();
            await capture(state);
            if (state === "export") {
              await page
                .locator("[data-editor-panel=export] select")
                .selectOption("json");
              await capture("export-json");
              await page
                .locator("[data-editor-panel=export] select")
                .selectOption("tikz");
              await capture("export-tikz");
            }
            if (state === "app-menu") {
              await page
                .getByRole("menuitem", { name: new RegExp(labels.shortcuts) })
                .click();
              await capture("shortcuts");
            }
            await close();
          }
          await button(labels.node).click();
          await capture("draw-node");
          await button(labels.edge).click();
          await capture("draw-edge");
          await context.close();
          console.log(`${prefix}: captured`);
          await writeFile(
            `${output}/manifest.json`,
            JSON.stringify({ base, results, errors }, null, 2),
          );
        }
} finally {
  await browser.close();
}
const findings = results.filter(
  (r) => r.offscreen.length || r.clipped.length || r.horizontalOverflow,
);
console.log(
  JSON.stringify(
    {
      screenshots: results.length,
      findings: findings.map(({ file, offscreen, clipped }) => ({
        file,
        offscreen,
        clipped,
      })),
      errors,
    },
    null,
    2,
  ),
);
if (errors.length || (process.env.FAIL_ON_FINDINGS === "1" && findings.length))
  process.exitCode = 1;
