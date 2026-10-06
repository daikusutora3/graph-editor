/* oxlint-disable no-await-in-loop */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { sampleGraphDefinitions } from "../../features/graph-editor/samples/registry";
import { getSampleParameters } from "../../features/graph-editor/samples/sample-parameters";

const browser = await chromium.launch();
const base = process.env.BASE_URL ?? "http://127.0.0.1:3310";
const context = await browser.newContext({
  viewport: { width: 375, height: 900 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(`${base}/en`);
  await page.locator('[data-canvas-ready="true"]').waitFor();
  for (const sample of sampleGraphDefinitions) {
    await page
      .getByRole("button", { name: "Load a graph", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use a sample", exact: true })
      .click();
    const card = page.locator(`[data-sample-kind="${sample.kind}"]`);
    await card.scrollIntoViewIfNeeded();
    const parameters = getSampleParameters(sample.kind);
    // Empty and nonnumeric edits must never silently apply an unintended graph.
    if (parameters.length) {
      const input = card.locator("input").first();
      await input.fill("");
      assert(await card.locator('button[type="submit"]').isDisabled());
      await input.fill("abc");
      assert(await card.locator('button[type="submit"]').isDisabled());
      await input.fill(String(parameters[0].defaultValue));
    }
    await card.locator("[data-sample-stats]").waitFor();
    const counts = (
      await card.locator("[data-sample-stats]").innerText()
    ).match(/(\d+) nodes \/ (\d+) edges/);
    assert(counts, sample.kind);
    await card.locator('button[type="submit"]').click();
    await page
      .locator('[data-editor-panel="starter"]')
      .waitFor({ state: "detached" });
    await page.waitForFunction(
      ({ nodes, edges }) => {
        const graph = JSON.parse(
          localStorage.getItem("graph-editor-graph") ?? "null",
        );
        return graph?.nodes.length === nodes && graph?.edges.length === edges;
      },
      { nodes: Number(counts[1]), edges: Number(counts[2]) },
    );
    console.log(
      `${sample.kind}: parameter validation, create and save passed (${counts[1]} / ${counts[2]})`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(`All ${sampleGraphDefinitions.length} samples passed at 375px`);
} finally {
  await browser.close();
}
