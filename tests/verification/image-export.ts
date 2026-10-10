import cytoscape, { type Core } from "cytoscape";
import { createGraphImageExporter } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-image-export";
import type { SelectionState } from "../../features/graph-editor/core/view/types";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Image export ownership");
const frames: FrameRequestCallback[] = [];
Object.assign(globalThis, {
  document: { fonts: { ready: Promise.resolve() } },
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    frames.push(callback),
});
const detail = {
  scope: "full",
  background: "white",
  includeSelection: false,
} as const;

function fixture() {
  const cy = cytoscape({
    headless: true,
    elements: [{ data: { id: "a" } }, { data: { id: "b" } }],
  });
  cy.getElementById("a").select().addClass("edge-source");
  const cyRef: { current: Core | null } = { current: cy };
  const selectionRef: { current: SelectionState } = {
    current: { nodeIds: ["a"], edgeIds: [] },
  };
  const suppressSelectionSyncRef = { current: false };
  const edgeSourceNodeIdRef: { current: string | null } = { current: "a" };
  const renders: { selected: string[]; source: string[] }[] = [];
  const completions: {
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  }[] = [];
  cy.png = (() => {
    renders.push({
      selected: cy.elements(":selected").map((el) => el.id()),
      source: cy.nodes(".edge-source").map((el) => el.id()),
    });
    return new Promise<Blob>((resolve, reject) =>
      completions.push({ resolve, reject }),
    );
  }) as Core["png"];
  return {
    cy,
    cyRef,
    selectionRef,
    suppressSelectionSyncRef,
    edgeSourceNodeIdRef,
    renders,
    completions,
    exportPng: createGraphImageExporter({
      cyRef,
      selectionRef,
      suppressSelectionSyncRef,
      edgeSourceNodeIdRef,
    }),
  };
}

