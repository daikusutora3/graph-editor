import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Compare the selection helper and the real command atom, in same-form bundles.
// Default compares only editor-selection.ts. --all-command-changes also restores
// reference graph-json.ts, measuring the final serializer and pruning together.
// --mixed-color compares one original two-command palette choice with the
// production atomic palette action; use with --all-command-changes.
const revision = argument("--reference-revision");
const outputDirectory = argument("--output-directory");
if (!revision || !outputDirectory)
  throw new Error(
    "Pass --reference-revision <commit> --output-directory <path>",
  );
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const directory = resolve(outputDirectory);
const source = "features/graph-editor/shell/state/editor-selection.ts";
const allCommandChanges = process.argv.includes("--all-command-changes");
const mixedColor = process.argv.includes("--mixed-color");
if (mixedColor && !allCommandChanges)
  throw new Error("--mixed-color requires --all-command-changes");
const sources = allCommandChanges
  ? [source, "features/graph-editor/core/graph/graph-json.ts"]
  : [source];
const referenceRevision = execFileSync("git", ["rev-parse", revision], {
  cwd: root,
  encoding: "utf8",
}).trim();
const referenceSources = new Map(
  sources.map((modulePath) => [
    resolve(root, modulePath),
    execFileSync("git", ["show", `${referenceRevision}:${modulePath}`], {
      cwd: root,
      encoding: "utf8",
    }),
  ]),
);
const referenceSource = referenceSources.get(resolve(root, source));
mkdirSync(directory, { recursive: true });
const entry = resolve(directory, "entry.ts");
const path = (relative) => JSON.stringify(resolve(root, relative));
writeFileSync(
  entry,
  `import { createStore } from ${JSON.stringify(require.resolve("jotai/vanilla"))};
import { createEmptyGraphModel } from ${path("features/graph-editor/core/graph/graph-factory.ts")};
import { updateNodeCommand, setNodesColorCommand, setEdgesColorCommand, setSelectionColorsCommand } from ${path("features/graph-editor/core/graph/graph-intents.ts")};
import { pickSelectionColor } from ${path("features/graph-editor/canvas/selection-color-actions.ts")};
import { selectionAtom } from ${path("features/graph-editor/shell/state/editor-atoms.ts")};
import { graphAtom, graphRevisionAtom, syncExternalGraphAtom } from ${path("features/graph-editor/shell/state/graph-atoms.ts")};
import { executeCommandAtom, historyAtom, futureAtom, undoAtom, redoAtom } from ${path("features/graph-editor/shell/state/history-atoms.ts")};
export { pruneSelectionForGraph } from ${path(source)};
export { createEmptyGraphModel };
export function createRun(graph, selection) {
  const store = createStore();
  store.set(syncExternalGraphAtom, graph);
  store.set(selectionAtom, selection);
  return {
    execute: () => store.set(executeCommandAtom, updateNodeCommand("n0", {x: 17})),
    inspect: () => ({graph:store.get(graphAtom),selection:store.get(selectionAtom),history:store.get(historyAtom),future:store.get(futureAtom),revision:store.get(graphRevisionAtom),sameSelection:store.get(selectionAtom)===selection}),
  };
}
${
  mixedColor
    ? `export function createPaletteRun(graph, selection, originalDispatch) {
  const store = createStore();
  store.set(syncExternalGraphAtom, graph);
  store.set(selectionAtom, selection);
  const execute = (command) => store.set(executeCommandAtom, command);
  const actions = {
    onSetNodeColor: (nodeIds, color) => execute(setNodesColorCommand(nodeIds, color)),
    onSetEdgeColor: (edgeIds, color) => execute(setEdgesColorCommand(edgeIds, color)),
    onSetSelectionColors: (selection, color) => execute(setSelectionColorsCommand({nodeIds:selection.nodeIds,edgeIds:selection.edgeIds,nodeColor:color,edgeColor:color})),
  };
  return {
    execute: () => {
      if (originalDispatch) {
        actions.onSetNodeColor(selection.nodeIds, "green");
        actions.onSetEdgeColor(selection.edgeIds, "green");
      } else pickSelectionColor(selection, "mixed", "green", actions);
    },
    inspect: () => ({graph:store.get(graphAtom),selection:store.get(selectionAtom),history:store.get(historyAtom),future:store.get(futureAtom),revision:store.get(graphRevisionAtom),sameSelection:store.get(selectionAtom)===selection}),
    undo: () => store.set(undoAtom),
    redo: () => store.set(redoAtom),
  };
}`
    : ""
}
`,
);
const factories = await Promise.all(
  ["reference", "current"].map(async (variant) => {
    const result = await globalThis.Bun.build({
      entrypoints: [entry],
      target: "bun",
      outdir: resolve(directory, variant),
      naming: "selection.mjs",
      plugins: [
        {
          name: "selection-pruning-reference",
          setup(build) {
            if (variant === "reference")
              build.onLoad(
                {
                  filter: /(?:state\/editor-selection|graph\/graph-json)\.ts$/,
                },
                ({ path: modulePath }) => {
                  const contents = referenceSources.get(modulePath);
                  return contents === undefined
                    ? undefined
                    : { contents, loader: "ts" };
                },
              );
          },
        },
      ],
    });
    if (!result.success) throw new Error(JSON.stringify(result.logs));
    return import(
      pathToFileURL(resolve(directory, variant, "selection.mjs")).href
    );
  }),
);
const [, current] = factories;
const results = [];
const passes = 35,
  warmups = 10,
  repetitions = 32;
