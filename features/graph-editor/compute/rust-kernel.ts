import { RUST_KERNEL_URL } from "./kernel-asset";

type KernelExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  alloc_f64: (length: number) => number;
  free_f64: (pointer: number, length: number) => void;
  kernel_abi_version: () => number;
};

let kernel: KernelExports | null = null;
let loading: Promise<void> | null = null;
let suppressionDepth = 0;
const listeners = new Set<() => void>();

export function getRustKernelReady() {
  return kernel !== null && suppressionDepth === 0;
}

/** Select yielding JS work only during this synchronous callback. Never wrap
 * an await: other routing and export work must retain the loaded Rust kernel. */
export function withRustKernelSuppressed<T>(callback: () => T): T {
  suppressionDepth++;
  try {
    return callback();
  } finally {
    suppressionDepth--;
  }
}

export function subscribeRustKernel(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initializeRustKernelFromBytes(bytes: BufferSource) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const exports = instance.exports as KernelExports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) ||
    typeof exports.alloc_f64 !== "function" ||
    typeof exports.free_f64 !== "function" ||
    typeof exports.kernel_abi_version !== "function" ||
    exports.kernel_abi_version() !== 1
  ) {
    throw new Error("Unsupported graph kernel ABI");
  }
  kernel = exports;
  for (const listener of listeners) listener();
}

export function initializeRustKernel(): Promise<void> {
  if (kernel) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const response = await fetch(RUST_KERNEL_URL);
      if (!response.ok) throw new Error("Graph kernel download failed");
      await initializeRustKernelFromBytes(await response.arrayBuffer());
    })().catch((error: unknown) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/** A single ABI call per batch, including copies and releasing all allocations.
 * Reads recreate views after allocation because Wasm memory growth detaches
 * earlier views. Missing Wasm retains the existing resumable JS implementation. */
export function runRustKernel(
  name: string,
  inputs: readonly Float64Array[],
  outputLength: number,
  args: number[] = [],
): Float64Array | null {
  if (suppressionDepth > 0) return null;
  const active = kernel;
  if (!active) return null;
  const operation = active[name];
  if (typeof operation !== "function")
    throw new Error(`Missing graph kernel: ${name}`);
  if (!Number.isSafeInteger(outputLength) || outputLength < 0)
    throw new Error("Invalid kernel output length");
  const allocations: { pointer: number; length: number }[] = [];
  try {
    for (const input of inputs) {
      allocations.push({
        pointer: active.alloc_f64(input.length),
        length: input.length,
      });
    }
    const output = active.alloc_f64(outputLength);
    allocations.push({ pointer: output, length: outputLength });
    for (const [index, input] of inputs.entries()) {
      new Float64Array(
        active.memory.buffer,
        allocations[index]!.pointer,
        input.length,
      ).set(input);
    }
    operation(...allocations.map(({ pointer }) => pointer), ...args);
    return new Float64Array(active.memory.buffer, output, outputLength).slice();
  } finally {
    for (const { pointer, length } of allocations.reverse())
      active.free_f64(pointer, length);
  }
}

/** Only verification/benchmark runners switch between reference and Wasm. */
export function resetRustKernelForTests() {
  kernel = null;
  loading = null;
}
