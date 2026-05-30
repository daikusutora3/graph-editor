import type { RefObject } from "react";

import { flushStoredGraphWrite } from "../adapters/browser/stored-graph";
import type { GraphCanvasExportOptions } from "../canvas/graph-canvas-types";
import { createEmptyGraphModel } from "../core/graph/graph-factory";
import {
  addEdgeCommand,
  addNodeCommand,
  createMoveNodesCommand,
  updateEdgeCommand,
  updateNodeCommand,
} from "../core/graph/graph-intents";
import type {
  GraphIntent,
  GraphModel,
  GraphSettings,
  NodeId,
  NodePositionMap,
} from "../core/graph/model";
import { exportGraph, type GraphExportFormat } from "../io/export-graph";
import type { LayoutKind } from "../layouts/manual-layouts";
import type { SelectionState } from "../shell/state/editor-state";
import type { BenchmarkCase } from "./graph-performance-types";

export type BenchmarkActions = {
  applyManualLayout: (kind: LayoutKind) => void;
  copySelection: () => void;
  cycleSelectionColor: () => void;
  deleteSelection: () => void;
  executeCommand: (intent: GraphIntent) => void;
  exportPng: (detail: GraphCanvasExportOptions) => Promise<Blob>;
  fitAfterNextGraphRender: () => void;
  graphRef: RefObject<GraphModel>;
  pasteClipboard: () => void;
  redo: () => void;
  selectAll: () => void;
  setSelection: (selection: SelectionState) => void;
  undo: () => void;
  updateGraphSettings: (patch: Partial<GraphSettings>) => void;
};

export function createBenchmarkGraph(nodesCount: number, edgesCount: number) {
  const columns = Math.ceil(Math.sqrt(nodesCount));
  const nodes = Array.from({ length: nodesCount }, (_, index) => ({
    id: `n${index}` as NodeId,
    label: String(index),
    order: index,
    x: (index % columns) * 72,
    y: Math.floor(index / columns) * 64,
  }));
  const edges = Array.from({ length: edgesCount }, (_, index) => ({
    id: `e${index}`,
    label: index % 7 === 0 ? `e${index}` : undefined,
    source: `n${index % nodesCount}`,
    target: `n${(index * 17 + 11) % nodesCount}`,
    weight: String((index % 9) + 1),
  }));

  return {
    ...createEmptyGraphModel({
      allowMultiEdges: true,
      allowSelfLoops: true,
      autoEdgeRouting: true,
      weightKind: "number",
    }),
    edges,
    nodes,
  };
}

export function cloneGraphModel(graph: GraphModel): GraphModel {
  return {
    ...graph,
    edges: graph.edges.map((edge) => ({ ...edge })),
    nodes: graph.nodes.map((node) => ({ ...node })),
    settings: { ...graph.settings },
  };
}

export function createBenchmarkCases({
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
}: BenchmarkActions): BenchmarkCase[] {
  const small = createBenchmarkGraph(48, 72);
  const medium = createBenchmarkGraph(120, 180);
  const large = createBenchmarkGraph(320, 560);
  const routingHeavy = createBenchmarkGraph(180, 420);

  return [
    {
      family: "mutation",
      graph: medium,
      name: "add-node",
      action: () => {
        executeCommand(
          addNodeCommand({
            id: "bench-added-node",
            label: "bench",
            x: 960,
            y: 640,
          }),
        );
      },
    },
    {
      family: "mutation",
      graph: medium,
      name: "add-edge",
      action: () => {
        executeCommand(
          addEdgeCommand({
            id: "bench-added-edge",
            source: "n0",
            target: "n17",
            weight: "5",
            label: "bench",
          }),
        );
      },
    },
    {
      family: "mutation",
      graph: medium,
      name: "edit-node-and-edge-labels",
      action: () => {
        executeCommand(updateNodeCommand("n0", { label: "updated node" }));
        executeCommand(updateEdgeCommand("e0", { label: "updated edge" }));
      },
    },
    {
      family: "mutation",
      graph: large,
      name: "move-one-node-large",
      action: () => {
        executeCommand(updateNodeCommand("n0", { x: 48, y: 48 }));
      },
    },
    {
      family: "mutation",
      graph: medium,
      name: "move-all-nodes",
      action: () => {
        executeCommand(
          createMoveNodesCommand(
            "Benchmark move all nodes",
            createOffsetPositions(graphRef.current, 12, 8),
          ),
        );
      },
    },
    {
      family: "layout",
      graph: medium,
      name: "circle-layout",
      action: () => {
        applyManualLayout("circle");
      },
    },
    {
      family: "settings",
      graph: large,
      name: "toggle-auto-routing",
      action: () => {
        updateGraphSettings({
          autoEdgeRouting: !graphRef.current.settings.autoEdgeRouting,
        });
      },
    },
    {
      family: "selection",
      graph: small,
      name: "copy-paste-two-nodes",
      action: () => {
        setSelection({ nodeIds: ["n0", "n1"], edgeIds: [] });
        copySelection();
        pasteClipboard();
      },
    },
    {
      family: "selection",
      graph: medium,
      name: "select-all-color-delete",
      action: () => {
        selectAll();
        cycleSelectionColor();
        deleteSelection();
      },
    },
    {
      family: "history",
      graph: medium,
      name: "undo-redo-label-edit",
      action: () => {
        executeCommand(updateNodeCommand("n0", { label: "history edit" }));
        undo();
        redo();
      },
    },
    {
      family: "export",
      graph: medium,
      name: "text-formats",
      action: () => {
        const formats: GraphExportFormat[] = [
          "edge-list",
          "adjacency-list",
          "adjacency-matrix",
          "json",
        ];
        const bytes = formats.reduce(
          (total, format) =>
            total + exportGraph(graphRef.current, format).length,
          0,
        );

        return { bytes };
      },
    },
    {
      family: "export",
      graph: small,
      name: "png-full-long-edge-1024",
      action: async () => {
        const blob = await exportPng({
          background: "transparent",
          includeSelection: false,
          maxHeight: 1024,
          maxWidth: 1024,
          scope: "full",
        });

        return { bytes: blob.size };
      },
    },
    {
      family: "viewport",
      graph: large,
      name: "fit-after-render",
      action: () => {
        fitAfterNextGraphRender();
      },
    },
    {
      family: "routing",
      graph: routingHeavy,
      name: "move-one-node-routing-heavy",
      action: () => {
        executeCommand(updateNodeCommand("n0", { x: 128, y: 128 }));
      },
    },
    {
      family: "storage",
      graph: large,
      name: "deferred-write-flush",
      action: () => {
        executeCommand(updateNodeCommand("n0", { label: "storage flush" }));
        flushStoredGraphWrite();
      },
    },
  ];
}

function createOffsetPositions(
  model: GraphModel,
  dx: number,
  dy: number,
): NodePositionMap {
  return Object.fromEntries(
    model.nodes.map((node) => [
      node.id,
      {
        x: node.x + dx,
        y: node.y + dy,
      },
    ]),
  );
}
