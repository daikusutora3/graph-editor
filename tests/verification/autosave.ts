import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  acceptStorageBaseline,
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  GRAPH_STORAGE_KEY,
  observeExternalStorage,
  readStoredGraph,
  scheduleStoredGraphWrite,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { createVerification } from "./harness";
const { expect, finish } = createVerification("Autosave");
const original = {
  window: Object.getOwnPropertyDescriptor(globalThis, "window"),
  document: Object.getOwnPropertyDescriptor(globalThis, "document"),
  navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
};
let raw: string | null = null;
let fail = false;
let writes = 0;
let locked = false;
let hold: (() => void) | null = null;
const storage = {
  getItem: (key: string) => {
    expect(key === GRAPH_STORAGE_KEY, "reads graph storage only");
    return raw;
  },
  setItem: (_key: string, value: string) => {
    expect(locked, "write occurs under exclusive lock");
    if (fail) throw new Error("quota");
    writes++;
    raw = value;
  },
};
const graph = createEmptyGraphModel();
const edited = {
  ...graph,
  nodes: [{ id: "a", label: "latest", order: 0, x: 0, y: 0 }],
};
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: storage,
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 1,
    clearTimeout() {},
  },
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    addEventListener() {},
    removeEventListener() {},
    visibilityState: "visible",
  },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: async (_name: string, callback: () => void) => {
        if (hold)
          await new Promise<void>((resolve) => {
            hold = resolve;
          });
        locked = true;
        try {
          callback();
        } finally {
          locked = false;
        }
      },
    },
  },
});
try {
  readStoredGraph();
  fail = true;
  scheduleStoredGraphWrite(graph);
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "failed" && raw === null,
    "failure retains the previous saved value",
  );
  scheduleStoredGraphWrite(edited);
  fail = false;
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "saved" && String(raw).includes("latest"),
    "retry saves the latest edit",
  );
  const saved = raw;
  scheduleStoredGraphWrite(graph);
  raw = JSON.stringify({
    ...edited,
    settings: { ...edited.settings, directed: true },
  });
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "conflict" && raw !== saved,
    "compare and write protect the other tab's content",
  );
  const count = writes;
  scheduleStoredGraphWrite(edited);
  await flushStoredGraphWrite();
  expect(
    writes === count,
    "conflict remains blocked until explicitly resolved",
  );
  acceptStorageBaseline(raw);
  hold = () => {};
  scheduleStoredGraphWrite(graph);
  const stale = flushStoredGraphWrite();
  scheduleStoredGraphWrite(edited);
  const release = hold as () => void;
  hold = null;
  release();
  await stale;
  expect(
    getStorageSnapshot().status === "pending" && writes === count,
    "stale lock callback cannot write or mark a newer edit saved",
  );
  await flushStoredGraphWrite();
  expect(writes === count + 1, "newest request can subsequently save");
  raw = "broken original";
  readStoredGraph();
  scheduleStoredGraphWrite(graph);
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "invalid" && raw === "broken original",
    "invalid original is preserved instead of overwritten",
  );
  observeExternalStorage(null);
  expect(
    getStorageSnapshot().status === "conflict",
    "external removal is also a conflict",
  );
  acceptStorageBaseline(null);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  scheduleStoredGraphWrite(edited);
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "unavailable",
    "no unlocked fallback when Web Locks is unavailable",
  );
} finally {
  cancelScheduledStoredGraphWrite();
  uninstallStorageFlushListeners();
  for (const key of ["window", "document", "navigator"] as const) {
    const descriptor = original[key];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
finish();
