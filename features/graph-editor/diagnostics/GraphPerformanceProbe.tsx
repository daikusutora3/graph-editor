"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";

import { useGraphCanvasApi } from "../canvas/GraphCanvasProvider";
import { GRAPH_STORAGE_KEY } from "../adapters/browser/stored-graph";
import {
  cloneGraphModel,
  createBenchmarkCases,
  createBenchmarkGraph,
} from "./graph-performance-benchmark-cases";
import type { GraphModel } from "../core/graph/model";
import {
  applyManualLayoutAtom,
  resetEditorSessionAtom,
  updateGraphSettingsAtom,
} from "../shell/state/editor-actions";
import { selectionAtom } from "../shell/state/editor-atoms";
import {
  copyGraphSelectionAtom,
  cycleSelectionColorAtom,
  pasteGraphClipboardAtom,
  selectAllGraphAtom,
} from "../shell/state/editor-shortcut-actions";
import { graphAtom, syncExternalGraphAtom } from "../shell/state/graph-atoms";
import {
  deleteSelectionAtom,
  executeCommandAtom,
  redoAtom,
  undoAtom,
} from "../shell/state/history-atoms";
import { graphSize, summarizeMetrics } from "./graph-performance-summary";
import type {
  BenchmarkCase,
  GraphPerformanceEvent,
  GraphPerformanceMetric,
  GraphPerformanceRunOptions,
  GraphPerformanceSuite,
} from "./graph-performance-types";
import { roundMs } from "./graph-performance-events";

declare global {
  interface Window {
    __graphPerfAutorunStarted?: boolean;
    __graphPerf?: {
      makeGraph: (nodes: number, edges: number) => GraphModel;
      runSuite: (
        options?: GraphPerformanceRunOptions,
      ) => Promise<GraphPerformanceSuite>;
      events: GraphPerformanceEvent[];
    };
  }
}

const SETTLE_FRAMES = 3;

export function GraphPerformanceProbe() {
  const graph = useAtomValue(graphAtom);
  const graphRef = useRef(graph);
  const [resultJson, setResultJson] = useState<string | null>(null);
  const { exportPng, fitAfterNextGraphRender } = useGraphCanvasApi();
  const executeCommand = useSetAtom(executeCommandAtom);
  const applyManualLayout = useSetAtom(applyManualLayoutAtom);
  const copySelection = useSetAtom(copyGraphSelectionAtom);
  const cycleSelectionColor = useSetAtom(cycleSelectionColorAtom);
  const deleteSelection = useSetAtom(deleteSelectionAtom);
  const pasteClipboard = useSetAtom(pasteGraphClipboardAtom);
  const redo = useSetAtom(redoAtom);
  const resetEditorSession = useSetAtom(resetEditorSessionAtom);
  const selectAll = useSetAtom(selectAllGraphAtom);
  const setSelection = useSetAtom(selectionAtom);
  const syncExternalGraph = useSetAtom(syncExternalGraphAtom);
  const undo = useSetAtom(undoAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("perf") !== "1") {
      return;
    }

    window.__graphPerfEvents = [];

    const graphPerfApi = {
      events: window.__graphPerfEvents,
      makeGraph: createBenchmarkGraph,
      runSuite: async (options: GraphPerformanceRunOptions = {}) => {
        const runs = options.runs ?? 5;
        const warmups = options.warmups ?? 1;
        const originalGraph = cloneGraphModel(graphRef.current);
        const storedGraphSnapshot = readStoredGraphSnapshot();
        const suiteStart = performance.now();
        const metrics: GraphPerformanceMetric[] = [];
        const cases = createBenchmarkCases({
          applyManualLayout,
          copySelection,
          cycleSelectionColor,
          deleteSelection,
          executeCommand,
          exportPng,
          fitAfterNextGraphRender,
          graphRef,
          pasteClipboard,
          redo,
          selectAll,
          setSelection,
          undo,
          updateGraphSettings,
        });
        const suiteGraphSize = cases.reduce(
          (largest, benchmarkCase) => ({
            edges: Math.max(largest.edges, benchmarkCase.graph.edges.length),
            nodes: Math.max(largest.nodes, benchmarkCase.graph.nodes.length),
          }),
          { edges: 0, nodes: 0 },
        );

        try {
          for (const benchmarkCase of cases) {
            for (let index = 0; index < warmups; index += 1) {
              await measureBenchmarkCase(benchmarkCase, index, true, {
                metrics,
                resetCase,
              });
            }

            for (let index = 0; index < runs; index += 1) {
              await measureBenchmarkCase(benchmarkCase, index, false, {
                metrics,
                resetCase,
              });
            }
          }
        } finally {
          syncExternalGraph(originalGraph);
          resetEditorSession();
          restoreStoredGraphSnapshot(storedGraphSnapshot);
          await settleBrowserFrames(2);
        }

        const suite = {
          metrics,
          summaries: summarizeMetrics(metrics),
          summary: {
            edges: suiteGraphSize.edges,
            nodes: suiteGraphSize.nodes,
            totalMs: roundMs(performance.now() - suiteStart),
            userAgent: navigator.userAgent,
          },
        };

        setResultJson(JSON.stringify(suite, null, 2));
        return suite;
      },
    };

    const resetCase = async (benchmarkCase: BenchmarkCase) => {
      syncExternalGraph(cloneGraphModel(benchmarkCase.graph));
      resetEditorSession();
      await settleBrowserFrames(2);
    };

    window.__graphPerf = graphPerfApi;

    if (params.get("autorun") === "1" && !window.__graphPerfAutorunStarted) {
      window.__graphPerfAutorunStarted = true;
      void graphPerfApi.runSuite({
        runs: readPositiveIntegerParam(params, "runs"),
        warmups: readPositiveIntegerParam(params, "warmups"),
      });
    }

    return () => {
      delete window.__graphPerf;
    };
  }, [
    applyManualLayout,
    copySelection,
    cycleSelectionColor,
    deleteSelection,
    executeCommand,
    exportPng,
    fitAfterNextGraphRender,
    pasteClipboard,
    redo,
    resetEditorSession,
    selectAll,
    setSelection,
    syncExternalGraph,
    undo,
    updateGraphSettings,
  ]);

  if (resultJson === null) {
    return null;
  }

  return (
    <pre
      data-testid="graph-performance-result"
      className="sr-only"
      aria-live="polite"
    >
      {resultJson}
    </pre>
  );
}

