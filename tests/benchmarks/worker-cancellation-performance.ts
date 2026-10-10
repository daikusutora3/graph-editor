/* eslint-disable no-await-in-loop -- Each trial waits for actual Rust entry, cancels it, then measures its successor. */
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  bounded,
  installRealComputeWorkers,
} from "../fixtures/real-compute-workers";

export async function benchmarkWorkerCancellation({
  trials = 3,
  normalHeavy = true,
  clientPath,
}: {
  trials?: number;
  normalHeavy?: boolean;
  clientPath?: string;
} = {}) {
  const host = installRealComputeWorkers();
  try {
    const client: typeof import("../../features/graph-editor/compute/worker-client") =
      await import(
        clientPath
          ? pathToFileURL(resolve(clientPath)).href
          : "../../features/graph-editor/compute/worker-client"
      );
    const heavy = {
      ...createEmptyGraphModel(),
      nodes: Array.from({ length: 1000 }, (_, order) => ({
        id: `n${order}`,
        label: String(order),
        order,
        x: (order % 40) * 12,
        y: Math.floor(order / 40) * 12,
      })),
      edges: Array.from({ length: 999 }, (_, i) => ({
        id: `e${i}`,
        source: `n${i}`,
        target: `n${i + 1}`,
      })),
    };
    const small = {
      ...heavy,
      nodes: heavy.nodes.slice(0, 3),
      edges: heavy.edges.slice(0, 2),
    };
    const coldRoutingStart = performance.now();
    const reference = await bounded(
      client.computeRoutingInWorker(small, { mode: "quality" }),
      "cold routing",
    );
    if (!(reference instanceof Map)) throw new Error("Initial routing failed");
    const routingColdMs = performance.now() - coldRoutingStart;
    const firstSmallStart = performance.now();
    const firstSmall = await bounded(
      client.computeLayoutInWorker(small, "force"),
      "first small heavy",
    );
    const smallHeavyFirstMs = performance.now() - firstSmallStart;
    const warmSmallStart = performance.now();
    const warmSmall = await bounded(
      client.computeLayoutInWorker(small, "force"),
      "warm small heavy",
    );
    const smallHeavyWarmMs = performance.now() - warmSmallStart;
    if (!firstSmall || JSON.stringify(firstSmall) !== JSON.stringify(warmSmall))
      throw new Error("Small cold/warm Rust output changed");
    const measurements = [];
    for (let trial = 0; trial < trials; trial++) {
      const controller = new AbortController();
      const started = host.heavyKernelStarted(1000);
      const submitted = performance.now();
      const pending = client.computeLayoutInWorker(
        heavy,
        "force",
        undefined,
        controller.signal,
      );
      // Instrument the actual Rust ABI entry, not a timer that might abort
      // before the Worker initializes or begins its synchronous calculation.
      await bounded(started, "1000-node Rust kernel entry");
      const kernelStartMs = performance.now() - submitted;
      const cancelAt = performance.now();
      controller.abort();
      const cancelled = await bounded(pending, "heavy cancellation");
      if (cancelled !== null)
        throw new Error("Cancelled heavy job returned a result");
      const abortSettlementMs = performance.now() - cancelAt;
      const successor = await bounded(
        client.computeRoutingInWorker(small, { mode: "quality" }),
        "small successor routing",
      );
      if (
        !(successor instanceof Map) ||
        JSON.stringify([...successor]) !== JSON.stringify([...reference])
      )
        throw new Error("Successor routing output changed");
      measurements.push({
        kernelStartMs,
        abortSettlementMs,
        cancelToRoutingMs: performance.now() - cancelAt,
        ...host.counts(),
      });
    }
    let normal:
      | {
          firstAfterCancellationMs: number;
          warmMs: number;
          outputSha256: string;
        }
      | undefined;
    if (normalHeavy) {
      const firstStart = performance.now();
      const first = await bounded(
        client.computeLayoutInWorker(heavy, "force"),
        "first normal heavy after cancellation",
      );
      const firstAfterCancellationMs = performance.now() - firstStart;
      const warmStart = performance.now();
      const warm = await bounded(
        client.computeLayoutInWorker(heavy, "force"),
        "normal warm heavy",
      );
      const warmMs = performance.now() - warmStart;
      if (!first || JSON.stringify(first) !== JSON.stringify(warm))
        throw new Error("Large cold/warm Rust output changed");
      normal = {
        firstAfterCancellationMs,
        warmMs,
        outputSha256: createHash("sha256")
          .update(JSON.stringify(first))
          .digest("hex"),
      };
    }
    const idle = host.counts();
    host.pagehide();
    const afterDispose = host.counts();
    if (afterDispose.liveWorkers !== 0)
      throw new Error("Pagehide failed to dispose real Workers");
    return {
      fixture: {
        nodes: 1000,
        edges: 999,
        smallNodes: 3,
        smallEdges: 2,
        wasmBytes: await host.wasmBytes(),
      },
      routingColdMs,
      smallHeavyFirstMs,
      smallHeavyWarmMs,
      measurements,
      normal,
      idle,
      afterDispose,
      limits:
        "Real Bun Workers and production TS/compiled Rust; file-backed fetch excludes browser HTTP startup. Committed Wasm bytes exclude JavaScript heaps/native Worker memory. First small heavy is cold only with separate lanes.",
    };
  } finally {
    host.restore();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    JSON.stringify(
      await benchmarkWorkerCancellation({ clientPath: process.argv[2] }),
      null,
      2,
    ),
  );
}
