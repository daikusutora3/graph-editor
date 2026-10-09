import { readFileSync } from "node:fs";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  countCurveNodeCollisions,
  shouldUseRustCurveNodeCollisions,
} from "../../features/graph-editor/core/layout/edge-routing-collisions";
import { collisionFixture } from "../fixtures/routing-collisions";

await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
let consumed = 0;
for (const dense of [true, false]) {
  for (const count of [50, 1000]) {
    for (const controls of [0, 1, 3]) {
      const { source, target, edge, nodes, curve } = collisionFixture(
        count,
        controls,
        dense,
      );
      const run = () =>
        countCurveNodeCollisions(curve, edge, source, target, nodes);
      const expected = withRustKernelSuppressed(run);
      if (run() !== expected) throw new Error("Collision counts differ");
      const repeats = count === 50 ? 100 : 15;
      for (let index = 0; index < 20; index++) {
        consumed += run();
        consumed += withRustKernelSuppressed(run);
      }
      const previousTimes: number[] = [],
        newTimes: number[] = [];
      for (let batch = 0; batch < 9; batch++) {
        const previous = () =>
          withRustKernelSuppressed(() => {
            const start = performance.now();
            for (let index = 0; index < repeats; index++) consumed += run();
            previousTimes.push((performance.now() - start) / repeats);
          });
        const current = () => {
          const start = performance.now();
          for (let index = 0; index < repeats; index++) consumed += run();
          newTimes.push((performance.now() - start) / repeats);
        };
        if (batch % 2) {
          current();
          previous();
        } else {
          previous();
          current();
        }
      }
      const previousMs = previousTimes.toSorted((a, b) => a - b)[4]!;
      const currentMs = newTimes.toSorted((a, b) => a - b)[4]!;
      console.log(
        JSON.stringify({
          density: dense ? "dense" : "sparse",
          nodes: count,
          controls,
          collisions: expected,
          selectedRust: shouldUseRustCurveNodeCollisions(
            curve,
            source,
            target,
            nodes,
          ),
          previousMs,
          currentMs,
          speedup: previousMs / currentMs,
          sameResult: true,
        }),
      );
    }
  }
}
console.log(
  JSON.stringify({
    consumed,
    notes:
      "Compares the exact production collision operation including backend selection, cached-node validation, ABI copies/allocations/releases. This helper used JS in the previous Wasm-enabled application, so its suppressed numeric branch is also the previous backend for this operation. Fetch, compilation, Worker transport, painting excluded.",
  }),
);