async function measureBenchmarkCase(
  benchmarkCase: BenchmarkCase,
  run: number,
  warmup: boolean,
  {
    metrics,
    resetCase,
  }: {
    metrics: GraphPerformanceMetric[];
    resetCase: (benchmarkCase: BenchmarkCase) => Promise<void>;
  },
) {
  await resetCase(benchmarkCase);

  const events = window.__graphPerfEvents ?? [];
  events.length = 0;

  const actionStart = performance.now();
  let ok = true;
  let result: Record<string, number | string | boolean | null> | undefined;

  try {
    result = (await benchmarkCase.action()) ?? undefined;
  } catch (error) {
    ok = false;
    result = { error: errorMessage(error) };
  }

  const actionMs = performance.now() - actionStart;
  const settleStart = performance.now();

  try {
    await settleBrowserFrames();
  } catch (error) {
    ok = false;
    result = { error: errorMessage(error) };
  }

  const settleMs = performance.now() - settleStart;

  metrics.push({
    actionMs: roundMs(actionMs),
    durationMs: roundMs(actionMs + settleMs),
    events: events.map((event) => ({ ...event })),
    family: benchmarkCase.family,
    graph: graphSize(benchmarkCase.graph),
    name: benchmarkCase.name,
    ok,
    result,
    run,
    settleMs: roundMs(settleMs),
    warmup,
  });
}

function readStoredGraphSnapshot() {
  try {
    return window.localStorage.getItem(GRAPH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function restoreStoredGraphSnapshot(snapshot: string | null) {
  try {
    if (snapshot === null) {
      window.localStorage.removeItem(GRAPH_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(GRAPH_STORAGE_KEY, snapshot);
  } catch {
    // Keep performance probes non-invasive in restricted storage modes.
  }
}

function readPositiveIntegerParam(
  params: URLSearchParams,
  key: "runs" | "warmups",
) {
  const value = Number(params.get(key));

  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function settleBrowserFrames(frames = SETTLE_FRAMES) {
  return new Promise<void>((resolve) => {
    let remainingFrames = frames;

    const tick = () => {
      remainingFrames -= 1;

      if (remainingFrames <= 0) {
        resolve();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown benchmark error";
}
