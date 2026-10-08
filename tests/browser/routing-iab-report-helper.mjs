// Filesystem-only artifact helper. No browser access or hidden application-state reads.
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "/tmp/graph-editor-routing-comparison/iab";
const manifestPath = root + "/manifest.json";
const boundaryIds = [
  "short-label-gap-boundary-clicks",
  "long-label-gap-boundary-clicks",
];
const points = ["center", "left", "right", "top", "bottom"];
function safeId(id) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw Error("Invalid artifact ID");
  return id;
}
function phasePath(phase) {
  if (!["before", "after"].includes(phase)) throw Error("Invalid phase");
  return root + "/" + phase;
}
function asJPEG(data) {
  const b = Buffer.from(data);
  if (b[0] !== 255 || b[1] !== 216 || b[2] !== 255)
    throw Error("Native image must be JPEG");
  return b;
}
async function readJSON(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export async function loadManifest() {
  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}
export async function getScene(id) {
  const m = await loadManifest();
  const scene = m.scenes.find((candidate) => candidate.id === id);
  if (!scene) throw Error("Unknown frozen scene");
  return scene;
}
export async function createReport(phase = "before") {
  const m = await loadManifest();
  const bytes = await fs.readFile(manifestPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const declared = await readJSON(root + "/manifest-digest.json", {});
  const dir = phasePath(phase);
  await fs.mkdir(dir, { recursive: true });
  const prior = await readJSON(dir + "/capture-report.json", null);
  if (prior && prior.manifestFileDigest !== digest)
    throw Error("Frozen IAB manifest changed during capture");
  if (phase === "after") {
    const before = await readJSON(root + "/before/capture-report.json", null);
    if (
      !before ||
      before.status !== "complete" ||
      before.capturedCount !== 49 ||
      before.boundaryScreenshotCount !== 10
    )
      throw Error("All 59 Before images must finish first");
    if (before.manifestFileDigest !== digest)
      throw Error("After must replay identical IAB conditions");
  }
  const report = prior || {
    status: "running",
    phase,
    browser: m.browser,
    viewport: m.viewport,
    manifestDigest: declared.manifestDigest,
    manifestFileDigest: digest,
    baselineCommit: m.baselineCommit,
    sceneCount: 49,
    capturedCount: 0,
    boundaryScreenshotCount: 0,
    results: [],
    limits: [
      "Expert review, no real participant",
      "IAB DOM facade has no visibility/focus/rAF API; use ready attribute, actual HTML hitboxes, DOM snapshots and visual review",
      "No Cytoscape/localStorage mutation through evaluate",
      "Actual sample application is replayed for After; sample coordinates may intentionally change",
    ],
  };
  await fs.writeFile(dir + "/manifest.json", bytes);
  await fs.writeFile(
    dir + "/capture-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
async function persist(phase, report) {
  report.results.sort((a, b) => a.sceneIndex - b.sceneIndex);
  report.capturedCount = report.results.filter(
    (r) => r.status === "captured",
  ).length;
  report.boundaryScreenshotCount = report.results.reduce(
    (n, r) =>
      n +
      (r.boundaryClicks || []).filter((b) => b.status === "captured").length,
    0,
  );
  report.status =
    report.capturedCount === 49
      ? report.boundaryScreenshotCount === 10
        ? "complete"
        : "primary_complete"
      : "running";
  await fs.writeFile(
    phasePath(phase) + "/capture-report.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
// Pass native JPEG bytes and only DOM-derived state. UI snapshot text can be saved
// separately as strings, so the gallery stays compact. This method merges entries.
export async function saveScene({
  id,
  jpeg,
  dom,
  phase = "before",
  actions = [],
  domSnapshot = "",
  assessment = "pending visual review",
  exportText = null,
  validatedDOM = false,
}) {
  const m = await loadManifest();
  const scene = await getScene(id);
  const sceneIndex = m.scenes.findIndex((s) => s.id === id);
  const report = await createReport(phase);
  if (!validatedDOM)
    throw Error(
      "Caller must verify actual ready graph/sample card and DOM counts before accepting photo",
    );
  const dir = phasePath(phase);
  const filename = safeId(id) + ".jpg";
  await fs.writeFile(dir + "/" + filename, asJPEG(jpeg));
  const existing = report.results.find((r) => r.id === id);
  const result = {
    id,
    title: scene.title,
    sceneIndex,
    phase,
    status: "captured",
    screenshot: filename,
    observations: scene.observations,
    conditions: scene,
    expectedCounts: scene.expectedCounts,
    snapshot: dom,
    actualActions: actions,
    rasterAssessment: assessment,
    ...(existing?.boundaryClicks
      ? { boundaryClicks: existing.boundaryClicks }
      : {}),
  };
  if (domSnapshot) await fs.writeFile(dir + "/" + id + "-dom.txt", domSnapshot);
  if (exportText !== null) {
    JSON.parse(exportText);
    await fs.writeFile(dir + "/" + id + "-graph.json", exportText);
    result.graphExport = id + "-graph.json";
  }
  const index = report.results.findIndex((r) => r.id === id);
  if (index >= 0) report.results[index] = result;
  else report.results.push(result);
  await fs.writeFile(
    dir + "/" + id + ".json",
    JSON.stringify(result, null, 2) + "\n",
  );
  await persist(phase, report);
  return {
    path: dir + "/" + filename,
    capturedCount: report.capturedCount,
    status: report.status,
  };
}
export async function saveBoundary({
  id,
  point,
  jpeg,
  dom,
  phase = "before",
  x,
  y,
  state = {},
  assessment = "pending visual review",
}) {
  if (!boundaryIds.includes(id) || !points.includes(point))
    throw Error("Unknown frozen boundary scene/point");
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw Error(
      "Record the actual pointer coordinates for every boundary photo",
    );
  if (phase === "after") {
    const before = await readJSON(root + "/before/capture-report.json", null);
    const original = before?.results
      .find((r) => r.id === id)
      ?.boundaryClicks?.find((p) => p.point === point);
    if (
      !original ||
      Math.abs(original.x - x) > 0.1 ||
      Math.abs(original.y - y) > 0.1
    )
      throw Error(
        "After boundary clicks must reuse the exact Before pixel targets",
      );
  }
  const report = await createReport(phase);
  const result = report.results.find((r) => r.id === id);
  if (!result) throw Error("Capture primary scene first");
  const filename = id + "-boundary-" + point + ".jpg";
  await fs.writeFile(phasePath(phase) + "/" + filename, asJPEG(jpeg));
  const row = {
    point,
    x,
    y,
    status: "captured",
    screenshot: filename,
    state,
    snapshot: dom,
    rasterAssessment: assessment,
  };
  result.boundaryClicks ??= [];
  const i = result.boundaryClicks.findIndex((p) => p.point === point);
  if (i >= 0) result.boundaryClicks[i] = row;
  else result.boundaryClicks.push(row);
  await fs.writeFile(
    phasePath(phase) + "/" + id + ".json",
    JSON.stringify(result, null, 2) + "\n",
  );
  await persist(phase, report);
  return {
    path: phasePath(phase) + "/" + filename,
    boundaryScreenshotCount: report.boundaryScreenshotCount,
    status: report.status,
  };
}
export async function recordUnavailable({
  id,
  phase = "before",
  error,
  dom = {},
  jpeg = null,
  domSnapshot = "",
}) {
  const m = await loadManifest();
  const scene = await getScene(id);
  const report = await createReport(phase);
  const row = {
    id,
    title: scene.title,
    sceneIndex: m.scenes.findIndex((s) => s.id === id),
    phase,
    status: "unavailable",
    error: String(error),
    conditions: scene,
    observations: scene.observations,
    snapshot: dom,
  };
  if (jpeg) {
    row.screenshot = id + "-unavailable.jpg";
    await fs.writeFile(phasePath(phase) + "/" + row.screenshot, asJPEG(jpeg));
  }
  if (domSnapshot)
    await fs.writeFile(
      phasePath(phase) + "/" + id + "-unavailable-dom.txt",
      domSnapshot,
    );
  const i = report.results.findIndex((r) => r.id === id);
  if (i >= 0) report.results[i] = row;
  else report.results.push(row);
  await fs.writeFile(
    phasePath(phase) + "/" + id + ".json",
    JSON.stringify(row, null, 2) + "\n",
  );
  return persist(phase, report);
}
export async function missingScenes(phase = "before") {
  const m = await loadManifest();
  const report = await readJSON(phasePath(phase) + "/capture-report.json", {
    results: [],
  });
  return m.scenes.filter(
    (scene) =>
      !report.results.some(
        (result) => result.id === scene.id && result.status === "captured",
      ),
  );
}
export async function missingBoundaries(phase = "before") {
  const report = await readJSON(phasePath(phase) + "/capture-report.json", {
    results: [],
  });
  return boundaryIds.flatMap((id) =>
    points
      .filter(
        (point) =>
          !report.results.some(
            (result) =>
              result.id === id &&
              (result.boundaryClicks || []).some(
                (boundary) =>
                  boundary.point === point && boundary.status === "captured",
              ),
          ),
      )
      .map((point) => ({ id, point })),
  );
}
