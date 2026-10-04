import {
  createConfiguredSampleGraph,
  getSampleParameters,
  normalizeSampleParameters,
  type SampleParameterValues,
} from "../../features/graph-editor/samples/sample-parameters";
import {
  sampleGraphKinds,
  type SampleGraphKind,
} from "../../features/graph-editor/samples/sample-graphs";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Sample parameters");

const examples: Array<{
  kind: SampleGraphKind;
  values: SampleParameterValues;
  nodes: number;
  edges: number;
}> = [
  { kind: "path", values: { nodes: 11 }, nodes: 11, edges: 10 },
  { kind: "cycle", values: { nodes: 9 }, nodes: 9, edges: 9 },
  { kind: "edgeless", values: { nodes: 11 }, nodes: 11, edges: 0 },
  { kind: "complete", values: { nodes: 7 }, nodes: 7, edges: 21 },
  { kind: "star", values: { nodes: 8 }, nodes: 8, edges: 7 },
  { kind: "tree", values: { nodes: 15 }, nodes: 15, edges: 14 },
  { kind: "grid", values: { rows: 3, columns: 5 }, nodes: 15, edges: 22 },
  { kind: "bipartite", values: { left: 2, right: 5 }, nodes: 7, edges: 10 },
  { kind: "crown", values: { nodes: 12 }, nodes: 12, edges: 30 },
  {
    kind: "knight",
    values: { rows: 5, columns: 5, moveX: 1, moveY: 2 },
    nodes: 25,
    edges: 48,
  },
  { kind: "ladder", values: { rungs: 6 }, nodes: 12, edges: 16 },
  { kind: "wheel", values: { rim: 8 }, nodes: 9, edges: 16 },
  { kind: "fan", values: { path: 8 }, nodes: 9, edges: 15 },
  { kind: "friendship", values: { triangles: 5 }, nodes: 11, edges: 15 },
  { kind: "caterpillar", values: { spine: 7 }, nodes: 21, edges: 20 },
  { kind: "hypercube", values: { dimension: 5 }, nodes: 32, edges: 80 },
  { kind: "turan", values: { nodes: 11, parts: 3 }, nodes: 11, edges: 40 },
  {
    kind: "generalizedPetersen",
    values: { outerNodes: 9, step: 4 },
    nodes: 18,
    edges: 27,
  },
];

for (const example of examples) {
  const model = createConfiguredSampleGraph(example.kind, example.values, {
    indexBase: 1,
    weighted: true,
    showNodeLabels: false,
    arrowScale: 1.5,
  });
  expect(
    model.nodes.length === example.nodes,
    `${example.kind}: custom parameters must create the specified node count`,
  );
  expect(
    model.edges.length === example.edges,
    `${example.kind}: custom parameters must create the specified edge count`,
  );
  expect(
    model.settings.indexBase === 1 &&
      !model.settings.showNodeLabels &&
      model.settings.arrowScale === 1.5,
    `${example.kind}: graph presentation settings must be retained`,
  );
  expect(
    model.edges.every((edge) => edge.weight === "1"),
    `${example.kind}: weighted family edges must carry unit weights`,
  );
  expectSimpleIntegrity(model, example.kind);
}

for (const [input, count] of [
  ["１２", 12],
  [" 15 ", 15],
  ["　１７　", 17],
] as const) {
  expect(
    normalizeSampleParameters("cycle", { nodes: input }).nodes === count,
    "Cycle counts must normalize fullwidth digits and surrounding whitespace",
  );
  const model = createConfiguredSampleGraph("cycle", { nodes: input });
  expect(
    model.nodes.length === count && model.edges.length === count,
    "Cycle creation must use the entered count after digit and whitespace normalization",
  );
}

const fullwidthRandomValues = {
  nodes: "　２０　",
  edges: " ３０ ",
  seed: "０",
};
const fullwidthRandomParameters = normalizeSampleParameters(
  "randomConnected",
  fullwidthRandomValues,
);
expect(
  fullwidthRandomParameters.nodes === 20 &&
    fullwidthRandomParameters.edges === 30 &&
    fullwidthRandomParameters.seed === 0,
  "Fullwidth random parameters must preserve exact counts and seed zero",
);
const fullwidthRandom = createConfiguredSampleGraph(
  "randomConnected",
  fullwidthRandomValues,
);
expect(
  fullwidthRandom.nodes.length === 20 && fullwidthRandom.edges.length === 30,
  "Random graph creation must use fullwidth vertex and edge counts",
);
expect(
  JSON.stringify(fullwidthRandom) ===
    JSON.stringify(
      createConfiguredSampleGraph("randomConnected", {
        nodes: 20,
        edges: 30,
        seed: 0,
      }),
    ),
  "Fullwidth seed zero must reproduce the same topology and layout as numeric seed zero",
);

