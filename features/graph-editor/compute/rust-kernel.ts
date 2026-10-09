import { RUST_KERNEL_URL } from "./kernel-asset";

const kernelNames = [
  "force_layout",
  "node_clearance",
  "resolve_overlaps",
  "routing_node_shape",
  "routing_node_collisions",
  "routing_projected_obstacles",
  "routing_label_overlap",
  "routing_loop_obstacles",
  "interactive_straight_reroutes",
  "import_integer_matrix",
] as const;
export type RustKernelName = (typeof kernelNames)[number];
export type RustKernelCalls = Partial<Record<RustKernelName, number>>;

/** An incompatible immutable module cannot recover by downloading it again. */
export class RustKernelCompatibilityError extends Error {}

type KernelExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  alloc_f64: (length: number) => number;
  free_f64: (pointer: number, length: number) => void;
  kernel_abi_version: () => number;
};

let kernel: KernelExports | null = null;
let loading: Promise<void> | null = null;
let suppressionDepth = 0;
let diagnostics: RustKernelCalls | null = null;
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

/** Measure only this synchronous slice; concurrent Worker jobs keep separate
 * collectors while they yield. Never retain a collector across an await. */
export function withRustKernelDiagnostics<T>(
  calls: RustKernelCalls,
  callback: () => T,
): T {
  const previous = diagnostics;
  diagnostics = calls;
  try {
    return callback();
  } finally {
    diagnostics = previous;
  }
}

export function subscribeRustKernel(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initializeRustKernelFromBytes(bytes: BufferSource) {
  let instance: WebAssembly.Instance;
  try {
    ({ instance } = await WebAssembly.instantiate(bytes, {}));
  } catch (error) {
    if (
      error instanceof WebAssembly.CompileError ||
      error instanceof WebAssembly.LinkError
    )
      throw new RustKernelCompatibilityError("Invalid graph kernel module", {
        cause: error,
      });
    throw error;
  }
  const exports = instance.exports as KernelExports;
  if (
    !(exports.memory instanceof WebAssembly.Memory) ||
    typeof exports.alloc_f64 !== "function" ||
    typeof exports.free_f64 !== "function" ||
    typeof exports.kernel_abi_version !== "function" ||
    exports.kernel_abi_version() !== 1 ||
    kernelNames.some((name) => typeof exports[name] !== "function")
  ) {
    throw new RustKernelCompatibilityError("Unsupported graph kernel ABI");
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
      if (!(error instanceof RustKernelCompatibilityError)) loading = null;
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
    if (diagnostics) {
      const operationName = name as RustKernelName;
      diagnostics[operationName] = (diagnostics[operationName] ?? 0) + 1;
    }
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
