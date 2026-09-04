// Loads the served export and fails on any CSP violation or page error.
// Usage: bun scripts/audit/serve-out.mjs & bun scripts/audit/csp-check.mjs
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
page.on("console", (m) => {
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
await page.getByRole("button", { name: /Cycle/ }).first().click();
await page.waitForTimeout(1000);
console.log(
  "nodes rendered:",
  await page.locator("button[aria-label$='を選択']").count(),
);
await page.getByRole("button", { name: "PNG 画像" }).click();
await page.waitForTimeout(2000);
console.log("png preview:", await page.locator("img").count());
await page.keyboard.press("Escape");
console.log(
  "violations on /:",
  JSON.stringify(await page.evaluate(() => window.cspViolations)),
);
await page.goto(`${BASE_URL}/en`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log("en title:", await page.title());
console.log("console errors:", errors.length ? errors : "none");
console.log(
  "violations:",
  JSON.stringify(await page.evaluate(() => window.cspViolations)),
);
await browser.close();
if (errors.length > 0) {
  process.exit(1);
}
