/* oxlint-disable no-await-in-loop -- Versions load their own kernel instances before isolated timing. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { initializeRustKernelFromBytes } from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";

type Backend = { name: string; route: typeof createEdgeRoutingTask };
const backends: Backend[] = [];
for (const [flag, name] of [
  ["--baseline-root", "before"],
  ["--js-root", "JS preparation"],
]) {
  const index = process.argv.indexOf(flag!);
  if (index < 0) continue;
  const root = process.argv[index + 1]!;
  const base = `${root}/features/graph-editor`;
  const runtime = await import(
    pathToFileURL(`${base}/compute/rust-kernel.ts`).href
  );
  const routing = await import(
    pathToFileURL(`${base}/core/layout/edge-routing.ts`).href
  );
  const asset = await import(
    pathToFileURL(`${base}/compute/kernel-asset.ts`).href
  );
  await runtime.initializeRustKernelFromBytes(
    readFileSync(`${root}/wasm/${asset.RUST_KERNEL_URL.split("/").at(-1)}`),
  );
  backends.push({ name: name!, route: routing.createEdgeRoutingTask });
}
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
backends.push({ name: "optimized preparation", route: createEdgeRoutingTask });

const reports: unknown[] = [];
for (const count of [2, 8, 32, 64, 128])
  for (const obstacles of [0, 64]) {
    const graph = fixture(count, obstacles);
    const samples = new Map<
      string,
      {
        times: number[];
        maxSlices: number[];
        steps: number;
        routeHash: string;
      }
    >();
    let expected: string | undefined;
    for (let pass = 0; pass < 10; pass++)
      for (let slot = 0; slot < backends.length; slot++) {
        const backend = backends[(slot + pass) % backends.length]!;
        const task = backend.route(graph, { mode: "quality" });
        const started = performance.now();
        let step = task.next();
        let steps = 1,
          maxSlice = 0;
        while (!step.done) {
          const sliceStarted = performance.now();
          do {
            step = task.next();
            steps++;
          } while (!step.done && performance.now() - sliceStarted < 4);
          maxSlice = Math.max(maxSlice, performance.now() - sliceStarted);
        }
        const elapsed = performance.now() - started;
        const routeHash = createHash("sha256")
          .update(JSON.stringify([...step.value]))
          .digest("hex");
        const signature = `${routeHash}:${steps}`;
        expected ??= signature;
        if (signature !== expected)
          throw new Error(
            `loops ${count}/${obstacles}: outputs or yield counts differ`,
          );
        if (pass < 3) continue;
        const sample = samples.get(backend.name) ?? {
          times: [],
          maxSlices: [],
          steps,
          routeHash,
        };
        sample.times.push(elapsed);
        sample.maxSlices.push(maxSlice);
        samples.set(backend.name, sample);
      }
    const report = {
      name: `loops ${count}, obstacles ${obstacles}`,
      measurements: Object.fromEntries(
        [...samples].map(([name, sample]) => [
          name,
          {
            medianMs: median(sample.times),
            medianMaxSliceMs: median(sample.maxSlices),
            steps: sample.steps,
            routeHash: sample.routeHash,
          },
        ]),
      ),
      sameOutput: true,
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  }

const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0)
  writeFileSync(
    process.argv[outputIndex + 1]!,
    JSON.stringify(reports, null, 2) + "\n",
  );

function fixture(count: number, obstacles: number): GraphModel {
  const nodes = [
    { id: "source", order: 0, label: "wide", measuredWidth: 240, x: 0, y: 0 },
    ...Array.from({ length: obstacles }, (_, index) => ({
      id: `n${index}`,
      order: index + 1,
      label: "",
      measuredWidth: 48,
      x: Math.cos(index * 0.37) * 130,
      y: Math.sin(index * 0.37) * 130,
    })),
  ];
  return {
    ...createEmptyGraphModel({
      autoEdgeRouting: true,
      allowSelfLoops: true,
      allowMultiEdges: true,
    }),
    nodes,
    edges: Array.from({ length: count }, (_, index) => ({
      id: `loop${index}`,
      source: "source",
      target: "source",
      label: index % 2 ? "long loop label" : "1",
    })),
  };
}
function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
