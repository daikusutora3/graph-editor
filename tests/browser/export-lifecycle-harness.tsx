import { Provider, createStore } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GraphCanvasProvider } from "../../features/graph-editor/canvas/GraphCanvasProvider";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import {
  createGraphExportTask,
  exportGraph,
  type GraphExportFormat,
} from "../../features/graph-editor/io/export-graph";
import { editorPanelAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { syncExternalGraphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import { EditorChrome } from "../../features/graph-editor/ui/chrome/EditorChrome";
import {
  cancelScheduledStoredGraphWrite,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";

const tasks: {
  graph: GraphModel;
  format: GraphExportFormat;
  steps: number;
  done: boolean;
  error: boolean;
}[] = [];
const downloads: { blob: Blob; fileName: string }[] = [];
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  wrapExportTask: (
    graph: GraphModel,
    format: GraphExportFormat,
    task: Generator<void, string>,
  ) => {
    const record = { graph, format, steps: 0, done: false, error: false };
    tasks.push(record);
    function* instrumented(): Generator<void, string> {
      while (true) {
        record.steps += 1;
        try {
          if (graph.nodes[0]?.id === "__throw__" && record.steps === 2)
            throw new Error("Injected export task failure");
          const step = task.next();
          if (step.done) {
            record.done = true;
            return step.value;
          }
        } catch (error) {
          record.error = true;
          throw error;
        }
        yield;
      }
    }
    return instrumented();
  },
  captureExportDownload: (blob: Blob, fileName: string) =>
    downloads.push({ blob, fileName }),
});

export async function verifyExportLifecycle() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  let assertions = 0;
  let mounted = false;
  const assert = (condition: unknown, message: string) => {
    assertions += 1;
    if (!condition) throw new Error(message);
  };
  const graphA: GraphModel = {
    ...createEmptyGraphModel({ autoEdgeRouting: false, weighted: true }),
    nodes: [
      { id: "a", label: "A_1", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 100, y: 50 },
      { id: "c", label: "C", order: 2, x: 50, y: 100 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", weight: "5" },
      { id: "bc", source: "b", target: "c", weight: "7" },
    ],
  };
  const graphB = {
    ...graphA,
    nodes: graphA.nodes.map((node, index) =>
      index === 0 ? { ...node, label: "LATEST" } : node,
    ),
  };
  const graphC = {
    ...graphA,
    nodes: graphA.nodes.map((node, index) =>
      index === 0 ? { ...node, label: "CANCELED" } : node,
    ),
  };
  const descriptors = {
    raf: Object.getOwnPropertyDescriptor(window, "requestAnimationFrame"),
    caf: Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame"),
    now: Object.getOwnPropertyDescriptor(performance, "now"),
    timeout: Object.getOwnPropertyDescriptor(window, "setTimeout"),
    clearTimeout: Object.getOwnPropertyDescriptor(window, "clearTimeout"),
    clipboard: Object.getOwnPropertyDescriptor(navigator, "clipboard"),
    locks: Object.getOwnPropertyDescriptor(navigator, "locks"),
    storage: Object.getOwnPropertyDescriptor(window, "localStorage"),
  };
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let clock = 0;
  let nextId = 1;
  let deferClipboard = false;
  const copies: { text: string; resolve?: () => void }[] = [];
  const storage = new Map([
    ["graph-editor-graph", serializeGraphModel(graphA)],
  ]);
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: (id: number) => frames.delete(id),
  });
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => {
      clock += 5;
      return clock;
    },
  });
  Object.defineProperty(window, "setTimeout", {
    configurable: true,
    value: (callback: () => void, delay = 0) => {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
  });
  Object.defineProperty(window, "clearTimeout", {
    configurable: true,
    value: (id: number) => timers.delete(id),
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        const request: { text: string; resolve?: () => void } = { text };
        copies.push(request);
        return deferClipboard
          ? new Promise<void>((resolve) => {
              request.resolve = resolve;
            })
          : Promise.resolve();
      },
    },
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, callback: () => void) => callback(),
    },
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });

  const output = () => host.querySelector("pre[aria-label^='Exported']");
  const exportButtons = () =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].filter((button) =>
      /^(Copy|Copied|Copy failed|Save as \.)/.test(
        button.textContent?.trim() ?? "",
      ),
    );
  const copyButton = () =>
    exportButtons().find(
      (button) => !button.textContent?.trim().startsWith("Save"),
    )!;
  const frame = async () => {
    const queued = [...frames];
    await act(async () => {
      for (const [id, callback] of queued) {
        if (frames.delete(id)) callback(clock);
      }
    });
  };
  const settle = async () => {
    for (
      let count = 0;
      count < 2000 && output()?.getAttribute("aria-busy") === "true";
      count += 1
    )
      // Each frame must settle React before advancing the same generator again.
      // oxlint-disable-next-line no-await-in-loop
      await frame();
    assert(
      output()?.getAttribute("aria-busy") !== "true",
      "export settles within deterministic task-step budget",
    );
  };
  const changeFormat = async (format: GraphExportFormat) => {
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>(
        "select[aria-label='Export format']",
      )!;
      select.value = format;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  const replace = async (graph: GraphModel) => {
    await act(async () => store.set(syncExternalGraphAtom, graph));
  };
  const open = async () => {
    await act(async () => store.set(editorPanelAtom, "export"));
  };
  const close = async () => {
    await act(async () => store.set(editorPanelAtom, null));
    await act(async () => {
      for (const [id, timer] of timers)
        if (timer.delay <= 180 && timers.delete(id)) timer.callback();
    });
    assert(!output(), "export panel leaves after its exit animation");
  };
  const invokeStale = async (callbacks: FrameRequestCallback[]) => {
    await act(async () => callbacks.forEach((callback) => callback(clock)));
  };
  try {
    for (const format of [
      "edge-list",
      "adjacency-list",
      "adjacency-matrix",
      "json",
      "tikz",
    ] as const) {
      const before = JSON.stringify(graphA);
      const task = createGraphExportTask(graphA, format);
      let step = task.next();
      while (!step.done) step = task.next();
      assert(
        step.value === exportGraph(graphA, format) &&
          JSON.stringify(graphA) === before,
        `${format} task preserves synchronous output and model`,
      );
    }
    tasks.length = 0;
    await act(async () => {
      root.render(
        <Provider store={store}>
          <I18nProvider initialLocale="en">
            <GraphCanvasProvider>
              <EditorChrome />
            </GraphCanvasProvider>
          </I18nProvider>
        </Provider>,
      );
    });
    mounted = true;
    await replace(graphA);
    await open();
    await changeFormat("tikz");
    assert(
      output()?.getAttribute("aria-busy") === "true" &&
        exportButtons().length === 2 &&
        exportButtons().every((button) => button.disabled),
      "pending TikZ marks output busy and disables copy/download",
    );
    await act(async () => exportButtons().forEach((button) => button.click()));
    assert(
      copies.length === 0 && downloads.length === 0,
      "disabled export actions cannot publish stale or empty text",
    );
    await frame();
    const canceledA = tasks.at(-1)!;
    const beforeCancel = canceledA.steps;
    const staleA = [...frames.values()];
    await replace(graphB);
    await invokeStale(staleA);
    assert(
      canceledA.steps === beforeCancel && !canceledA.done,
      "graph changes cancel old generator even if an already queued RAF callback fires",
    );
    await settle();
    assert(
      output()?.textContent === exportGraph(graphB, "tikz") &&
        exportButtons().every((button) => !button.disabled),
      "only latest graph output becomes actionable",
    );
    await act(async () => copyButton().click());
    assert(
      copies.at(-1)?.text === exportGraph(graphB, "tikz") &&
        copyButton().textContent?.trim() === "Copied",
      "copy publishes latest generated content and reports success",
    );
    await replace(graphA);
    assert(
      copyButton().textContent?.trim() === "Copy",
      "copied feedback resets when graph changes",
    );
    await settle();
    await act(async () =>
      exportButtons()
        .find((button) => button.textContent?.trim().startsWith("Save"))!
        .click(),
    );
    assert(
      (await downloads.at(-1)?.blob.text()) === exportGraph(graphA, "tikz") &&
        downloads.at(-1)?.fileName.endsWith(".tex"),
      "download publishes latest TeX with its format extension",
    );
    const cachedTaskCount = tasks.length;
    await close();
    await open();
    assert(
      tasks.length === cachedTaskCount &&
        output()?.textContent === exportGraph(graphA, "tikz") &&
        output()?.getAttribute("aria-busy") === "false",
      "reopening same graph reuses completed TeX cache",
    );

    await replace(graphC);
    await frame();
    const canceledFormat = tasks.at(-1)!;
    const formatSteps = canceledFormat.steps;
    const staleFormat = [...frames.values()];
    await changeFormat("json");
    await invokeStale(staleFormat);
    assert(
      canceledFormat.steps === formatSteps &&
        output()?.textContent === serializeGraphModel(graphC),
      "format switch cancels old work and keeps JSON content",
    );
    deferClipboard = true;
    await act(async () => copyButton().click());
    const delayedCopy = copies.at(-1)!;
    await changeFormat("edge-list");
    await act(async () => delayedCopy.resolve!());
    assert(
      copyButton().textContent?.trim() === "Copy",
      "late clipboard completion cannot mark another format copied",
    );
    deferClipboard = false;
    await act(async () => copyButton().click());
    assert(
      copyButton().textContent?.trim() === "Copied" &&
        copies.at(-1)?.text === exportGraph(graphC, "edge-list"),
      "current format copy succeeds after ignoring stale completion",
    );

    await changeFormat("tikz");
    await frame();
    const canceledClose = tasks.at(-1)!;
    const closeSteps = canceledClose.steps;
    const staleClose = [...frames.values()];
    await close();
    await invokeStale(staleClose);
    assert(
      canceledClose.steps === closeSteps,
      "closing cancels pending work when panel presence ends",
    );
    await open();
    assert(
      output()?.getAttribute("aria-busy") === "true",
      "reopening canceled work restarts generation instead of showing partial text",
    );
    await settle();
    assert(
      output()?.textContent === exportGraph(graphC, "tikz"),
      "restarted export completes exact latest text",
    );

    await replace(createEmptyGraphModel());
    assert(
      output()?.getAttribute("aria-busy") === "false" &&
        exportButtons().every((button) => button.disabled),
      "empty graph has no pending task and cannot copy/download",
    );
    const failing = {
      ...graphA,
      nodes: graphA.nodes.map((node, index) =>
        index === 0 ? { ...node, id: "__throw__" } : node,
      ),
      edges: [],
    };
    await replace(failing);
    await settle();
    assert(
      tasks.at(-1)?.error &&
        exportButtons().every((button) => button.disabled) &&
        !output()?.textContent?.includes("\\endgroup"),
      "task errors stop generation and leave actions disabled",
    );
    const failedTaskCount = tasks.length;
    await close();
    await open();
    assert(
      tasks.length === failedTaskCount &&
        output()?.getAttribute("aria-busy") === "false",
      "reopening failed graph reuses its blocked result without restarting work",
    );
    const oversized = {
      ...createEmptyGraphModel({ autoEdgeRouting: false }),
      nodes: Array.from({ length: 400 }, (_, order) => ({
        id: `large${order}`,
        label: "~".repeat(256),
        order,
        x: order * 80,
        y: 0,
      })),
    };
    await replace(oversized);
    await settle();
    assert(
      tasks.at(-1)?.error &&
        exportButtons().every((button) => button.disabled) &&
        output()?.getAttribute("aria-busy") === "false",
      "real TeX expansion exceeding input limit becomes a blocked result",
    );
    const parallel = {
      ...graphA,
      edges: [graphA.edges[0]!, { ...graphA.edges[0]!, id: "duplicate" }],
    };
    await replace(parallel);
    await changeFormat("adjacency-list");
    assert(
      exportButtons().every((button) => button.disabled) &&
        output()?.getAttribute("aria-busy") === "false",
      "synchronous export restrictions retain blocked behavior",
    );

    await replace(graphB);
    await changeFormat("tikz");
    await frame();
    const canceledUnmount = tasks.at(-1)!;
    const unmountSteps = canceledUnmount.steps;
    const staleUnmount = [...frames.values()];
    await act(async () => root.unmount());
    mounted = false;
    await invokeStale(staleUnmount);
    assert(
      canceledUnmount.steps === unmountSteps,
      "unmount cancels old task and stale callbacks cannot publish",
    );
    return {
      verified: true,
      assertions,
      tasks: tasks.length,
      clipboardRequests: copies.length,
      downloads: downloads.length,
    };
  } finally {
    cancelScheduledStoredGraphWrite();
    uninstallStorageFlushListeners();
    if (mounted) await act(async () => root.unmount());
    host.remove();
    for (const [target, key, descriptor] of [
      [window, "requestAnimationFrame", descriptors.raf],
      [window, "cancelAnimationFrame", descriptors.caf],
      [performance, "now", descriptors.now],
      [window, "setTimeout", descriptors.timeout],
      [window, "clearTimeout", descriptors.clearTimeout],
      [navigator, "clipboard", descriptors.clipboard],
      [navigator, "locks", descriptors.locks],
      [window, "localStorage", descriptors.storage],
    ] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  }
}
Object.assign(globalThis, { verifyExportLifecycle });
