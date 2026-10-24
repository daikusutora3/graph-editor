import { Provider, createStore } from "jotai";
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

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
import { GraphCanvasProvider } from "../../features/graph-editor/canvas/GraphCanvasProvider";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import {
  I18nProvider,
  useI18n,
} from "../../features/graph-editor/i18n/I18nProvider";
import { integrityCopy } from "../../features/graph-editor/i18n/integrity-copy";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  commandErrorAtom,
  historyAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { StorageNotice } from "../../features/graph-editor/ui/chrome/StorageNotice";
import { useGraphStarterState } from "../../features/graph-editor/workflows/starter/graph-starter-state";

const calls = { input: 0, stored: 0, key: 0 };
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  recordDormantWork: (kind: keyof typeof calls) => calls[kind]++,
});

export async function verifyDormantWork() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  const validModel = {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: 1_000 }, (_, order) => ({
      id: `n${order}`,
      label: "頂点".repeat(40),
      order,
      x: order * 20,
      y: 0,
    })),
    edges: Array.from({ length: 5_000 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 1_000}`,
      target: `n${(index + 1) % 1_000}`,
      label: "辺".repeat(80),
    })),
  };
  const validInput = serializeGraphModel(validModel);
  const invalidInput = validInput.slice(0, -1);
  const copy = integrityCopy.en;
  let starter: ReturnType<typeof useGraphStarterState> | undefined;
  let changeLocale: ReturnType<typeof useI18n>["setLocale"] | undefined;
  let closed = 0;
  const textareaRef = { current: null };
  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const current = () => {
    assert(Boolean(starter), "starter probe mounted");
    return starter!;
  };
  const resetCalls = () => {
    calls.input = calls.stored = calls.key = 0;
  };
  const settle = async () => {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 175)));
  };
  function StarterProbe({
    open,
    previewEnabled,
  }: {
    open: boolean;
    previewEnabled: boolean;
  }) {
    const value = useGraphStarterState({
      open,
      previewEnabled,
      onClose: () => closed++,
      textareaRef,
    });
    useLayoutEffect(() => {
      starter = value;
    }, [value]);
    return null;
  }
  function LocaleProbe() {
    const { setLocale } = useI18n();
    useLayoutEffect(() => {
      changeLocale = setLocale;
    }, [setLocale]);
    return <StorageNotice />;
  }
  const renderStarter = async (open: boolean, previewEnabled: boolean) => {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <GraphCanvasProvider>
            <StarterProbe open={open} previewEnabled={previewEnabled} />
          </GraphCanvasProvider>
        </Provider>,
      );
    });
  };
  const setSettings = async (directed: boolean) => {
    await act(async () => {
      const graph = store.get(graphAtom);
      store.set(syncExternalGraphAtom, {
        ...graph,
        settings: { ...graph.settings, directed },
      });
    });
  };
  const hasButton = (label: string) =>
    [...host.querySelectorAll("button")].some(
      (button) => button.textContent === label,
    );
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
  const originalStorage = Object.getOwnPropertyDescriptor(
    window,
    "localStorage",
  );
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  const workingLocks = {
    request: async (_key: string, callback: () => void) => callback(),
  };
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: workingLocks,
  });
  try {
    localStorage.setItem(GRAPH_STORAGE_KEY, validInput);
    await renderStarter(true, true);
    await act(async () => current().setInput(validInput));
    await settle();
    assert(
      current().preview?.model.nodes.length === 1_000 &&
        current().preview?.model.edges.length === 5_000,
      "large valid input has an active preview",
    );
    await renderStarter(false, true);
    resetCalls();
    await setSettings(true);
    assert(calls.input === 1, "closing paste panel keeps its preview live");
    assert(
      current().preview?.model.nodes.length === 1_000,
      "closing animation retains the paste preview",
    );
    await renderStarter(false, false);
    resetCalls();
    await setSettings(false);
    await setSettings(true);
    await settle();
    assert(
      calls.input === 0 && calls.key === 0,
      "closed starter skips parsing and serializing retained input keys",
    );
    assert(current().inputText === validInput, "closed input remains retained");

    await renderStarter(true, true);
    await settle();
    assert(
      current().inputText === "" && current().preview === null,
      "reopening paste resets input and settles the preview empty",
    );
    await renderStarter(true, false);
    resetCalls();
    await act(async () => current().setInput(invalidInput));
    await settle();
    await setSettings(false);
    assert(
      calls.input === 0 && calls.key === 0,
      "sample view skips large invalid paste parsing",
    );
    await renderStarter(true, true);
    assert(calls.input === 1, "returning to paste evaluates retained input");
    assert(
      current().preview?.status === "failure" &&
        current().visibleIssues.length > 0,
      "returning to paste preserves invalid-input diagnostics",
    );
    resetCalls();
    await act(async () => current().setInput(validInput));
    await renderStarter(true, false);
    await settle();
    assert(calls.input === 0, "a hidden pending debounce never parses");
    await act(async () => current().applyText());
    assert(
      calls.input === 1 && store.get(graphAtom).edges.length === 5_000,
      "Apply directly validates current text while preview is dormant",
    );
    assert(closed === 1, "successful Apply still closes the starter");
    const appliedGraph = store.get(graphAtom);
    await act(async () => current().setInput(invalidInput));
    await act(async () => current().applyText());
    assert(
      closed === 1 &&
        current().issues.length > 0 &&
        store.get(graphAtom) === appliedGraph,
      "invalid Apply leaves the graph and error feedback intact",
    );

    await act(async () => {
      acceptStorageBaseline(validInput);
      root.render(
        <Provider store={store}>
          <I18nProvider initialLocale="en">
            <GraphCanvasProvider>
              <LocaleProbe />
            </GraphCanvasProvider>
          </I18nProvider>
        </Provider>,
      );
    });
    resetCalls();
    await act(async () =>
      store.set(commandErrorAtom, { message: "rejected", reason: "operation" }),
    );
    assert(
      calls.stored === 0,
      "saved command-error notice skips stored parsing",
    );
    await act(async () => observeExternalStorage(validInput));

    const conflictingInput = serializeGraphModel({
      ...validModel,
      settings: { ...validModel.settings, directed: true },
    });
    await act(async () => observeExternalStorage(conflictingInput));
    assert(calls.stored === 1, "new conflict validates its exact raw snapshot");
    assert(hasButton(copy.load), "valid conflict can load");
    await act(async () =>
      store.set(commandErrorAtom, {
        message: "another error",
        reason: "operation",
      }),
    );
    await act(async () => changeLocale!("ja"));
    await act(async () => changeLocale!("en"));
    assert(calls.stored === 1, "same conflict reuses validation on rerenders");
    await act(async () => observeExternalStorage(invalidInput));
    assert(calls.stored === 2, "changed conflicting raw is validated again");
    assert(
      !hasButton(copy.load) && hasButton(copy.raw) && hasButton(copy.fresh),
      "invalid conflict retains raw-backup and fresh-document actions",
    );
    await act(async () => observeExternalStorage(null));
    assert(
      calls.stored === 3 && !hasButton(copy.raw),
      "deleted conflicting raw is checked and has no original backup",
    );
    await act(async () => acceptStorageBaseline(validInput));
    resetCalls();
    const graphBeforeConflict = serializeGraphModel(store.get(graphAtom));
    const historyBeforeConflict = store.get(historyAtom);
    await act(async () => observeExternalStorage(conflictingInput));
    assert(
      calls.stored === 1,
      "returning to conflict validates the new snapshot",
    );
    assert(
      serializeGraphModel(store.get(graphAtom)) === graphBeforeConflict &&
        store.get(historyAtom) === historyBeforeConflict,
      "conflict keeps the current graph and undo history intact",
    );
    const createObjectURL = URL.createObjectURL;
    const clickAnchor = HTMLAnchorElement.prototype.click;
    let downloaded: Blob | undefined;
    let downloads = 0;
    try {
      URL.createObjectURL = (blob) => {
        if (blob instanceof Blob) downloaded = blob;
        return createObjectURL.call(URL, blob);
      };
      HTMLAnchorElement.prototype.click = function () {
        if (this.download === "graph-backup.json") {
          downloads++;
          return;
        }
        clickAnchor.call(this);
      };
      await act(async () => {
        host.querySelectorAll("button").forEach((button) => {
          if (button.textContent === copy.backup) button.click();
        });
      });
      assert(
        downloads === 1 &&
          downloaded?.type === "application/json" &&
          (await downloaded.text()) === graphBeforeConflict,
        "download backs up this tab's graph as JSON",
      );
      assert(
        getStorageSnapshot().status === "conflict" &&
          serializeGraphModel(store.get(graphAtom)) === graphBeforeConflict &&
          store.get(historyAtom) === historyBeforeConflict,
        "download leaves the conflict, current graph and undo history intact",
      );
    } finally {
      URL.createObjectURL = createObjectURL;
      HTMLAnchorElement.prototype.click = clickAnchor;
    }
    await act(async () => {
      host.querySelectorAll("button").forEach((button) => {
        if (button.textContent === copy.load) button.click();
      });
    });
    assert(
      store.get(graphAtom).settings.directed,
      "Load applies the same validated conflict snapshot",
    );
    assert(
      getStorageSnapshot().status === "saved",
      "switching explicitly resolves the conflict",
    );
    await act(async () => store.set(undoAtom));
    assert(
      serializeGraphModel(store.get(graphAtom)) === graphBeforeConflict,
      "Undo restores the graph from before switching tabs",
    );

    localStorage.setItem(GRAPH_STORAGE_KEY, invalidInput);
    resetCalls();
    await act(async () => readStoredGraph());
    assert(calls.stored === 1, "invalid notice does not reparse startup raw");
    assert(hasButton(copy.raw), "invalid raw can be backed up");
    localStorage.setItem(GRAPH_STORAGE_KEY, validInput);
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    resetCalls();
    await act(async () => readStoredGraph());
    assert(
      calls.stored === 1,
      "unavailable notice avoids second startup parse",
    );
    assert(hasButton(copy.backup), "unavailable backup is retained");
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async () => {
          throw new Error("quota");
        },
      },
    });
    await act(async () => acceptStorageBaseline(validInput));
    resetCalls();
    await act(async () => {
      scheduleStoredGraphWrite(validModel, validInput);
      await flushStoredGraphWrite();
    });
    assert(
      calls.stored === 0 && hasButton(copy.retry),
      "failed-save retry skips parsing",
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: workingLocks,
    });
    await act(async () => {
      host.querySelectorAll("button").forEach((button) => {
        if (button.textContent === copy.retry) button.click();
      });
    });
    assert(
      !hasButton(copy.retry) &&
        localStorage.getItem(GRAPH_STORAGE_KEY) === validInput,
      "Retry saves the pending snapshot after storage recovers",
    );
    return { verified: true, assertions: "starter and storage lifecycle" };
  } finally {
    cancelScheduledStoredGraphWrite();
    uninstallStorageFlushListeners();
    await act(async () => root.unmount());
    host.remove();
    if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks);
    else Reflect.deleteProperty(navigator, "locks");
    if (originalStorage)
      Object.defineProperty(window, "localStorage", originalStorage);
    else Reflect.deleteProperty(window, "localStorage");
  }
}

Object.assign(globalThis, { verifyDormantWork });
