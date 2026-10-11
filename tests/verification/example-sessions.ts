import { createStore } from "jotai/vanilla";
import {
  articleSlugs,
  createArticleExampleGraph,
  getArticleExample,
} from "../../lib/article-examples";
import { guideExamples } from "../../lib/guide-examples";
import {
  getGraphStorageContext,
  GRAPH_STORAGE_KEY,
  EXAMPLE_GRAPH_STORAGE_PREFIX,
} from "../../features/graph-editor/adapters/browser/graph-storage-context";
import {
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  observeExternalStorage,
  readStoredGraph,
  scheduleStoredGraphWrite,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  graphAtom,
  graphStorageReadyAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Article example sessions");
const originalDescriptors = Object.fromEntries(
  (["window", "document", "navigator"] as const).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
);
const originalGraph = {
  ...createEmptyGraphModel(),
  nodes: [{ id: "original", label: "My saved work", order: 0, x: 0, y: 0 }],
};
const originalRaw = serializeGraphModel(originalGraph);
let localRaw = originalRaw;
let localReads = 0;
let localWrites = 0;
let lockRequests = 0;
let sessionWrites = 0;
let sessionReadFails = false;
let sessionWriteFails = false;
const sessionValues = new Map<string, string>();
const location = { search: "?example=edge-list" };
const listeners = new Map<string, EventListener>();
let lockRelease: (() => void) | null = null;
let holdLock = false;

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    location,
    localStorage: {
      getItem(key: string) {
        expect(
          key === GRAPH_STORAGE_KEY,
          "normal mode reads only the original key",
        );
        localReads++;
        return localRaw;
      },
      setItem(key: string, raw: string) {
        expect(
          key === GRAPH_STORAGE_KEY,
          "normal mode writes only the original key",
        );
        localWrites++;
        localRaw = raw;
      },
    },
    sessionStorage: {
      getItem(key: string) {
        if (sessionReadFails) throw new Error("storage disabled");
        return sessionValues.get(key) ?? null;
      },
      setItem(key: string, raw: string) {
        if (sessionWriteFails) throw new Error("quota");
        sessionWrites++;
        sessionValues.set(key, raw);
      },
    },
    dispatchEvent() {},
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
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
        lockRequests++;
        if (holdLock) {
          await new Promise<void>((resolve) => {
            lockRelease = resolve;
          });
        }
        callback();
      },
    },
  },
});