for (const [size, nodeCount, edgeCount] of [
  ["small", 20, 30],
  ["limits", 1000, 5000],
]) {
  const graph = {
    ...current.createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, order) => ({
      id: `n${order}`,
      label: `${order}`,
      order,
      x: 100 * order,
      y: 0,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
    })),
  };
  const original = JSON.stringify(graph);
  const selections = [
    ["empty", { nodeIds: [], edgeIds: [] }],
    ["node only", { nodeIds: ["n0"], edgeIds: [] }],
    ["edge only", { nodeIds: [], edgeIds: ["e0"] }],
    [
      "mixed invalid",
      { nodeIds: ["n0", "missing"], edgeIds: ["e0", "missing"] },
    ],
    [
      "all",
      {
        nodeIds: graph.nodes.map((n) => n.id),
        edgeIds: graph.edges.map((e) => e.id),
      },
    ],
  ];
  for (const [selectionName, selection] of mixedColor
    ? selections.slice(-1)
    : selections) {
    const paletteWork = mixedColor
      ? verifyMixedPalette(factories, graph, selection)
      : undefined;
    for (const operation of mixedColor
      ? ["mixedPalette"]
      : ["prune", "executeCommand"]) {
      const before = [],
        after = [];
      let signature;
      for (let pass = 0; pass < passes; pass++) {
        const samples = [];
        for (const variant of pass % 2 ? [1, 0] : [0, 1]) {
          const factory = factories[variant];
          const run =
            operation === "mixedPalette"
              ? factory.createPaletteRun(graph, selection, variant === 0)
              : operation === "executeCommand"
                ? factory.createRun(graph, selection)
                : null;
          let value;
          const started = performance.now();
          if (run) value = run.execute();
          else
            for (let index = 0; index < repetitions; index++)
              value = factory.pruneSelectionForGraph(selection, graph);
          const elapsed =
            (performance.now() - started) / (run ? 1 : repetitions);
          const inspected = run?.inspect();
          if (mixedColor)
            assert.equal(inspected.history.length, variant === 0 ? 2 : 1);
          const sample = JSON.stringify(
            mixedColor
              ? {
                  graph: inspected.graph,
                  selection: inspected.selection,
                  sameSelection: inspected.sameSelection,
                }
              : run
                ? { value, ...inspected }
                : { value, sameSelection: value === selection },
          );
          samples.push(sample);
          signature = sha256(sample);
          if (pass >= warmups) (variant === 0 ? before : after).push(elapsed);
        }
        assert.equal(
          samples[0],
          samples[1],
          "complete output and selection identity",
        );
      }
      results.push({
        size,
        selection: selectionName,
        operation,
        baselineMedianMs: median(before),
        candidateMedianMs: median(after),
        speedup: median(before) / median(after),
        signature,
        ...(paletteWork ? { paletteWork } : {}),
      });
    }
  }
  assert.equal(
    JSON.stringify(graph),
    original,
    "source graph remains unchanged",
  );
}
const report = {
  environment: `Bun ${process.versions.bun}; CPU only, excludes browser storage/paint`,
  referenceRevision,
  source,
  referenceSha256: sha256(referenceSource),
  currentSha256: sha256(readFileSync(resolve(root, source))),
  modules: sources.map((modulePath) => ({
    source: modulePath,
    referenceSha256: sha256(referenceSources.get(resolve(root, modulePath))),
    currentSha256: sha256(readFileSync(resolve(root, modulePath))),
  })),
  mode: mixedColor
    ? "mixed-color"
    : allCommandChanges
      ? "all-command-changes"
      : "isolated-pruning",
  ...(mixedColor
    ? {
        paletteAction: {
          reference: "setNodesColor then setEdgesColor",
          current: "production pickSelectionColor with setSelectionColors",
        },
      }
    : {}),
  bundles: ["reference", "current"].map((variant) => ({
    variant,
    sha256: sha256(readFileSync(resolve(directory, variant, "selection.mjs"))),
  })),
  preparation:
    "Same-form bundles built from current source; only the listed reference modules come from the recorded revision. Store initialization and exact-output validation are outside the timed command operation.",
  passes,
  warmups,
  repetitions: mixedColor ? 1 : repetitions,
  results,
};
writeFileSync(
  resolve(directory, "result.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function median(values) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
}

function verifyMixedPalette(variants, graph, selection) {
  const input = JSON.stringify({ graph, selection });
  const outputs = [];
  const work = [];
  for (const [variant, factory] of variants.entries()) {
    const run = factory.createPaletteRun(graph, selection, variant === 0);
    const steps = variant === 0 ? 2 : 1;
    const serializations = countGraphSerializations(run.execute);
    const applied = run.inspect();
    assert.equal(serializations, steps);
    assert.equal(applied.history.length, steps);
    assert.equal(applied.future.length, 0);
    assert.equal(applied.revision, 1 + steps);
    assert.equal(applied.sameSelection, true);
    assert.deepEqual(applied.selection, selection);
    assert.deepEqual(applied.graph, {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, color: "green" })),
      edges: graph.edges.map((edge) => ({ ...edge, color: "green" })),
    });
    for (let step = 0; step < steps; step++) run.undo();
    const undone = run.inspect();
    assert.deepEqual(undone.graph, graph, "full Undo restores the input graph");
    assert.deepEqual(undone.selection, selection);
    assert.equal(undone.history.length, 0);
    assert.equal(undone.future.length, steps);
    assert.equal(undone.revision, 1);
    for (let step = 0; step < steps; step++) run.redo();
    const redone = run.inspect();
    assert.deepEqual(
      redone.graph,
      applied.graph,
      "full Redo restores palette result",
    );
    assert.deepEqual(redone.selection, selection);
    assert.equal(redone.history.length, steps);
    assert.equal(redone.future.length, 0);
    assert.equal(redone.revision, 1 + steps);
    outputs.push(
      JSON.stringify({
        applied: applied.graph,
        undone: undone.graph,
        redone: redone.graph,
        selection: applied.selection,
      }),
    );
    work.push({
      variant: variant === 0 ? "reference" : "current",
      serializations,
      historyEntries: steps,
      undoSteps: steps,
      redoSteps: steps,
    });
  }
  assert.equal(
    outputs[0],
    outputs[1],
    "palette result and full Undo/Redo are equivalent",
  );
  assert.equal(
    JSON.stringify({ graph, selection }),
    input,
    "palette leaves input graph/selection unchanged",
  );
  return work;
}

function countGraphSerializations(run) {
  const original = JSON.stringify;
  let count = 0;
  JSON.stringify = (value, ...options) => {
    if (
      value &&
      typeof value === "object" &&
      "nodes" in value &&
      "edges" in value &&
      "settings" in value
    )
      count++;
    return Reflect.apply(original, JSON, [value, ...options]);
  };
  try {
    run();
    return count;
  } finally {
    JSON.stringify = original;
  }
}