async function microtasks() {
  // Let successive queue continuations run; parallel promises drain one turn.
  // eslint-disable-next-line no-await-in-loop
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function paint() {
  await microtasks();
  const frame = frames.shift();
  if (!frame) throw new Error("Export did not request a frame");
  frame(0);
  await microtasks();
}

// Preview/copy/save may arrive together, with different selection policies.
{
  const f = fixture();
  try {
    const first = f.exportPng(detail);
    await paint();
    const second = f.exportPng(detail);
    const third = f.exportPng({ ...detail, includeSelection: true });
    await microtasks();
    expect(
      f.renders.length === 1 && frames.length === 0,
      "only one renderer mutation/encoding is in flight",
    );
    expect(
      f.suppressSelectionSyncRef.current,
      "selection stays suppressed until encoding completes",
    );
    f.completions.shift()!.resolve(new Blob(["preview"]));
    await first;
    await paint();
    expect(
      f.suppressSelectionSyncRef.current &&
        f.renders[1]!.selected.length === 0 &&
        f.renders[1]!.source.length === 0,
      "the second export excludes selection and draft-source paint after the first restores them",
    );
    f.completions.shift()!.resolve(new Blob(["copy"]));
    await second;
    await paint();
    expect(
      f.renders[2]!.selected.join() === "a",
      "a queued include-selection request retains its own settings",
    );
    f.completions.shift()!.resolve(new Blob(["save"]));
    expect(
      (await (await third).text()) === "save",
      "each request receives its own encoded blob",
    );
    expect(
      !f.suppressSelectionSyncRef.current &&
        f.cy.getElementById("a").selected(),
      "the final export restores selection and releases suppression",
    );
  } finally {
    f.cy.destroy();
  }
}
{
  const f = fixture();
  try {
    const first = f.exportPng(detail).then(
      () => false,
      () => true,
    );
    await paint();
    const second = f.exportPng(detail);
    f.completions.shift()!.reject(new Error("injected PNG failure"));
    expect(await first, "PNG failures reject the original request");
    await paint();
    expect(
      f.renders[1]!.selected.length === 0,
      "a failed request does not poison the export queue",
    );
    f.selectionRef.current = { nodeIds: ["b"], edgeIds: [] };
    f.edgeSourceNodeIdRef.current = null;
    f.completions.shift()!.resolve(new Blob(["next"]));
    await second;
    expect(
      f.cy.getElementById("b").selected() &&
        !f.cy.getElementById("a").selected() &&
        f.cy.nodes(".edge-source").length === 0,
      "restoration preserves selection changes and canceled draft sources during encoding",
    );
    expect(
      !f.suppressSelectionSyncRef.current,
      "failure and recovery leave no suppression owner behind",
    );
  } finally {
    f.cy.destroy();
  }
}
{
  const f = fixture();
  const first = f.exportPng(detail);
  await paint();
  const queued = f.exportPng(detail).then(
    () => false,
    () => true,
  );
  f.cy.destroy();
  f.cyRef.current = null;
  f.completions.shift()!.resolve(new Blob(["old"]));
  await first;
  expect(await queued, "queued work rejects after its canvas is destroyed");
  expect(
    f.renders.length === 1 && !f.suppressSelectionSyncRef.current,
    "unmount does not render a replacement canvas or retain suppression",
  );
}

await verifyPrePaintChanges(false);
await verifyPrePaintChanges(true);

// A Core replacement while awaiting a frame belongs to a different renderer.
{
  const f = fixture();
  const replacement = cytoscape({
    headless: true,
    elements: [{ data: { id: "a" } }, { data: { id: "b" } }],
  });
  replacement.getElementById("b").select().addClass("edge-source");
  let replacementRenders = 0;
  replacement.png = (() => {
    replacementRenders++;
    return Promise.resolve(new Blob(["replacement"]));
  }) as Core["png"];
  try {
    const pending = f.exportPng(detail).then(
      () => false,
      () => true,
    );
    await microtasks();
    expect(
      frames.length === 1 && f.suppressSelectionSyncRef.current,
      "the active export owns suppression while waiting for its frame",
    );
    f.cyRef.current = replacement;
    await paint();
    expect(
      (await pending) &&
        f.renders.length === 0 &&
        replacementRenders === 0 &&
        !f.suppressSelectionSyncRef.current,
      "a replaced Core rejects active work before PNG rendering and releases suppression",
    );
    expect(
      replacement.getElementById("b").selected() &&
        replacement
          .nodes(".edge-source")
          .map((node) => node.id())
          .join() === "b",
      "an old request does not restore selection or draft paint onto the replacement Core",
    );
  } finally {
    f.cy.destroy();
    replacement.destroy();
  }
}

// Renderer restoration can fail independently of the PNG encoding operation.
{
  const f = fixture();
  const originalStartBatch = f.cy.startBatch.bind(f.cy);
  try {
    const pending = f.exportPng(detail).then(
      () => false,
      () => true,
    );
    await paint();
    let failRestoration = true;
    f.cy.startBatch = (() => {
      if (failRestoration) {
        failRestoration = false;
        throw new Error("injected restoration failure");
      }
      return originalStartBatch();
    }) as Core["startBatch"];
    f.completions.shift()!.resolve(new Blob(["encoded"]));
    expect(
      (await pending) && !f.suppressSelectionSyncRef.current,
      "a restoration exception still releases suppression in the outer finally",
    );
    f.selectionRef.current = { nodeIds: ["b"], edgeIds: [] };
    const recovered = f.exportPng({ ...detail, includeSelection: true });
    await paint();
    expect(
      f.renders[1]!.selected.join() === "b",
      "a restoration exception does not poison later exports or their current selection",
    );
    f.completions.shift()!.resolve(new Blob(["recovered"]));
    await recovered;
    expect(
      !f.suppressSelectionSyncRef.current,
      "recovery after a restoration exception leaves suppression released",
    );
  } finally {
    f.cy.startBatch = originalStartBatch;
    f.cy.destroy();
  }
}
finish();

async function verifyPrePaintChanges(includeSelection: boolean) {
  const f = fixture();
  const originalFontsReady = document.fonts.ready;
  let finishFonts: (() => void) | undefined;
  Object.defineProperty(document.fonts, "ready", {
    configurable: true,
    value: new Promise<void>((resolve) => {
      finishFonts = resolve;
    }),
  });
  try {
    const pending = f.exportPng({ ...detail, includeSelection });
    await microtasks();
    expect(
      f.renders.length === 0 &&
        frames.length === 0 &&
        f.suppressSelectionSyncRef.current,
      "fonts must finish before an export requests its paint frame",
    );
    f.selectionRef.current = { nodeIds: ["b"], edgeIds: [] };
    f.edgeSourceNodeIdRef.current = "b";
    f.cy.nodes(".edge-source").removeClass("edge-source");
    f.cy.getElementById("b").addClass("edge-source");
    // Native input and the mode effect may change renderer paint while the
    // ordinary React selection effect is suppressed by this export owner.
    f.cy.getElementById("a").select();
    finishFonts!();
    await microtasks();
    f.edgeSourceNodeIdRef.current = "a";
    f.cy.nodes(".edge-source").removeClass("edge-source");
    f.cy.getElementById("a").addClass("edge-source");
    await paint();
    expect(
      f.renders[0]!.selected.join() === (includeSelection ? "b" : "") &&
        f.renders[0]!.source.join() === (includeSelection ? "a" : ""),
      `${includeSelection ? "included" : "excluded"} selection and draft policy is reapplied immediately before PNG capture`,
    );
    f.completions.shift()!.resolve(new Blob(["latest"]));
    await pending;
    expect(
      f.cy.getElementById("b").selected() &&
        !f.cy.getElementById("a").selected() &&
        f.cy
          .nodes(".edge-source")
          .map((node) => node.id())
          .join() === "a" &&
        !f.suppressSelectionSyncRef.current,
      "restoration uses the latest selection and draft after font/frame changes",
    );
  } finally {
    finishFonts?.();
    Object.defineProperty(document.fonts, "ready", {
      configurable: true,
      value: originalFontsReady,
    });
    f.cy.destroy();
  }
}
