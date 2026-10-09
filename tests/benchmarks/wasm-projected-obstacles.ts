import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import { projectRustEdgeObstacles } from "../../features/graph-editor/compute/wasm-routing";
import type { GraphNode } from "../../features/graph-editor/core/graph/model";
import { nodeGeometryWidth } from "../../features/graph-editor/core/graph/node-size";
import { projectedEdgeObstacles } from "../../features/graph-editor/core/layout/edge-routing";

// Run alone. Includes cache validation, packing/copying and result construction.
// Each backend uses the actual production entry; only JS suppresses the kernel.
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
const edge = { id: "edge", source: "source", target: "target" };
let seed = 13732;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
for (const wide of [false, true]) {
  for (const count of [32, 64, 100, 300, 1000]) {
    const source: GraphNode = { id: "source", order: 0, label: "", x: 0, y: 0 };
    const target: GraphNode = {
      id: "target",
      order: 1,
      label: "",
      x: 2100,
      y: 430,
    };
    const nodes = [
      source,
      target,
      ...Array.from({ length: count - 2 }, (_, index) => ({
        id: `n${index}`,
        order: index + 2,
        label: wide && index % 2 === 0 ? "長い頂点ラベル".repeat(4) : "",
        x: random() * 2800 - 300,
        y: random() * 600 - 150,
      })),
    ].map((node) => ({ ...node, measuredWidth: nodeGeometryWidth(node) }));
    const run = () => projectedEdgeObstacles(edge, source, target, nodes, 30);
    const dispatchesOnMeasuredChord =
      projectRustEdgeObstacles(edge, source, target, nodes, 30) !== null;
    const { javascriptMedianMs, wasmMedianMs } = measurePair(
      () => withRustKernelSuppressed(run),
      run,
    );
    let rustResults = 0;
    const sampleChords = Array.from({ length: 40 }, (_, index) => ({
      ...target,
      x: 1700 + index * 19,
      y: 83 + index * 11,
    }));
    for (const chord of sampleChords)
      if (projectRustEdgeObstacles(edge, source, chord, nodes, 30) !== null)
        rustResults++;
    console.log(
      JSON.stringify({
        name: `projected ${count} measured ${wide ? "mixed long labels" : "circles"}`,
        javascriptMedianMs,
        wasmMedianMs,
        speedup: dispatchesOnMeasuredChord
          ? javascriptMedianMs / wasmMedianMs
          : null,
        sameOutput: true,
        rustResults,
        sampleChords: sampleChords.length,
        dispatchesOnMeasuredChord,
        passes: 12,
        warmPasses: 5,
        callsPerPass: 50,
        measurement: dispatchesOnMeasuredChord ? "Rust versus JS" : "both JS",
      }),
    );
  }
}

function measurePair(javascript: () => unknown, wasm: () => unknown) {
  const times: [number[], number[]] = [[], []];
  let referenceSignature: string | undefined;
  for (let pass = 0; pass < 12; pass++) {
    const signatures: string[] = [];
    // Alternate order each pass, warm both for 250 calls, then retain seven
    // paired samples. Gate=false rows intentionally make no Rust speedup claim.
    for (const backend of pass % 2 === 0 ? [0, 1] : [1, 0]) {
      const run = backend === 0 ? javascript : wasm;
      let result: unknown;
      const start = performance.now();
      for (let repeat = 0; repeat < 50; repeat++) result = run();
      const elapsed = (performance.now() - start) / 50;
      if (pass >= 5) times[backend]!.push(elapsed);
      signatures[backend] = JSON.stringify(result);
    }
    if (
      signatures[0] !== signatures[1] ||
      (referenceSignature !== undefined && signatures[0] !== referenceSignature)
    ) {
      throw new Error(`projection output signatures differ on pass ${pass}`);
    }
    referenceSignature = signatures[0];
  }
  return {
    javascriptMedianMs: times[0].toSorted((a, b) => a - b)[3]!,
    wasmMedianMs: times[1].toSorted((a, b) => a - b)[3]!,
  };
}
