import { performance } from "node:perf_hooks";

import { defaultGraphSettings } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  GraphEdge,
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";

const CASES = [
  { nodes: 50, edges: 100 },
  { nodes: 100, edges: 200 },
  { nodes: 200, edges: 400 },
] as const;
const ITERATIONS = 5;

console.log(
  `Edge routing benchmark (${ITERATIONS} iterations, average milliseconds)`,
);
console.log(
  "size".padEnd(16),
  "initial".padStart(10),
  "move node".padStart(12),
  "add edge".padStart(10),
  "add parallel".padStart(14),
);

for (const benchmarkCase of CASES) {
  const graph = createBenchmarkGraph(benchmarkCase.nodes, benchmarkCase.edges);
  const previousMeta = computeEdgeRouting(graph);
  const movedGraph = moveNode(graph, "node-0", 17, -11);
  const edgeAddedGraph = addEdge(graph, {
    id: "added-edge",
    source: "node-0",
    target: `node-${Math.max(1, benchmarkCase.nodes - 1)}`,
  });
  const parallelSource = graph.edges[0]?.source ?? "node-0";
  const parallelTarget = graph.edges[0]?.target ?? "node-1";
  const parallelAddedGraph = addEdge(graph, {
    id: "added-parallel-edge",
    source: parallelSource,
    target: parallelTarget,
  });

  const initialMs = benchmark(() => computeEdgeRouting(graph));
  const movedNodeMs = benchmark(() =>
    computeEdgeRouting(movedGraph, { previousMeta }),
  );
  const addedEdgeMs = benchmark(() =>
    computeEdgeRouting(edgeAddedGraph, { previousMeta }),
  );
  const addedParallelMs = benchmark(() =>
    computeEdgeRouting(parallelAddedGraph, { previousMeta }),
  );

  console.log(
    `${benchmarkCase.nodes} nodes / ${benchmarkCase.edges} edges`.padEnd(16),
    formatMs(initialMs),
    formatMs(movedNodeMs),
    formatMs(addedEdgeMs),
    formatMs(addedParallelMs),
  );
}

function benchmark(run: () => unknown) {
  run();
  const startedAt = performance.now();

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    run();
  }

  return (performance.now() - startedAt) / ITERATIONS;
}

function createBenchmarkGraph(
  nodeCount: number,
  edgeCount: number,
): GraphModel {
  const columns = Math.ceil(Math.sqrt(nodeCount));
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index}`,
    label: String(index),
    order: index,
    x: (index % columns) * 90,
    y: Math.floor(index / columns) * 90,
  }));
  const edges: GraphEdge[] = Array.from({ length: edgeCount }, (_, index) => {
    const sourceIndex = index % nodeCount;
    const hop = 1 + ((index * 17) % Math.max(1, nodeCount - 1));
    const targetIndex = (sourceIndex + hop) % nodeCount;

    return {
      id: `edge-${index}`,
      source: `node-${sourceIndex}`,
      target: `node-${targetIndex}`,
    };
  });

  return {
    version: 1,
    nodes,
    edges,
    settings: {
      ...defaultGraphSettings,
      allowMultiEdges: true,
      autoEdgeRouting: true,
    },
  };
}

function moveNode(
  graph: GraphModel,
  nodeId: string,
  deltaX: number,
  deltaY: number,
): GraphModel {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, x: node.x + deltaX, y: node.y + deltaY }
        : node,
    ),
  };
}

function addEdge(graph: GraphModel, edge: GraphEdge): GraphModel {
  return { ...graph, edges: [...graph.edges, edge] };
}

function formatMs(milliseconds: number) {
  return milliseconds.toFixed(2).padStart(10);
}