const knight = createConfiguredSampleGraph("knight", {
  rows: 8,
  columns: 8,
  moveX: 3,
  moveY: 4,
});
for (const edge of knight.edges) {
  const source = Number(edge.source.slice(1));
  const target = Number(edge.target.slice(1));
  const dx = Math.abs((source % 8) - (target % 8));
  const dy = Math.abs(Math.floor(source / 8) - Math.floor(target / 8));
  expect(
    (dx === 3 && dy === 4) || (dx === 4 && dy === 3),
    "Knight sample must use the configured move rather than the standard knight move",
  );
}
expect(
  knight.edges.length === 80,
  "(3,4) moves on an 8×8 board must yield 80 edges",
);
const diagonalKnight = createConfiguredSampleGraph("knight", {
  rows: 4,
  columns: 4,
  moveX: 1,
  moveY: 1,
});
expect(
  diagonalKnight.edges.length === 18,
  "Equal custom move coordinates must not duplicate edges",
);
expectSimpleIntegrity(diagonalKnight, "Equal-coordinate knight");

const hypercube = createConfiguredSampleGraph("hypercube", { dimension: 5 });
const byId = new Map(hypercube.nodes.map((node) => [node.id, node]));
expect(
  hypercube.nodes.every((node) => /^[01]{5}$/.test(node.label)),
  "Hypercube labels must have the selected dimension",
);
expect(
  hypercube.edges.every((edge) => {
    const source = byId.get(edge.source)?.label ?? "";
    const target = byId.get(edge.target)?.label ?? "";
    return (
      [...source].filter((bit, index) => bit !== target[index]).length === 1
    );
  }),
  "Hypercube adjacency must differ in exactly one bit",
);

const defaultTree = createConfiguredSampleGraph("tree");
const largeTree = createConfiguredSampleGraph("tree", { nodes: 127 });
expect(
  largeTree.nodes.length === 127,
  "A typed tree count above 64 must create the requested nodes",
);
expect(
  Math.max(...largeTree.nodes.map((node) => node.y)) >
    Math.max(...defaultTree.nodes.map((node) => node.y)),
  "Large tree layout must expose all levels rather than reuse a small fixed layout",
);

for (const kind of sampleGraphKinds) {
  const definitions = getSampleParameters(kind);
  if (definitions.length === 0) continue;
  expect(
    new Set(definitions.map((definition) => definition.key)).size ===
      definitions.length,
    `${kind}: parameter names must be unique`,
  );
  const badInputs = Object.fromEntries(
    definitions.map((definition) => [definition.key, "invalid"]),
  );
  expect(
    JSON.stringify(normalizeSampleParameters(kind, badInputs)) ===
      JSON.stringify(normalizeSampleParameters(kind)),
    `${kind}: invalid input must use the same defaults as omitted input`,
  );
  const emptyInputs = Object.fromEntries(
    definitions.map((definition) => [definition.key, ""]),
  );
  expect(
    JSON.stringify(normalizeSampleParameters(kind, emptyInputs)) ===
      JSON.stringify(normalizeSampleParameters(kind)),
    `${kind}: temporarily blank inputs must normalize to defaults`,
  );
  for (const extreme of [-1e9, 1e9]) {
    const values = Object.fromEntries(
      definitions.map((definition) => [definition.key, extreme]),
    );
    const normalized = normalizeSampleParameters(kind, values);
    for (const definition of definitions) {
      const value = normalized[definition.key];
      expect(
        Number.isInteger(value) &&
          value >= definition.min &&
          value <= definition.max,
        `${kind}: normalized ${definition.key} must remain within its integer bounds`,
      );
    }
    const model = createConfiguredSampleGraph(kind, values);
    expect(
      model.nodes.length <= 1000 && model.edges.length <= 5000,
      `${kind}: coupled constraints must respect the editor limits`,
    );
    expectSimpleIntegrity(model, `${kind} extreme`);
  }
}

expect(
  normalizeSampleParameters("cycle", { nodes: 1 }).nodes === 3,
  "Cycles must have at least three vertices",
);
expect(
  normalizeSampleParameters("crown", { nodes: 5 }).nodes === 6,
  "Crown graph vertex count must normalize to an even number",
);
expect(
  normalizeSampleParameters("turan", { nodes: 7, parts: 50 }).parts === 7,
  "Turán part count must not exceed its vertex count",
);
expect(
  normalizeSampleParameters("generalizedPetersen", { outerNodes: 5, step: 249 })
    .step === 2,
  "Petersen step must stay below half the outer cycle size",
);
const rectangular = normalizeSampleParameters("grid", {
  rows: 40,
  columns: 100,
});
expect(
  rectangular.rows === 40 && rectangular.columns === 25,
  "Large rectangular boards must jointly normalize to the node limit",
);

