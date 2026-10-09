/* oxlint-disable no-await-in-loop -- Independent Wasm instances isolate the alternating timings. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";

type Kernel = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  alloc_f64: (length: number) => number;
  free_f64: (pointer: number, length: number) => void;
  routing_node_shape: (...args: number[]) => void;
  routing_node_collisions: (...args: number[]) => void;
};
type Backend = { name: string; kernel: Kernel };
const backends: Backend[] = [];
const baselineIndex = process.argv.indexOf("--baseline-root");
if (baselineIndex >= 0) {
  const root = resolve(process.argv[baselineIndex + 1]!);
  const manifest = readFileSync(
    `${root}/features/graph-editor/compute/kernel-asset.ts`,
    "utf8",
  );
  const url = manifest.match(/"(\/wasm\/graph-kernels\.[^"\n]+\.wasm)"/)?.[1];
  if (!url) throw new Error("Missing baseline Wasm URL");
  backends.push({
    name: "before",
    kernel: (
      await WebAssembly.instantiate(
        readFileSync(`${root}/wasm/${url.split("/").at(-1)}`),
        {},
      )
    ).instance.exports as Kernel,
  });
}
backends.push({
  name: "after",
  kernel: (
    await WebAssembly.instantiate(
      readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
      {},
    )
  ).instance.exports as Kernel,
});

// Buffers are packed and allocated before timing, exposing numeric-kernel cost
// separately from JS snapshots, ABI copies, scheduling, and browser painting.
const curves = [
  new Float64Array([1, 1, 0, 0.5]),
  new Float64Array([1, 1, 128, 0.5]),
  new Float64Array([1, 1, -128, 0.5]),
  new Float64Array([2, 2, 90, -60, 0.3, 0.7]),
];
for (const nodeCount of [150, 1000]) {
  for (const wide of [false, true]) {
    const nodes = new Float64Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      nodes[i * 3] = i < 2 ? i * 440 - 220 : ((i * 73) % 600) - 300;
      nodes[i * 3 + 1] = i < 2 ? 0 : ((i * 137) % 500) - 250;
      nodes[i * 3 + 2] = wide ? 48 + (i % 5) * 12 : 24;
    }
    const prepared = backends.map(({ name, kernel }) => {
      const nodePointer = kernel.alloc_f64(nodes.length);
      const curvePointers = curves.map((curve) =>
        kernel.alloc_f64(curve.length),
      );
      const outputPointer = kernel.alloc_f64(3);
      new Float64Array(kernel.memory.buffer, nodePointer, nodes.length).set(
        nodes,
      );
      for (const [i, curve] of curves.entries())
        new Float64Array(
          kernel.memory.buffer,
          curvePointers[i]!,
          curve.length,
        ).set(curve);
      return { name, kernel, nodePointer, curvePointers, outputPointer };
    });
    try {
      for (const operation of [
        "routing_node_shape",
        "routing_node_collisions",
      ] as const) {
        const samples = new Map<string, number[]>();
        let expectedSignature: string | undefined;
        for (let pass = 0; pass < 16; pass++) {
          for (let slot = 0; slot < prepared.length; slot++) {
            const backend = prepared[(slot + pass) % prepared.length]!;
            const args = [nodeCount, 0, 1, -220, 0, 220, 0];
            if (operation === "routing_node_shape") args.push(30);
            const run = () => {
              for (const curvePointer of backend.curvePointers)
                backend.kernel[operation](
                  backend.nodePointer,
                  curvePointer,
                  backend.outputPointer,
                  ...args,
                );
            };
            const started = performance.now();
            for (let iteration = 0; iteration < 100; iteration++) run();
            const elapsedPerCandidate = (performance.now() - started) / 400;
            const outputs: number[][] = [];
            for (const curvePointer of backend.curvePointers) {
              backend.kernel[operation](
                backend.nodePointer,
                curvePointer,
                backend.outputPointer,
                ...args,
              );
              outputs.push([
                ...new Float64Array(
                  backend.kernel.memory.buffer,
                  backend.outputPointer,
                  3,
                ),
              ]);
            }
            const signature = createHash("sha256")
              .update(JSON.stringify(outputs))
              .digest("hex");
            expectedSignature ??= signature;
            if (signature !== expectedSignature)
              throw new Error(
                `${operation}/${nodeCount}/${wide}: output mismatch`,
              );
            if (pass >= 5) {
              const times = samples.get(backend.name) ?? [];
              times.push(elapsedPerCandidate);
              samples.set(backend.name, times);
            }
          }
        }
        const before = samples.get("before");
        const after = median(samples.get("after")!);
        console.log(
          JSON.stringify({
            operation,
            nodes: nodeCount,
            shape: wide ? "wide capsules" : "circles",
            ...(before
              ? { beforeMs: median(before), speedup: median(before) / after }
              : {}),
            afterMs: after,
            sameOutput: true,
            signature: expectedSignature,
          }),
        );
      }
    } finally {
      for (const backend of prepared) {
        backend.kernel.free_f64(backend.outputPointer, 3);
        for (const [i, pointer] of backend.curvePointers.entries())
          backend.kernel.free_f64(pointer, curves[i]!.length);
        backend.kernel.free_f64(backend.nodePointer, nodes.length);
      }
    }
  }
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