try {
  expect(
    getGraphStorageContext().kind === "example",
    "query selects isolated storage before graph hydration",
  );
  const exampleStore = createStore();
  const unsubscribe = exampleStore.sub(graphStorageReadyAtom, () => {});
  const initialExample = exampleStore.get(graphAtom);
  expect(
    exampleStore.get(graphStorageReadyAtom) &&
      initialExample.nodes.length === 4,
    "a fresh example hydrates the trusted graph without an import or graph replacement",
  );
  expect(
    localReads === 0 && localWrites === 0,
    "hydrating an example never reads or writes original localStorage",
  );
  unsubscribe();

  const editedExample = {
    ...initialExample,
    nodes: initialExample.nodes.map((node, index) =>
      index === 0 ? { ...node, label: "Example edit" } : node,
    ),
  };
  scheduleStoredGraphWrite(editedExample);
  await flushStoredGraphWrite();
  expect(
    sessionWrites === 1 && lockRequests === 0 && localRaw === originalRaw,
    "example edits save to sessionStorage without acquiring the original lock",
  );
  expect(
    readStoredGraph()?.nodes[0]?.label === "Example edit",
    "reloading the same example restores its edited graph",
  );
  const beforeExternalUpdate = getStorageSnapshot();
  observeExternalStorage(serializeGraphModel(createEmptyGraphModel()));
  observeExternalStorage(null);
  expect(
    getStorageSnapshot() === beforeExternalUpdate,
    "normal-tab updates and deletions cannot create a conflict in an example tab",
  );
  expect(
    localReads === 0 && localWrites === 0,
    "example editing and reload never access original localStorage",
  );

  location.search = "?example=tree-layout";
  const tree = readStoredGraph();
  expect(
    tree?.settings.weighted === true && tree.edges[0]?.weight === "5",
    "each sample has its own trusted graph and weighted-tree settings",
  );
  scheduleStoredGraphWrite(tree!);
  await flushStoredGraphWrite();
  expect(
    sessionValues.has(`${EXAMPLE_GRAPH_STORAGE_PREFIX}tree-layout`) &&
      sessionValues.has(`${EXAMPLE_GRAPH_STORAGE_PREFIX}edge-list`),
    "different article examples have separate session slots",
  );

  location.search = "?example=edge-list";
  readStoredGraph();
  scheduleStoredGraphWrite(initialExample);
  location.search = "";
  await flushStoredGraphWrite();
  scheduleStoredGraphWrite(editedExample);
  await flushStoredGraphWrite();
  expect(
    localWrites === 0 &&
      Boolean(
        sessionValues
          .get(`${EXAMPLE_GRAPH_STORAGE_PREFIX}edge-list`)
          ?.includes("Example edit"),
      ),
    "changing to the original URL cannot flush or schedule an old example into original storage",
  );
  expect(
    readStoredGraph()?.nodes[0]?.id === "original",
    "the editor URL without example restores the original graph",
  );
  scheduleStoredGraphWrite(originalGraph);
  await flushStoredGraphWrite();
  expect(
    localWrites === 1 && lockRequests === 1,
    "normal editing retains the existing localStorage and Web Locks behavior",
  );

  holdLock = true;
  scheduleStoredGraphWrite(createEmptyGraphModel());
  const pendingOriginalWrite = flushStoredGraphWrite();
  location.search = "?example=adjacency-matrix";
  readStoredGraph();
  holdLock = false;
  const release = lockRelease as (() => void) | null;
  release?.();
  await pendingOriginalWrite;
  expect(
    localRaw === originalRaw && localWrites === 1,
    "an old original lock callback cannot write after entering an example context",
  );

  sessionWriteFails = true;
  scheduleStoredGraphWrite(createArticleExampleGraph("adjacency-matrix"));
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "failed" && localWrites === 1,
    "session save failures are visible and never fall back to original localStorage",
  );
  sessionWriteFails = false;
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "saved",
    "session save retry keeps the latest pending edit",
  );

  sessionReadFails = true;
  expect(
    readStoredGraph()?.nodes.length === 3 &&
      getStorageSnapshot().status === "unavailable",
    "blocked session storage still opens the trusted example with an unavailable-save notice",
  );
  sessionReadFails = false;
  sessionValues.set(
    `${EXAMPLE_GRAPH_STORAGE_PREFIX}adjacency-matrix`,
    "broken",
  );
  expect(
    readStoredGraph() === null && getStorageSnapshot().status === "invalid",
    "invalid session data is retained for recovery instead of silently replaced",
  );
  expect(
    sessionValues.get(`${EXAMPLE_GRAPH_STORAGE_PREFIX}adjacency-matrix`) ===
      "broken",
    "invalid example data is not overwritten during hydration",
  );

  location.search = "?example=tikz-export";
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  const unlockedExample = readStoredGraph();
  scheduleStoredGraphWrite(unlockedExample!);
  await flushStoredGraphWrite();
  expect(
    getStorageSnapshot().status === "saved" && localWrites === 1,
    "isolated session saves work without Web Locks and never fall back to original storage",
  );

  location.search = "?example=untrusted-slug";
  expect(
    getGraphStorageContext().kind === "original",
    "arbitrary query strings cannot choose storage keys or graph data",
  );

  for (const slug of articleSlugs) {
    const model = createArticleExampleGraph(slug);
    expect(
      parseGraphModelJson(serializeGraphModel(model)) !== null,
      `${slug} example satisfies the graph contract`,
    );
    const example = getArticleExample(slug)!;
    const sharedGuideExample = guideExamples.find(
      (entry) => entry.id === example.guideExampleId,
    );
    if (sharedGuideExample) {
      expect(
        example.input === sharedGuideExample.input,
        `${slug} article and guide share exactly the same input`,
      );
    }
  }
  expect(
    !listeners.has("storage"),
    "the storage adapter itself never installs a shared storage listener",
  );
} finally {
  cancelScheduledStoredGraphWrite();
  uninstallStorageFlushListeners();
  for (const key of ["window", "document", "navigator"] as const) {
    const descriptor = originalDescriptors[key];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}

finish();
