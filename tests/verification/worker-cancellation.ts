import { benchmarkWorkerCancellation } from "../benchmarks/worker-cancellation-performance";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Real Worker cancellation");
const result = await benchmarkWorkerCancellation({
  trials: 1,
  normalHeavy: false,
});
expect(
  result.measurements[0].liveWorkers === 1 &&
    result.measurements[0].maxLiveWorkers === 2,
  "cancelling an executing Rust force kernel terminates its real Worker while interactive routing survives",
);
expect(
  result.measurements[0].initializations === 2,
  "normal force operations reuse their warm Wasm instance and cancellation preserves the routing instance",
);
expect(
  result.afterDispose.liveWorkers === 0 &&
    result.afterDispose.liveWasmCommittedBytes === 0,
  "pagehide releases all real Worker ownership and Wasm memory",
);
finish();
