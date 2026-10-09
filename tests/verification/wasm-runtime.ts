import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  getRustKernelReady,
  initializeRustKernel,
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
  runRustKernel,
  subscribeRustKernel,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Wasm runtime");
const bytes = readFileSync(
  new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url),
);
const instantiate = WebAssembly.instantiate;
const originalFetch = globalThis.fetch;
let notifications = 0;
const unsubscribe = subscribeRustKernel(() => notifications++);

try {
  resetRustKernelForTests();
  expect(
    runRustKernel("force_layout", [], 0) === null,
    "unloaded kernels select the JavaScript fallback",
  );
  await rejects(
    () =>
      initializeRustKernelFromBytes(
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
      ),
    "Unsupported graph kernel ABI",
    "a valid Wasm module without the ABI is rejected",
  );
  await rejects(
    () => initializeRustKernelFromBytes(new Uint8Array([1, 2, 3])),
    null,
    "corrupt downloads cannot make the kernel ready",
  );
  expect(
    !getRustKernelReady() && notifications === 0,
    "failed initialization leaves the fallback and subscribers intact",
  );

  let downloads = 0;
  let releaseDownload: ((response: Response) => void) | undefined;
  globalThis.fetch = (() => {
    downloads++;
    return new Promise<Response>((resolve) => {
      releaseDownload = resolve;
    });
  }) as typeof fetch;
  const first = initializeRustKernel();
  const second = initializeRustKernel();
  expect(
    first === second && downloads === 1,
    "concurrent initialization shares one download",
  );
  releaseDownload!(new Response(null, { status: 404 }));
  await rejects(
    () => first,
    "Graph kernel download failed",
    "HTTP failure is reported",
  );
  await rejects(
    () => second,
    "Graph kernel download failed",
    "all download waiters receive failure",
  );
  globalThis.fetch = (async (url: string | URL | Request) => {
    downloads++;
    expect(
      url === RUST_KERNEL_URL,
      "kernel downloads use the generated immutable URL",
    );
    return new Response(bytes);
  }) as typeof fetch;
  await initializeRustKernel();
  await initializeRustKernel();
  expect(
    downloads === 2 && getRustKernelReady() && notifications === 1,
    "failed downloads retry, while successful initialization is reused",
  );
  unsubscribe();

  // Instrument the real Rust allocator, memory and operation. The wrappers only
  // record ownership and poison buffers while they are still live before free.
  const { instance } = await instantiate(bytes, {});
  const exports = instance.exports as WebAssembly.Exports & {
    memory: WebAssembly.Memory;
    alloc_f64: (length: number) => number;
    free_f64: (pointer: number, length: number) => void;
  };
  const owned = new Map<number, number>();
  let allocations = 0;
  let frees = 0;
  let growths = 0;
  let operations = 0;
  let failAllocationAt = -1;
  const instrumented = {
    ...exports,
    force_layout(...args: number[]) {
      operations++;
      (exports.force_layout as (...args: number[]) => void)(...args);
    },
    alloc_f64(length: number) {
      if (allocations === failAllocationAt)
        throw new Error("allocation probe failure");
      const before = exports.memory.buffer;
      const pointer = exports.alloc_f64(length);
      allocations++;
      if (before !== exports.memory.buffer) growths++;
      // Zero-length Rust slices share their dangling aligned pointer.
      if (length) {
        expect(
          !owned.has(pointer),
          "the allocator never reuses a live nonempty buffer",
        );
        owned.set(pointer, length);
      }
      return pointer;
    },
    free_f64(pointer: number, length: number) {
      if (length) {
        expect(
          owned.get(pointer) === length,
          "free uses the original pointer and length exactly once",
        );
        new Float64Array(exports.memory.buffer, pointer, length).fill(
          Number.NaN,
        );
        owned.delete(pointer);
      }
      frees++;
      exports.free_f64(pointer, length);
    },
  };
  let abiVersion = 2;
  WebAssembly.instantiate = (async () => ({
    instance: {
      exports: { ...instrumented, kernel_abi_version: () => abiVersion },
    },
    module: {},
  })) as unknown as typeof instantiate;
  resetRustKernelForTests();
  await rejects(
    () => initializeRustKernelFromBytes(bytes),
    "Unsupported graph kernel ABI",
    "incompatible ABI versions are rejected",
  );
  expect(!getRustKernelReady(), "ABI version mismatch retains the fallback");
  abiVersion = 1;
  await initializeRustKernelFromBytes(bytes);
  expect(
    notifications === 1,
    "removed subscribers do not receive later initialization",
  );

  const seeds = new Float64Array([-10, 2, 0.25, 10, -2, -0.25]);
  const reference = runRustKernel(
    "force_layout",
    [seeds, new Float64Array()],
    4,
    [2, 0, 124],
  )!;
  const beforeSuppression = { allocations, frees, operations };
  const suppressedResult = withRustKernelSuppressed(() => {
    expect(
      !getRustKernelReady(),
      "suppression selects JS in numerical adapters",
    );
    expect(
      runRustKernel(
        "force_layout",
        [seeds, new Float64Array()],
        4,
        [2, 0, 124],
      ) === null,
      "suppression skips direct Rust operations",
    );
    withRustKernelSuppressed(() => {
      expect(
        !getRustKernelReady(),
        "nested suppression retains the JS fallback",
      );
      expect(
        runRustKernel(
          "force_layout",
          [seeds, new Float64Array()],
          4,
          [2, 0, 124],
        ) === null,
        "nested suppression skips direct operations too",
      );
    });
    expect(
      !getRustKernelReady(),
      "leaving an inner scope does not enable Rust prematurely",
    );
    try {
      withRustKernelSuppressed(() => {
        throw new Error("nested suppression probe");
      });
    } catch (error) {
      expect(
        error instanceof Error && error.message === "nested suppression probe",
        "suppression preserves nested callback errors",
      );
    }
    expect(
      !getRustKernelReady(),
      "throwing inner callbacks retain outer suppression",
    );
    return "fallback completed";
  });
  expect(
    suppressedResult === "fallback completed" && getRustKernelReady(),
    "suppression returns callback results and restores kernel readiness",
  );
  await rejects(
    () =>
      Promise.resolve(
        withRustKernelSuppressed(() => {
          throw new Error("suppression probe");
        }),
      ),
    "suppression probe",
    "suppression preserves outer callback errors",
  );
  expect(
    getRustKernelReady() &&
      allocations === beforeSuppression.allocations &&
      frees === beforeSuppression.frees &&
      operations === beforeSuppression.operations,
    "all suppression scopes restore readiness without allocations or operations",
  );
  const restored = runRustKernel(
    "force_layout",
    [seeds, new Float64Array()],
    4,
    [2, 0, 124],
  );
  expect(
    JSON.stringify([...(restored ?? [])]) === JSON.stringify([...reference]) &&
      operations === beforeSuppression.operations + 1,
    "normal routing/export callers can use Rust immediately after suppression",
  );
  const largeSeeds = new Float64Array(300_000);
  const largeEdges = new Float64Array(400_000);
  largeSeeds.set(seeds);
  largeEdges[0] = 91.25;
  const grown = runRustKernel(
    "force_layout",
    [largeSeeds, largeEdges],
    4,
    [2, 0, 124],
  )!;
  expect(growths >= 2, "multiple input allocations actually grow Wasm memory");
  expect(
    JSON.stringify([...grown]) === JSON.stringify([...reference]),
    "input copies recreate views after all memory growth",
  );
  expect(
    grown.buffer !== exports.memory.buffer && grown.every(Number.isFinite),
    "returned output owns a copy before the allocator poisons and frees it",
  );
  expect(
    largeSeeds[0] === -10 && largeEdges[0] === 91.25,
    "ABI buffers do not mutate caller input",
  );
  expect(
    owned.size === 0 && allocations === frees,
    "successful batch releases every allocation",
  );

  await rejects(
    () => Promise.resolve(runRustKernel("missing_kernel", [], 0)),
    "Missing graph kernel",
    "missing operations are rejected before allocation",
  );
  await Promise.all(
    [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].map((length) =>
      rejects(
        () => Promise.resolve(runRustKernel("force_layout", [], length)),
        "Invalid kernel output length",
        "invalid output lengths are rejected",
      ),
    ),
  );
  failAllocationAt = allocations + 1;
  await rejects(
    () =>
      Promise.resolve(
        runRustKernel(
          "force_layout",
          [seeds, new Float64Array(2)],
          4,
          [2, 1, 124],
        ),
      ),
    "allocation probe failure",
    "allocation failures are propagated",
  );
  failAllocationAt = -1;
  expect(
    owned.size === 0 && allocations === frees,
    "failed allocation releases earlier buffers",
  );
  await rejects(
    () =>
      Promise.resolve(
        runRustKernel(
          "force_layout",
          [seeds, new Float64Array([0, 999_999])],
          4,
          [2, 1, 124],
        ),
      ),
    null,
    "an actual Rust bounds panic traps at the ABI",
  );
  expect(
    owned.size === 0 && allocations === frees,
    "a Rust trap releases all caller-owned ABI buffers",
  );

  const memorySize = exports.memory.buffer.byteLength;
  for (let index = 0; index < 500; index++) {
    const result = runRustKernel(
      "force_layout",
      [seeds, new Float64Array()],
      4,
      [2, 0, 124],
    );
    expect(
      result?.every(Number.isFinite) ?? false,
      "the allocator remains usable after a trap",
    );
  }
  expect(
    owned.size === 0 && allocations === frees,
    "repeated calls retain no ABI allocation",
  );
  expect(
    exports.memory.buffer.byteLength === memorySize,
    "repeated equal-sized batches reuse memory without unbounded growth",
  );
  const empty = runRustKernel(
    "force_layout",
    [new Float64Array(), new Float64Array()],
    0,
    [0, 0, 124],
  );
  expect(
    empty?.length === 0 && allocations === frees,
    "empty buffers follow the same ownership contract",
  );
} finally {
  unsubscribe();
  globalThis.fetch = originalFetch;
  WebAssembly.instantiate = instantiate;
  resetRustKernelForTests();
}
finish();

async function rejects(
  action: () => Promise<unknown>,
  message: string | null,
  description: string,
) {
  try {
    await action();
    expect(false, description);
  } catch (error) {
    expect(
      message === null ||
        (error instanceof Error && error.message.includes(message)),
      description,
    );
  }
}
