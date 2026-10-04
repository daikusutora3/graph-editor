import {
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  GRAPH_STORAGE_KEY,
  observeExternalStorage,
  readStoredGraph,
  scheduleStoredGraphWrite,
  STORAGE_STATE_EVENT,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Storage notifications");
const descriptors = new Map(
  ["window", "document", "navigator"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
const model = {
  ...createEmptyGraphModel(),
  nodes: [{ id: "a", label: "A", order: 0, x: 0, y: 0 }],
};
let stored = serializeGraphModel(model);
let writes = 0;
let notifications = 0;
const events = new EventTarget();
let timeoutId = 0;
const timeouts = new Map<number, TimerHandler>();
const fakeWindow = {
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
  dispatchEvent: events.dispatchEvent.bind(events),
  localStorage: {
    getItem: (key: string) => (key === GRAPH_STORAGE_KEY ? stored : null),
    setItem: (_key: string, value: string) => {
      stored = value;
      writes++;
    },
  },
  setTimeout: (handler: TimerHandler) => {
    const id = ++timeoutId;
    timeouts.set(id, handler);
    return id;
  },
  clearTimeout: (id: number) => timeouts.delete(id),
};
const fakeDocument = new EventTarget();
for (const [name, value] of [
  ["window", fakeWindow],
  ["document", fakeDocument],
  [
    "navigator",
    {
      locks: {
        request: async (_key: string, callback: () => void) => callback(),
      },
    },
  ],
] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value });
}

try {
  readStoredGraph();
  events.addEventListener(STORAGE_STATE_EVENT, () => notifications++);
  let latest = model;
  for (let index = 0; index < 100; index++) {
    latest = { ...model, nodes: [{ ...model.nodes[0]!, x: index + 1 }] };
    scheduleStoredGraphWrite(latest, serializeGraphModel(latest));
  }
  console.log(`100 queued edits: ${notifications} storage notifications`);
  expect(notifications === 1, "queued edits notify pending only once");
  expect(timeouts.size === 1, "queued edits retain one save timer");
  expect(
    getStorageSnapshot().status === "pending",
    "pending status remains visible",
  );
  await flushStoredGraphWrite();
  expect(writes === 1, "flush writes only the latest queued graph");
  expect(
    stored === serializeGraphModel(latest),
    "latest graph is saved intact",
  );
  expect(
    notifications === 2 &&
      getStorageSnapshot().status === "saved" &&
      getStorageSnapshot().raw === stored,
    "saved status and changed raw document still notify",
  );

  const conflicting = serializeGraphModel(model);
  observeExternalStorage(conflicting);
  const conflictSnapshot = getStorageSnapshot();
  expect(
    notifications === 3 && conflictSnapshot.status === "conflict",
    "a conflicting document notifies",
  );
  observeExternalStorage(conflicting);
  expect(
    notifications === 3 && getStorageSnapshot() === conflictSnapshot,
    "the same conflict retains snapshot identity without another notification",
  );
  observeExternalStorage(null);
  expect(
    notifications === 4 && getStorageSnapshot().raw === null,
    "a different conflicting document still notifies",
  );
} finally {
  cancelScheduledStoredGraphWrite();
  uninstallStorageFlushListeners();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
finish();
