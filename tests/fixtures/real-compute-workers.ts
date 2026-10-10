/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated Workers have no targetOrigin. */
import { readFile } from "node:fs/promises";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import type {
  ComputeRequest,
  ComputeResponse,
} from "../../features/graph-editor/compute/worker-protocol";

/** Production TS and compiled Rust in real Bun Workers, with file-backed fetch. */
export function installRealComputeWorkers() {
  const NativeWorker = globalThis.Worker;
  const previousWindow = globalThis.window;
  const events = new EventTarget();
  globalThis.window = {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as Window & typeof globalThis;
  const assetUrl = new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url);
  const workerUrl = new URL(
    "../../features/graph-editor/compute/graph-compute.worker.ts",
    import.meta.url,
  );
  const transports: Transport[] = [];
  let initialized = 0;
  let maxLive = 0;
  let waiting: { nodes: number; resolve: () => void } | undefined;
  const source = `
    import { readFile } from "node:fs/promises";
    const originalInstantiate = WebAssembly.instantiate;
    let current = { id: 0, nodes: 0 };
    globalThis.fetch = async () => new Response(await readFile(new URL(${JSON.stringify(assetUrl.href)})));
    WebAssembly.instantiate = async (...args) => {
      const result = await originalInstantiate(...args);
      const actual = result.instance.exports;
      const exports = { ...actual };
      exports.force_layout = (...values) => {
        postMessage({ probe: "force-start", id: current.id, nodes: current.nodes });
        const value = actual.force_layout(...values);
        postMessage({ probe: "memory", bytes: actual.memory.buffer.byteLength });
        return value;
      };
      postMessage({ probe: "initialized", bytes: actual.memory.buffer.byteLength });
      return { ...result, instance: { exports } };
    };
    await import(${JSON.stringify(workerUrl.href)});
    const compute = globalThis.onmessage;
    globalThis.onmessage = (event) => {
      if ("id" in event.data) current = { id: event.data.id, nodes: event.data.job.model.nodes.length };
      compute(event);
    };
    postMessage({ probe: "ready" });
  `;
  class Transport {
    onmessage: ((event: MessageEvent<ComputeResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    native: Worker;
    terminated = false;
    ready = false;
    queued: ComputeRequest[] = [];
    committedBytes = 0;
    constructor(_url: URL, options: WorkerOptions) {
      this.native = new NativeWorker(
        `data:application/javascript,${encodeURIComponent(source)}`,
        options,
      );
      this.native.onmessage = (event) => {
        const control = event.data;
        if (control.probe) {
          if (control.probe === "ready") {
            this.ready = true;
            for (const request of this.queued) this.native.postMessage(request);
            this.queued = [];
          }
          if (control.probe === "initialized") initialized++;
          if (control.probe === "initialized" || control.probe === "memory")
            this.committedBytes = control.bytes;
          if (
            control.probe === "force-start" &&
            waiting &&
            control.nodes === waiting.nodes
          ) {
            const notify = waiting.resolve;
            waiting = undefined;
            notify();
          }
          return;
        }
        this.onmessage?.(event);
      };
      this.native.onerror = (event) => this.onerror?.(event);
      this.native.onmessageerror = (event) => this.onmessageerror?.(event);
      transports.push(this);
      maxLive = Math.max(
        maxLive,
        transports.filter((transport) => !transport.terminated).length,
      );
    }
    postMessage(value: ComputeRequest) {
      if (this.ready) this.native.postMessage(value);
      // Bun data-URL Workers need an explicit startup queue around top-level
      // await; browsers preserve messages submitted during module loading.
      else this.queued.push(structuredClone(value));
    }
    terminate() {
      if (this.terminated) return;
      this.terminated = true;
      this.queued = [];
      this.native.terminate();
    }
  }
  globalThis.Worker = Transport as unknown as typeof Worker;
  return {
    wasmBytes: () => readFile(assetUrl).then((bytes) => bytes.length),
    heavyKernelStarted(nodes: number) {
      if (waiting) throw new Error("Already waiting for a heavy kernel");
      return new Promise<void>((resolve) => {
        waiting = { nodes, resolve };
      });
    },
    counts() {
      const live = transports.filter((transport) => !transport.terminated);
      return {
        initializations: initialized,
        createdWorkers: transports.length,
        maxLiveWorkers: maxLive,
        liveWorkers: live.length,
        liveWasmCommittedBytes: live.reduce(
          (sum, worker) => sum + worker.committedBytes,
          0,
        ),
      };
    },
    pagehide() {
      events.dispatchEvent(new Event("pagehide"));
    },
    restore() {
      events.dispatchEvent(new Event("pagehide"));
      for (const transport of transports) transport.terminate();
      globalThis.Worker = NativeWorker;
      globalThis.window = previousWindow;
    },
  };
}

export async function bounded<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          10_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
