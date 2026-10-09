/* oxlint-disable no-await-in-loop -- Measure one global backend at a time. */
import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  getRustKernelReady,
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  scoreRustCurveLabelOverlap,
  type RoutingLabelObstacle,
} from "../../features/graph-editor/compute/wasm-routing";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  edgeCurveMidpoint,
  type EdgeCurveGeometry,
} from "../../features/graph-editor/core/layout/edge-route-geometry";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";
import { scoreLoopDirection } from "../../features/graph-editor/core/layout/edge-routing-loops";
import {
  scoreCurveCrossings,
  scoreCurveLabelOverlap,
  scoreCurveNodeAndShape,
} from "../../features/graph-editor/core/layout/edge-routing-scoring";
import type { ResolvedEdgeRoutingOptions } from "../../features/graph-editor/core/layout/edge-routing-shared";

// This measures application entry points, including snapshots, buffer copies,
// allocations and results, rather than timing an isolated Rust function.
const bytes = readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`);
const graph = fixture(1000, 160);
const source = graph.nodes[0]!;
const target = graph.nodes[1]!;
const edge = graph.edges[0]!;
const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
const curves: EdgeCurveGeometry[] = [
  { controlPointDistancesPx: [0], controlPointWeights: [0.5] },
  { controlPointDistancesPx: [128], controlPointWeights: [0.3] },
  { controlPointDistancesPx: [64, -64], controlPointWeights: [0.2, 0.8] },
];
const opts = options();
const smaller = fixture(40, 55);
const nearby = graph.nodes.slice(0, 300);
const scenarios = [
  {
    name: "node/shape, 1000 obstacles, 3 candidate controls",
    repeats: 30,
    run: (index: number) =>
      scoreCurveNodeAndShape(
        curves[index % curves.length]!,
        source,
        target,
        edge,
        graph.nodes,
        opts,
      ).score,
  },
  {
    name: "crossings, 160 curved obstacles",
    repeats: 60,
    run: (index: number) =>
      scoreCurveCrossings(
        edge,
        graph.edges,
        nodesById,
        source,
        target,
        curves[index % curves.length]!,
        opts,
        new Map(),
      ),
  },
  {
    name: "labels, 160 obstacles",
    repeats: 60,
    run: (index: number) =>
      scoreCurveLabelOverlap(
        edge,
        graph.edges,
        nodesById,
        curves[index % curves.length]!,
        opts,
        new Map(),
        true,
      ),
  },
  {
    name: "loop direction, 300 dense obstacles",
    repeats: 60,
    run: (index: number) =>
      scoreLoopDirection(index * 15 - 45, source, nearby, opts),
  },
  {
    name: "complete quality routing, 40 nodes / 55 edges",
    repeats: 2,
    run: () => {
      const task = createEdgeRoutingTask(smaller, { mode: "quality" });
      let step = task.next();
      while (!step.done) step = task.next();
      return JSON.stringify([...step.value]);
    },
  },
];
for (const [count, controlCount] of [
  [20, 2],
  [20, 4],
  [160, 1],
  [160, 2],
  [160, 4],
  [1000, 1],
  [1000, 4],
  [5000, 1],
]) {
  const labels: RoutingLabelObstacle[] = Array.from(
    { length: count },
    (_, index) => ({
      anchor: { x: (index % 3) - 1, y: (index % 5) - 2 },
      size: { width: 100, height: 26 },
    }),
  );
  const size = { width: 100, height: 26 };
  const labelCurve =
    controlCount === 1
      ? curves[0]!
      : {
          controlPointDistancesPx: Array.from(
            { length: controlCount! },
            (_, index) => (index % 2 === 0 ? 64 : -64),
          ),
          controlPointWeights: Array.from(
            { length: controlCount! },
            (_, index) => (index + 1) / (controlCount! + 1),
          ),
        };
  scenarios.push({
    name: `label kernel, ${count} overlapping cached anchors / ${controlCount} controls`,
    repeats: 120,
    run: () => {
      if (getRustKernelReady())
        return scoreRustCurveLabelOverlap(
          labelCurve,
          source,
          target,
          size,
          labels,
        )!;
      const anchor = edgeCurveMidpoint(source, target, labelCurve);
      let score = 0;
      for (const label of labels) {
        const x =
          (size.width + label.size.width) / 2 +
          2 -
          Math.abs(anchor.x - label.anchor.x);
        const y =
          (size.height + label.size.height) / 2 +
          2 -
          Math.abs(anchor.y - label.anchor.y);
        if (x > 0 && y > 0) score += 10_000 + x * y * 1.4;
      }
      return score;
    },
  });
}
for (const count of [300, 1000]) {
  const loopNodes = Array.from({ length: count }, (_, index) => ({
    id: `loop-obstacle${index}`,
    order: index,
    label: "1",
    x: source.x + Math.cos(index * 0.37) * 51,
    y: source.y + Math.sin(index * 0.37) * 51,
  }));
  scenarios.push({
    name: `loop direction, ${count} nearby annulus obstacles`,
    repeats: 60,
    run: (index) =>
      scoreLoopDirection(index * 15 - 45, source, loopNodes, opts),
  });
}
const results = new Map<
  string,
  { medianMs: number; result: number | string }
>();
for (const mode of ["javascript", "rust"] as const) {
  if (mode === "rust") await initializeRustKernelFromBytes(bytes);
  else resetRustKernelForTests();
  for (const scenario of scenarios) {
    for (let index = 0; index < scenario.repeats; index++) scenario.run(index);
    const times: number[] = [];
    let result: number | string = 0;
    for (let iteration = 0; iteration < 7; iteration++) {
      const start = performance.now();
      for (let index = 0; index < scenario.repeats; index++)
        result = scenario.run(index);
      times.push((performance.now() - start) / scenario.repeats);
    }
    const medianMs = times.toSorted((a, b) => a - b)[3]!;
    if (mode === "javascript") results.set(scenario.name, { medianMs, result });
    else {
      const reference = results.get(scenario.name)!;
      const sameResult =
        typeof result === "number" && typeof reference.result === "number"
          ? Math.abs(result - reference.result) <=
            Math.max(1e-10, Math.abs(reference.result) * 1e-12)
          : result === reference.result;
      console.log(
        JSON.stringify({
          name: scenario.name,
          javascriptMs: reference.medianMs,
          rustMs: medianMs,
          speedup: reference.medianMs / medianMs,
          sameResult,
        }),
      );
      if (!sameResult) process.exitCode = 1;
    }
  }
}

function fixture(nodeCount: number, edgeCount: number): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: index % 5 === 0 ? "long vertex label" : String(index),
      x: index < 2 ? index * 440 - 220 : ((index * 73) % 600) - 300,
      y: index < 2 ? 0 : ((index * 137) % 400) - 200,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${(index * 2) % nodeCount}`,
      target: `n${(index * 2 + 1) % nodeCount}`,
      label: "edge label",
      ...(index === 0
        ? {}
        : { routing: { bowPx: index % 2 === 0 ? 128 : -128 } }),
    })),
  };
}

function options(): ResolvedEdgeRoutingOptions {
  return {
    avoidNodes: true,
    work: {
      units: 0,
      samples: new Map(),
      labelAnchors: new Map(),
      labelSizes: new Map(),
    },
    candidateBowPx: [0, 64, -64],
    duplicateBowPx: 36,
    loopDirectionDeg: -45,
    loopDirectionStepDeg: 42,
    loopSweepDeg: 70,
    loopSweepStepDeg: 16,
    maxLoopSweepDeg: 120,
    nodeClearancePx: 30,
    previousMeta: new Map(),
    rerouteEdgeIds: null,
    separateParallelEdges: true,
    variant: 0,
  };
}