for (const kind of ["randomTree", "randomDag", "randomConnected"] as const) {
  for (const nodes of [1, 2, 12, 50]) {
    for (const seed of [0, 1, 47]) {
      const values = { nodes, edges: 32, seed };
      const parameters = normalizeSampleParameters(kind, values);
      const model = createConfiguredSampleGraph(kind, values, {
        directed: kind !== "randomDag",
        indexBase: 1,
      });
      const repeated = createConfiguredSampleGraph(kind, values, {
        directed: kind !== "randomDag",
        indexBase: 1,
      });
      expect(
        JSON.stringify(model) === JSON.stringify(repeated),
        `${kind}: identical seeds and parameters must reproduce topology and layout`,
      );
      expect(
        model.nodes.length === nodes,
        `${kind}: generated node count must be exact`,
      );
      expect(
        model.edges.length ===
          (kind === "randomTree" ? nodes - 1 : parameters.edges),
        `${kind}: generated edge count must be exact`,
      );
      expect(
        model.nodes.every((node) => node.label === String(node.order + 1)),
        `${kind}: generated labels must honor indexBase`,
      );
      expectSimpleIntegrity(model, `${kind} ${nodes}/${seed}`);
      if (kind === "randomDag") {
        expect(
          model.settings.directed && isAcyclic(model),
          "Random DAG must force directed settings and remain acyclic",
        );
        const positions = new Map(model.nodes.map((node) => [node.id, node.x]));
        expect(
          model.edges.every(
            (edge) =>
              (positions.get(edge.source) ?? 0) <
              (positions.get(edge.target) ?? 0),
          ),
          "Random DAG layout must follow topological depth from left to right",
        );
      } else {
        expect(
          !model.settings.directed && isConnected(model),
          `${kind}: connected generators must force undirected settings and connectivity`,
        );
      }
    }
  }
  const first = createConfiguredSampleGraph(kind, {
    nodes: 20,
    edges: 30,
    seed: 1,
  });
  const second = createConfiguredSampleGraph(kind, {
    nodes: 20,
    edges: 30,
    seed: 2,
  });
  expect(
    JSON.stringify(first.edges) !== JSON.stringify(second.edges),
    `${kind}: changing the seed must change a nontrivial topology`,
  );
}

for (const kind of ["randomDag", "randomConnected"] as const) {
  const dense = createConfiguredSampleGraph(kind, {
    nodes: 10,
    edges: 45,
    seed: 7,
  });
  expect(
    dense.edges.length === 45,
    `${kind}: sampling all pairs must finish with all 45 distinct edges`,
  );
  expectSimpleIntegrity(dense, `${kind} dense`);
}
finish();

function expectSimpleIntegrity(model: GraphModel, label: string) {
  const ids = new Set(model.nodes.map((node) => node.id));
  expect(ids.size === model.nodes.length, `${label}: node IDs must be unique`);
  expect(
    new Set(model.edges.map((edge) => edge.id)).size === model.edges.length,
    `${label}: edge IDs must be unique`,
  );
  expect(
    new Set(
      model.edges.map((edge) => [edge.source, edge.target].sort().join("/")),
    ).size === model.edges.length,
    `${label}: generated families must have no duplicate edges`,
  );
  expect(
    model.edges.every(
      (edge) =>
        edge.source !== edge.target &&
        ids.has(edge.source) &&
        ids.has(edge.target),
    ),
    `${label}: generated families must have valid non-loop endpoints`,
  );
  expect(
    model.nodes.every(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
    ),
    `${label}: generated layouts must be finite`,
  );
  expect(
    new Set(model.nodes.map((node) => `${node.x}/${node.y}`)).size ===
      model.nodes.length,
    `${label}: generated layouts must give every node a distinct position`,
  );
}

function isConnected(model: GraphModel) {
  const first = model.nodes[0]?.id;
  if (!first) return true;
  const visited = new Set([first]);
  const queue = [first];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const edge of model.edges) {
      const next =
        edge.source === queue[cursor]
          ? edge.target
          : edge.target === queue[cursor]
            ? edge.source
            : undefined;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited.size === model.nodes.length;
}

function isAcyclic(model: GraphModel) {
  const indegree = new Map(model.nodes.map((node) => [node.id, 0]));
  for (const edge of model.edges)
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  const queue = model.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const edge of model.edges) {
      if (edge.source !== queue[cursor]) continue;
      const degree = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, degree);
      if (degree === 0) queue.push(edge.target);
    }
  }
  return queue.length === model.nodes.length;
}
