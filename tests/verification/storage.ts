import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  GRAPH_STORAGE_KEY,
  MAX_STORED_GRAPH_CHARS,
  MAX_STORED_GRAPH_NODES,
  parseStoredGraph,
  serializeStoredGraphForWrite,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import {
  graphAtom,
  graphStorageReadyAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Storage");

verifyGraphStorageBootstrap();
verifyStoredGraphSizeLimit();

finish();

function verifyGraphStorageBootstrap() {
  for (const scenario of [
    {
      name: "valid stored graph",
      rawValue: JSON.stringify(graphFixture()),
      expectedNodeCount: 2,
    },
    { name: "missing storage", rawValue: null, expectedNodeCount: 0 },
    { name: "invalid storage", rawValue: "not json", expectedNodeCount: 0 },
    {
      name: "valid empty storage",
      rawValue: JSON.stringify(createEmptyGraphModel()),
      expectedNodeCount: 0,
    },
    {
      name: "storage read failure",
      rawValue: JSON.stringify(graphFixture()),
      expectedNodeCount: 0,
      throwOnGet: true,
    },
  ]) {
    withStorageEnvironment(scenario.rawValue, (env) => {
      env.throwOnGet = Boolean(scenario.throwOnGet);
      const bootstrapStore = createStore();
      const unmount = bootstrapStore.sub(graphStorageReadyAtom, () => {});

      expect(
        bootstrapStore.get(graphStorageReadyAtom),
        `${scenario.name}: bootstrap should mark graph storage ready`,
      );
      expect(
        bootstrapStore.get(graphAtom).nodes.length ===
          scenario.expectedNodeCount,
        `${scenario.name}: bootstrap should use the expected graph`,
      );
      expect(
        env.setTimeoutCalls === 0 &&
          env.setItemCalls === 0 &&
          env.removeItemCalls === 0,
        `${scenario.name}: bootstrap should not write to storage`,
      );

      unmount();
    });
  }
}

function verifyStoredGraphSizeLimit() {
  expect(
    serializeStoredGraphForWrite(graphFixture()) !== null,
    "storage serializer should keep normal graphs",
  );

  const oversizedGraph = {
    ...createEmptyGraphModel(),
    nodes: [
      {
        id: "oversized",
        label: "x".repeat(MAX_STORED_GRAPH_CHARS),
        order: 0,
        x: 0,
        y: 0,
      },
    ],
  };

  expect(
    serializeStoredGraphForWrite(oversizedGraph) === null,
    "storage serializer should skip oversized graphs",
  );
  expect(
    parseStoredGraph(JSON.stringify(oversizedGraph)) === null,
    "storage parser should skip oversized raw values before JSON parsing",
  );

  const tooManyNodes = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: MAX_STORED_GRAPH_NODES + 1 }, (_, index) => ({
      id: `n${index}`,
      label: String(index),
      order: index,
      x: 0,
      y: 0,
    })),
  };

  expect(
    serializeStoredGraphForWrite(tooManyNodes) === null,
    "storage serializer should skip graphs with too many nodes before stringify",
  );
}

type StorageEnvironment = {
  removeItemCalls: number;
  setItemCalls: number;
  setTimeoutCalls: number;
  throwOnGet: boolean;
};

function withStorageEnvironment(
  rawValue: string | null,
  callback: (env: StorageEnvironment) => void,
) {
  const globals = globalThis as typeof globalThis & {
    document?: Document;
    window?: Window;
  };
  const previousDocument = globals.document;
  const previousWindow = globals.window;
  const env: StorageEnvironment = {
    removeItemCalls: 0,
    setItemCalls: 0,
    setTimeoutCalls: 0,
    throwOnGet: false,
  };

  const localStorage = {
    getItem(key: string) {
      if (env.throwOnGet) {
        throw new Error("localStorage unavailable");
      }

      return key === GRAPH_STORAGE_KEY ? rawValue : null;
    },
    removeItem(_key: string) {
      env.removeItemCalls += 1;
    },
    setItem(_key: string, _value: string) {
      env.setItemCalls += 1;
    },
  };

  const fakeWindow = {
    addEventListener() {},
    clearTimeout() {},
    localStorage,
    removeEventListener() {},
    setTimeout() {
      env.setTimeoutCalls += 1;
      return 1;
    },
  } as unknown as Window;
  const fakeDocument = {
    addEventListener() {},
    removeEventListener() {},
    visibilityState: "visible",
  } as unknown as Document;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });

  try {
    callback(env);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
}

function graphFixture(): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  };
}
