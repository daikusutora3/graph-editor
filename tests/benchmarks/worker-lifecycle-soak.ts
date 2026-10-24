/* eslint-disable no-await-in-loop -- Each cycle owns its requests and cleanup before the next low-duty interval. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { withRustKernelSuppressed } from "../../features/graph-editor/compute/rust-kernel";
import {
  computeLayoutInWorker,
  computeOverlapsInWorker,
  computeRoutingInWorker,
} from "../../features/graph-editor/compute/worker-client";
import { restoreRoutingInteractionNodes } from "../../features/graph-editor/compute/routing-interaction";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import {
  createEdgeRoutingTask,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import { interactiveRerouteEdgeIdsTask } from "../../features/graph-editor/core/layout/interactive-routing";
import { resolveNodeOverlaps } from "../../features/graph-editor/layouts/resolve-node-overlaps";
import {
  bounded,
  installRealComputeWorkers,
} from "../fixtures/real-compute-workers";

const options = parseOptions();
const latencies = new Map<string, RollingMetric>();
const stats = {
  cycles: 0,
  settledJobs: 0,
  cancelledForceJobs: 0,
  replayedOverlapJobs: 0,
  disposedPendingJobs: 0,
  disposalCycles: 0,
  resumedJobs: 0,
  mutationChecks: 0,
  verifiedResults: 0,
  gcSamples: 0,
};
const referenceHashes = new Map<string, string>();
const startedAt = performance.now();
const startedAtIso = new Date().toISOString();
const repositoryPath = fileURLToPath(new URL("../../", import.meta.url));
const sourceFiles = [
  "../../features/graph-editor/compute/worker-client.ts",
  "../../features/graph-editor/compute/graph-compute.worker.ts",
  "../../features/graph-editor/compute/wasm-routing.ts",
  "../../features/graph-editor/compute/routing-result.ts",
  "../../features/graph-editor/compute/routing-interaction.ts",
  "../../features/graph-editor/compute/rust-kernel.ts",
  "../../features/graph-editor/core/layout/edge-routing.ts",
  "../../features/graph-editor/core/layout/edge-routing-scoring.ts",
  "../../features/graph-editor/layouts/resolve-node-overlaps.ts",
  "../../features/graph-editor/layouts/layout-algorithms.ts",
  "../fixtures/real-compute-workers.ts",
  "./worker-lifecycle-soak.ts",
  `../../public${RUST_KERNEL_URL}`,
].map((sourceRelative) => {
  const path = fileURLToPath(new URL(sourceRelative, import.meta.url));
  return {
    absolutePath: path,
    path: relativePath(path),
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  };
});
let heapStats: (() => Record<string, unknown>) | undefined;
try {
  const name = "bun:jsc";
  heapStats = (await import(name)).heapStats;
} catch {}
const bun = (
  globalThis as unknown as { Bun?: { gc?: (force?: boolean) => void } }
).Bun;
let status: "in_progress" | "passed" | "failed" = "in_progress";
let failure: string | undefined;
let finalCounts: ReturnType<typeof runtime.counts> | undefined;
let nextReportAt = startedAt;

type RoutingFixture = {
  model: GraphModel;
  previous: Map<string, EdgeRoutingMeta>;
  previousNodes: GraphNode[];
  moved: Set<string>;
  expected: Map<string, EdgeRoutingMeta>;
};

const runtime = installRealComputeWorkers();
try {
  const overlapFixtures = Array.from({ length: 4 }, (_, variant) =>
    overlapFixture(variant),
  );
  const overlapExpected = overlapFixtures.map((graph) =>
    withRustKernelSuppressed(() => resolveNodeOverlaps(graph)),
  );
  const routingFixtures = Array.from({ length: 4 }, (_, variant) =>
    routingFixture(variant),
  );
  const force = forceFixture();
  for (const [variant, expected] of overlapExpected.entries())
    referenceHashes.set(`overlap${variant}`, signature(expected));
  for (const [variant, fixture] of routingFixtures.entries())
    referenceHashes.set(`routing${variant}`, signature(fixture.expected));
  report();

  while (
    stats.cycles === 0 ||
    performance.now() - startedAt < options.durationMs
  ) {
    const cycleStarted = performance.now();
    const variant = stats.cycles % overlapFixtures.length;
    const source = structuredClone(overlapFixtures[variant]!);
    const expectedOverlap = overlapExpected[variant]!;
    const cancelling = stats.cycles % 15 === 0;
    let overlap: Promise<unknown>;
    if (cancelling) {
      const controller = new AbortController();
      const entered = runtime.heavyKernelStarted(1000);
      const interrupted = timed(
        "force cancellation",
        computeLayoutInWorker(force, "force", undefined, controller.signal),
      );
      void interrupted.catch(() => {});
      await bounded(entered, "1000-node force Rust ABI entry");

      overlap = timed("replayed overlap", computeOverlapsInWorker(source));
      const sourceBeforeMutation = signature(source);
      assert.equal(
        sourceBeforeMutation,
        signature(overlapFixtures[variant]),
        "submission does not mutate source topology",
      );
      mutateCallerSource(source);
      const createdBeforeAbort = runtime.counts().createdWorkers;
      controller.abort();
      assert.equal(
        runtime.counts().createdWorkers,
        createdBeforeAbort + 1,
        "cancellation assigns the pending successor to one replacement owner",
      );
      assert.equal(
        await interrupted,
        null,
        "actually-started force settles as cancelled",
      );
      stats.cancelledForceJobs++;
      stats.replayedOverlapJobs++;
    } else {
      overlap = timed("overlap", computeOverlapsInWorker(source));
      assert.equal(
        signature(source),
        signature(overlapFixtures[variant]),
        "overlap projection leaves caller graph intact",
      );
      mutateCallerSource(source);
    }
    stats.mutationChecks++;

    const first = route(variant, routingFixtures[variant]!);
    const secondVariant = (variant + 1) % routingFixtures.length;
    const second = route(secondVariant, routingFixtures[secondVariant]!);
    const [overlapResult, firstResult, secondResult] = await Promise.all([
      overlap,
      first,
      second,
    ]);
    verify(overlapResult, expectedOverlap, `overlap${variant}`);
    verify(
      firstResult,
      routingFixtures[variant]!.expected,
      `routing${variant}`,
    );
    verify(
      secondResult,
      routingFixtures[secondVariant]!.expected,
      `routing${secondVariant}`,
    );
    assert(
      runtime.counts().liveWorkers <= 2 && runtime.counts().maxLiveWorkers <= 2,
      "at most 2 live Worker owners",
    );

    if (stats.cycles % 10 === 0) {
      const pendingHeavy = timed(
        "pagehide overlap",
        computeOverlapsInWorker(structuredClone(overlapFixtures[variant]!)),
      );
      const pendingInteractive = timed(
        "pagehide routing",
        computeRoutingInWorker(
          structuredClone(routingFixtures[variant]!.model),
          { mode: "simple" },
        ),
      );
      runtime.pagehide();
      assert.equal(
        runtime.counts().liveWorkers,
        0,
        "pagehide immediately releases both lanes",
      );
      const disposed = await Promise.all([pendingHeavy, pendingInteractive]);
      assert(
        disposed.every((result) => result === null),
        "pagehide settles every pending job",
      );
      stats.disposedPendingJobs += disposed.length;
      stats.disposalCycles++;
      const createdBeforeResume = runtime.counts().createdWorkers;
      const [resumedOverlap, resumedRoute] = await Promise.all([
        timed(
          "resumed overlap",
          computeOverlapsInWorker(structuredClone(overlapFixtures[variant]!)),
        ),
        route(variant, routingFixtures[variant]!),
      ]);
      verify(resumedOverlap, expectedOverlap, `overlap${variant}`);
      verify(
        resumedRoute,
        routingFixtures[variant]!.expected,
        `routing${variant}`,
      );
      assert.equal(
        runtime.counts().createdWorkers,
        createdBeforeResume + 2,
        "returning from pagehide initializes exactly 2 new owners",
      );
      assert.equal(
        runtime.counts().liveWorkers,
        2,
        "both recreated lanes remain usable",
      );
      stats.resumedJobs += 2;
    }
    stats.cycles++;
    metric("cycle work", performance.now() - cycleStarted);
    if (performance.now() >= nextReportAt) report();
    const remaining = Math.min(
      options.intervalMs - (performance.now() - cycleStarted),
      options.durationMs - (performance.now() - startedAt),
    );
    if (remaining > 0)
      await new Promise<void>((resume) => setTimeout(resume, remaining));
  }
  assert(
    stats.cycles > 0 &&
      stats.cancelledForceJobs > 0 &&
      stats.replayedOverlapJobs > 0,
  );
  assert(stats.disposalCycles > 0 && stats.resumedJobs > 0);
  assert(
    runtime.responses().routingDelta > 0,
    "real Worker emitted compact routing deltas",
  );
  assert.equal(
    runtime.responses().error,
    0,
    "valid fixture jobs produced no Worker errors",
  );
  assert.deepEqual(sourceChanges(), [], "soak source hashes remain frozen");
  status = "passed";

  function route(variant: number, fixture: RoutingFixture) {
    const sourceModel = structuredClone(fixture.model);
    const baseline = new Map(fixture.previous);
    const previousNodes = structuredClone(fixture.previousNodes);
    const moved = new Set(fixture.moved);
    const pending = timed(
      "interactive routing",
      computeRoutingInWorker(
        sourceModel,
        { mode: "quality", previousMeta: baseline },
        undefined,
        { movedNodeIds: moved, previousNodes },
      ),
    );
    baseline.clear();
    baseline.set(
      "caller-replaced-key",
      fixture.previous.values().next().value!,
    );
    sourceModel.nodes[0]!.x += 9999 + variant;
    sourceModel.nodes[0]!.label = "caller changed after routing submission";
    previousNodes[0]!.y += 9999;
    moved.clear();
    stats.mutationChecks++;
    return pending;
  }
} catch (error) {
  status = "failed";
  failure =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.exitCode = 1;
} finally {
  runtime.pagehide();
  finalCounts = runtime.counts();
  if (finalCounts.liveWorkers !== 0) {
    status = "failed";
    failure ??= "Final cleanup retained live Workers";
    process.exitCode = 1;
  }
  runtime.restore();
  report();
}

async function timed<T>(name: string, pending: Promise<T>) {
  const start = performance.now();
  try {
    const result = await bounded(pending, name);
    stats.settledJobs++;
    return result;
  } finally {
    metric(name, performance.now() - start);
  }
}

function verify(actual: unknown, expected: unknown, name: string) {
  assert.notEqual(actual, null, `${name} returned a complete result`);
  assert.deepEqual(
    actual,
    expected,
    `${name}: complete pure-reference output and order`,
  );
  assert.equal(
    signature(actual),
    referenceHashes.get(name),
    `${name}: stable exact result hash`,
  );
  stats.verifiedResults++;
}

function mutateCallerSource(graph: GraphModel) {
  graph.nodes[0]!.x += 5000;
  graph.nodes[0]!.label = "changed after overlap snapshot";
  graph.settings.showNodeLabels = !graph.settings.showNodeLabels;
  graph.settings.snapToGrid = !graph.settings.snapToGrid;
  graph.edges.length = 0;
}

function report() {
  const beforeGc = process.memoryUsage();
  let gcMs: number | undefined;
  if (options.forceGc && bun?.gc) {
    const start = performance.now();
    bun.gc(true);
    gcMs = performance.now() - start;
    stats.gcSamples++;
  }
  const heap = heapStats?.();
  const diagnostic = {
    status,
    failure,
    startedAt: startedAtIso,
    expectedStopAt: new Date(
      Date.parse(startedAtIso) + options.durationMs,
    ).toISOString(),
    finishedAt: status === "in_progress" ? undefined : new Date().toISOString(),
    elapsedSeconds: (performance.now() - startedAt) / 1000,
    configuration: {
      ...options,
      output: options.output ? relativePath(options.output) : undefined,
    },
    counts: { ...stats, ...runtime.counts(), responses: runtime.responses() },
    finalCounts,
    latency: Object.fromEntries(
      [...latencies].map(([name, value]) => [name, value.summary()]),
    ),
    memory: {
      beforeGc,
      current: process.memoryUsage(),
      gcRequested: options.forceGc,
      gcSupported: !!bun?.gc,
      gcMs,
      jsc: heap
        ? {
            heapSize: heap.heapSize,
            heapCapacity: heap.heapCapacity,
            objectCount: heap.objectCount,
          }
        : undefined,
    },
    referenceHashes: Object.fromEntries(referenceHashes),
    sources: sourceFiles.map(({ path, sha256 }) => ({ path, sha256 })),
    sourceChanges: sourceChanges(),
    environment: {
      bun: process.versions.bun,
      node: process.versions.node,
      platform: process.platform,
    },
    limits: [
      "Real Bun Workers and production client/Worker/Wasm, file-backed fetch; no browser, UI, GPU or deployment measurements",
      "Low-duty lifecycle diagnostic; latencies are not CPU before/after performance comparisons",
      "Per-job timings start after synchronous client submission; cycle work includes snapshots and postMessage preparation",
      "The 1000-node force cancellation intentionally stresses the internal API beyond the UI's 300-node force limit",
      "Routing checks mutate caller Maps and input snapshots; route value objects keep their existing immutable ownership contract",
      "Live Worker counts track fixture owners; underlying native termination and reclamation can complete asynchronously",
      "Rolling latency quantiles cover the latest 128 samples; heap/RSS include allocator and native Worker behavior",
      "Heap samples alone do not establish or exclude a leak; controlled repeated GC/isolation would be needed",
    ],
  };
  if (options.output) {
    writeFileSync(
      `${options.output}.tmp`,
      `${JSON.stringify(diagnostic, null, 2)}\n`,
    );
    renameSync(`${options.output}.tmp`, options.output);
  }
  console.log(
    JSON.stringify({
      status,
      elapsedSeconds: diagnostic.elapsedSeconds,
      counts: diagnostic.counts,
      latency: diagnostic.latency,
      memory: diagnostic.memory,
    }),
  );
  nextReportAt = performance.now() + 30_000;
}

function overlapFixture(variant: number): GraphModel {
  return {
    ...createEmptyGraphModel({
      autoEdgeRouting: false,
      showNodeLabels: variant % 2 === 0,
      snapToGrid: variant >= 2,
    }),
    nodes: Array.from({ length: 1000 }, (_, index) => ({
      id: `v${variant}n${index}`,
      order: index,
      label: index % 13 ? String(index) : `wide label${index}`,
      x: index < 2 ? variant * 24 : (index % 32) * 400,
      y: index < 2 ? variant * 24 : Math.floor(index / 32) * 128,
    })),
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `v${variant}e${index}`,
      source: `v${variant}n${index % 1000}`,
      target: `v${variant}n${(index + 1) % 1000}`,
      label: `edge${index}`,
    })),
  };
}

function routingFixture(variant: number): RoutingFixture {
  const base: GraphModel = {
    ...createEmptyGraphModel({
      autoEdgeRouting: true,
      directed: variant % 2 === 1,
    }),

    nodes: Array.from({ length: 24 }, (_, index) => ({
      id: `r${variant}n${index}`,
      order: index,
      label: String(index),
      x: index < 20 ? (index % 2) * 250 : 5000 + index * 100,
      y: index < 20 ? Math.floor(index / 2) * 250 : 5000,
    })),
    edges: Array.from({ length: 12 }, (_, index) => ({
      id: `r${variant}e${index}`,
      source: `r${variant}n${index < 10 ? index * 2 : 0}`,
      target: `r${variant}n${index < 10 ? index * 2 + 1 : 1}`,
    })),
  };
  return withRustKernelSuppressed(() => {
    const previous = complete(createEdgeRoutingTask(base, { mode: "quality" }));
    const movedIndex = variant % 2 ? 0 : 23;
    const previousNodes = [{ ...base.nodes[movedIndex]! }];
    const model = {
      ...base,
      nodes: base.nodes.map((node, index) =>
        index === movedIndex ? { ...node, y: node.y + 100 } : node,
      ),
    };
    const moved = new Set([model.nodes[movedIndex]!.id]);
    const interaction = { movedNodeIds: moved, previousNodes };
    const rerouteEdgeIds = complete(
      interactiveRerouteEdgeIdsTask(
        { ...model, nodes: restoreRoutingInteractionNodes(model, interaction) },
        previous,
        moved,
      ),
    );
    const expected = complete(
      createEdgeRoutingTask(model, {
        mode: "quality",
        previousMeta: previous,
        rerouteEdgeIds,
      }),
    );
    assert(
      [...expected].filter(([id, meta]) => meta === previous.get(id)).length >
        expected.size / 2,
      "routing fixture retains a majority of baseline routes for a real compact response",
    );
    return { model, previous, previousNodes, moved, expected };
  });
}

function forceFixture(): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: 1000 }, (_, index) => ({
      id: `f${index}`,
      order: index,
      label: String(index),
      x: (index % 40) * 12,
      y: Math.floor(index / 40) * 12,
    })),
    edges: Array.from({ length: 999 }, (_, index) => ({
      id: `fe${index}`,
      source: `f${index}`,
      target: `f${index + 1}`,
    })),
  };
}

function complete<T>(task: Generator<void, T>) {
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

function signature(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value instanceof Map ? [...value] : value))
    .digest("hex");
}

function sourceChanges() {
  return sourceFiles.flatMap((source) => {
    const sha256 = createHash("sha256")
      .update(readFileSync(source.absolutePath))
      .digest("hex");
    return sha256 === source.sha256
      ? []
      : [
          {
            path: source.path,
            initialSha256: source.sha256,
            currentSha256: sha256,
          },
        ];
  });
}

function relativePath(path: string) {
  return relative(repositoryPath, path).replaceAll("\\", "/");
}

function metric(name: string, value: number) {
  let current = latencies.get(name);
  if (!current) {
    current = createRollingMetric();
    latencies.set(name, current);
  }
  current.add(value);
}

type RollingMetric = ReturnType<typeof createRollingMetric>;
function createRollingMetric() {
  let count = 0;
  let total = 0;
  let max = 0;
  const recent: number[] = [];
  return {
    add(value: number) {
      count++;
      total += value;
      max = Math.max(max, value);
      recent[(count - 1) % 128] = value;
    },
    summary() {
      const values = recent.toSorted((a, b) => a - b);
      return {
        count,
        meanMs: total / count,
        maxMs: max,
        recentSamples: values.length,
        recentMedianMs: values[Math.floor(values.length / 2)],
        recentP95Ms:
          values[Math.min(values.length - 1, Math.floor(values.length * 0.95))],
      };
    },
  };
}

function parseOptions() {
  const result = {
    durationMs: 20_000,
    intervalMs: 2000,
    output: undefined as string | undefined,
    forceGc: false,
  };
  for (let index = 2; index < process.argv.length; index++) {
    const key = process.argv[index];
    if (key === "--force-gc") {
      result.forceGc = true;
      continue;
    }
    const value = process.argv[++index];
    if (!value) throw new Error(`Missing value for ${key}`);
    if (key === "--output") result.output = resolve(value);
    else if (key === "--duration-seconds") {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 7200)
        throw new Error("Duration must be between 1 and 7200 seconds");
      result.durationMs = seconds * 1000;
    } else if (key === "--interval-ms") {
      const interval = Number(value);
      if (!Number.isFinite(interval) || interval < 1000 || interval > 60_000)
        throw new Error("Interval must be between 1000 and 60000 ms");
      result.intervalMs = interval;
    } else throw new Error(`Unknown argument ${key}`);
  }
  return result;
}
