import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { withMeasuredNodeGeometry } from "../../features/graph-editor/adapters/browser/node-geometry";
import { restoreRoutingInteractionNodes } from "../../features/graph-editor/compute/routing-interaction";
import type { ComputeJob } from "../../features/graph-editor/compute/worker-protocol";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { defaultEdgeRoutingMeta } from "../../features/graph-editor/core/layout/edge-routing";

type RoutingJob = Extract<ComputeJob, { kind: "routing" }>;
const results = [];
for (const [nodeCount, edgeCount, movedCount] of [
  [100, 400, 1],
  [100, 400, 50],
  [1000, 5000, 1],
  [1000, 5000, 128],
  [1000, 5000, 1000],
]) {
  const graph: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: nodeCount! }, (_, order) => ({
      id: `n${order}`,
      label: order % 4 === 0 ? `Long node label ${order}` : `${order}`,
      order,
      x: (order % 32) * 96,
      y: Math.floor(order / 32) * 96,
    })),
    edges: Array.from({ length: edgeCount! }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount!}`,
      target: `n${(index + 1) % nodeCount!}`,
      weight: `${index % 10}`,
    })),
  };
  const movedNodeIds = new Set(
    graph.nodes.slice(0, movedCount).map((node) => node.id),
  );
  const previousMeta = new Map(
    graph.edges.map((edge) => [
      edge.id,
      {
        ...defaultEdgeRoutingMeta,
        controlPointDistancesPx: [24, -36],
        controlPointWeights: [0.33, 0.67],
      },
    ]),
  );
  const fullPrepare: number[] = [],
    compactPrepare: number[] = [],
    fullClone: number[] = [],
    compactClone: number[] = [],
    fullTotal: number[] = [],
    compactTotal: number[] = [];
  let full!: { job: RoutingJob; restored: GraphModel["nodes"] };
  let compact!: { job: RoutingJob; restored: GraphModel["nodes"] };
  const measure = (isCompact: boolean, round: number) => {
    const start = performance.now();
    // Both paths prepare the same sampled positions and measured route model.
    // Browser/Cytoscape position reads are outside this CPU transport benchmark.
    const positioned = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        movedNodeIds.has(node.id)
          ? { ...node, x: node.x + round, y: node.y + round }
          : { ...node },
      ),
    };
    const previousNodes = graph.nodes.filter((node) =>
      movedNodeIds.has(node.id),
    );
    const job: RoutingJob = {
      kind: "routing",
      model: withMeasuredNodeGeometry(positioned),
      options: { mode: "quality", previousMeta },
      interaction: isCompact
        ? { previousNodes, movedNodeIds }
        : { nodes: [...positioned.nodes, ...previousNodes], movedNodeIds },
    };
    // The existing reply-delta client takes this immutable baseline snapshot.
    const snapshot = new Map(previousMeta);
    const prepared = performance.now();
    const transported = structuredClone(job);
    const cloned = performance.now();
    const restored = restoreRoutingInteractionNodes(
      transported.model,
      transported.interaction!,
    );
    const end = performance.now();
    if (round >= 10) {
      (isCompact ? compactPrepare : fullPrepare).push(prepared - start);
      (isCompact ? compactClone : fullClone).push(cloned - prepared);
      (isCompact ? compactTotal : fullTotal).push(end - start);
    }
    assert.equal(snapshot.size, previousMeta.size);
    return { job: transported, restored };
  };
  for (let round = 0; round < 60; round++) {
    if (round % 2) {
      compact = measure(true, round);
      full = measure(false, round);
    } else {
      full = measure(false, round);
      compact = measure(true, round);
    }
    assert.deepEqual(compact.job.model, full.job.model);
    assert.deepEqual(compact.job.options, full.job.options);
    assert.deepEqual(compact.restored, full.restored);
    assert.deepEqual(
      compact.job.interaction!.movedNodeIds,
      full.job.interaction!.movedNodeIds,
    );
  }
  results.push({
    nodeCount,
    edgeCount,
    movedCount,
    fullInteractionNodes: nodeCount! + movedCount!,
    compactInteractionNodes: movedCount,
    fullPrepareMedianMs: median(fullPrepare),
    compactPrepareMedianMs: median(compactPrepare),
    fullCloneMedianMs: median(fullClone),
    compactCloneMedianMs: median(compactClone),
    fullPrepareCloneMedianMs: median(fullTotal),
    compactPrepareCloneRestoreMedianMs: median(compactTotal),
    totalSpeedup: median(fullTotal) / median(compactTotal),
    equivalencePasses: 60,
  });
}
const report = {
  environment:
    "Bun CPU: position-model preparation, cached estimated font measurements, reply-baseline snapshot, structured clone and Worker-side obstacle restoration; no DOM, Worker scheduler or browser pointer latency",
  results,
};
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0)
  writeFileSync(
    process.argv[outputIndex + 1]!,
    `${JSON.stringify(report, null, 2)}\n`,
  );
console.log(JSON.stringify(report, null, 2));

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
