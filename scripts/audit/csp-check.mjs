// Loads the served export and fails on any CSP violation or page error.
// Usage: bun scripts/audit/serve-out.mjs & bun scripts/audit/csp-check.mjs
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const browser = await chromium.launch();
const page = await (
  await browser.newContext({
    viewport: { width: 1000, height: 700 },
    locale: "ja-JP",
  })
).newPage();
const errors = [];
const violations = [];
async function collectViolations(route) {
  const routeViolations = await page.evaluate(() => window.cspViolations);
  console.log(`violations on ${route}:`, JSON.stringify(routeViolations));
  violations.push(
    ...routeViolations.map((violation) => ({ route, ...violation })),
  );
}
let expectNotFound = false;
page.on("console", (m) => {
  if (expectNotFound && /status of 404/.test(m.text())) return;
  if (m.type() === "error") errors.push(m.text().slice(0, 600));
});
await page.addInitScript(() => {
  window.cspViolations = [];
  document.addEventListener("securitypolicyviolation", (e) =>
    window.cspViolations.push({
      directive: e.violatedDirective,
      uri: e.blockedURI,
      sample: e.sample,
      line: e.lineNumber,
      source: e.sourceFile,
    }),
  );
});
page.on("pageerror", (e) =>
  errors.push("pageerror: " + e.message.slice(0, 160)),
);
await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /cycle/i }).first().click();
await page.locator("button.ge-select-node-hitbox").first().waitFor();
await page.waitForTimeout(1000);
console.log(
  "nodes rendered:",
  await page.locator("button[aria-label$='を選択']").count(),
);
await page.getByRole("button", { name: "PNG 画像" }).click();
await page.waitForTimeout(2000);
const preview = page.locator('img[src^="blob:"]').first();
await preview.waitFor();
assert.equal(
  await preview.evaluate((image) => image.complete && image.naturalWidth > 0),
  true,
  "PNG preview should load the exported image",
);
console.log("png preview: loaded");
await page.keyboard.press("Escape");
await collectViolations("/");
for (const route of [
  "/en",
  "/zh-hans",
  "/guide",
  "/en/guide",
  "/zh-hans/guide",
  "/missing-page",
]) {
  expectNotFound = route === "/missing-page";
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  console.log(`${route} title:`, await page.title());
  await collectViolations(route);
}
console.log("console errors:", errors.length ? errors : "none");
console.log("violations:", JSON.stringify(violations));
await browser.close();
if (errors.length > 0 || violations.length > 0) {
  process.exit(1);
}
