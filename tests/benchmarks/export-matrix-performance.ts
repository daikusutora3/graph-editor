import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  exportGraph,
  graphExportProblem,
} from "../../features/graph-editor/io/export-graph";
import { getExportNodeEntries } from "../../features/graph-editor/io/export-node-labels";

// Pure calculation only. The browser runner excludes export text layout, paint
// and input latency. Keep its timing separate from builds and other benchmarks.
export function runExportMatrixBenchmark() {
  const iterations = 15;
  const metrics = [];
  const fixtures: Array<[string, GraphModel]> = [
    ["small", fixture(50, 100)],
    ["dense weighted directed 70 / 4900", fixture(70, 4900, true)],
    ["isolated 707", fixture(707, 0)],
    ["directed 707 / 5000", fixture(707, 5000)],
    ["weighted directed 700 / 5000", fixture(700, 5000, true)],
    ["weighted undirected 650 / 5000", fixture(650, 5000, true, false)],
  ];
  for (const [name, graph] of fixtures) {
    const expected = exportMatrixReference(graph);
    if (exportGraph(graph, "adjacency-matrix") !== expected)
      throw new Error(`${name}: changed matrix output`);
    const before: number[] = [];
    const after: number[] = [];
    for (let run = 0; run < iterations + 3; run += 1) {
      // Alternate to avoid systematically giving one version the cold run.
      for (const current of run % 2 ? [true, false] : [false, true]) {
        const start = performance.now();
        const output = current
          ? exportGraph(graph, "adjacency-matrix")
          : exportMatrixReference(graph);
        const elapsed = performance.now() - start;
        if (output !== expected) throw new Error(`${name}: unstable output`);
        if (run >= 3) (current ? after : before).push(elapsed);
      }
    }
    metrics.push({
      name,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      outputCharacters: expected.length,
      beforeMedianMs: median(before),
      afterMedianMs: median(after),
      beforeMaxMs: Math.max(...before),
      afterMaxMs: Math.max(...after),
      exactOutput: true,
    });
  }
  return { iterations, metrics };
}

function fixture(
  nodeCount: number,
  edgeCount: number,
  weighted = false,
  directed = true,
): GraphModel {
  const weights = ["5", "-13", "0.001", "0x10", "1e+3"];
  return {
    ...createEmptyGraphModel({ directed, weighted, allowSelfLoops: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: index,
      y: 0,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => {
      const offset = Math.floor(index / nodeCount);
      const source = index % nodeCount;
      return {
        id: `e${index}`,
        source: `n${source}`,
        target: `n${(source + offset + 1) % nodeCount}`,
        ...(weighted ? { weight: weights[index % weights.length] } : {}),
      };
    }),
  };
}

// Frozen pre-pass matrix construction, using identical format restrictions and
// numbering. It is kept out of the production bundle.
function exportMatrixReference(model: GraphModel) {
  const problem = graphExportProblem(model, "adjacency-matrix");
  if (problem) throw new Error(problem);
  const entries = getExportNodeEntries(model);
  const orderIndex = new Map(
    entries.map((entry, index) => [entry.node.id, index]),
  );
  const matrix = Array.from({ length: entries.length }, () =>
    Array.from({ length: entries.length }, () => "0"),
  );
  for (const edge of model.edges) {
    const source = orderIndex.get(edge.source);
    const target = orderIndex.get(edge.target);
    if (source == null || target == null) continue;
    const value = model.settings.weighted ? (edge.weight ?? "1") : "1";
    const sourceRow = matrix[source];
    const targetRow = matrix[target];
    if (!sourceRow || !targetRow) continue;
    sourceRow[target] = value;
    if (!model.settings.directed) targetRow[source] = value;
  }
  return matrix.map((row) => row.join(" ")).join("\n");
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

Object.assign(globalThis, { runExportMatrixBenchmark });
