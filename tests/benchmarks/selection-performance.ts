import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SelectionActionBar } from "../../features/graph-editor/canvas/SelectionActionBar";
import { resolveSelectionActions } from "../../features/graph-editor/canvas/selection-actions";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  GRAPH_MAX_EDGES,
  GRAPH_MAX_NODES,
} from "../../features/graph-editor/core/graph/graph-limits";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";

// Reproduce select-all at the supported limits. The previous membership scan
// stays here as a comparison, including Set construction in the improved path.
const graph = {
  ...createEmptyGraphModel({ directed: true, allowMultiEdges: true }),
  nodes: Array.from({ length: GRAPH_MAX_NODES }, (_, i) => ({
    id: `n${i}`,
    order: i,
    label: `${i}`,
    x: i,
    y: 0,
  })),
  edges: Array.from({ length: GRAPH_MAX_EDGES }, (_, i) => ({
    id: `e${i}`,
    source: `n${i % GRAPH_MAX_NODES}`,
    target: `n${(i + 1) % GRAPH_MAX_NODES}`,
  })),
};
const selection = {
  nodeIds: graph.nodes.map((node) => node.id),
  edgeIds: graph.edges.map((edge) => edge.id),
};
const noOp = () => {};

measure("membership / previous array scan", () => {
  const nodes = graph.nodes.filter((node) =>
    selection.nodeIds.includes(node.id),
  );
  const edges = graph.edges.filter((edge) =>
    selection.edgeIds.includes(edge.id),
  );
  return nodes.length + edges.length;
});
measure("membership / Set", () => {
  const nodeIds = new Set(selection.nodeIds);
  const edgeIds = new Set(selection.edgeIds);
  return (
    graph.nodes.filter((node) => nodeIds.has(node.id)).length +
    graph.edges.filter((edge) => edgeIds.has(edge.id)).length
  );
});
measure(
  "selection actions / production",
  () => resolveSelectionActions(graph, selection, messagesByLocale.en).length,
);
measure(
  "selection toolbar / production render",
  () =>
    renderToStaticMarkup(
      createElement(
        I18nProvider,
        null,
        createElement(SelectionActionBar, {
          graph,
          selection,
          chrome: { layout: "desktop" },
          onSetNodeColor: noOp,
          onSetEdgeColor: noOp,
          onReverseEdges: noOp,
          onResetEdgeCurve: noOp,
          onEditSelectedNode: noOp,
          onEditSelectedEdge: noOp,
          onDeleteSelection: noOp,
        }),
      ),
    ).length,
);

function measure(name: string, run: () => number) {
  for (let i = 0; i < 3; i += 1) run();
  const times: number[] = [];
  let result = 0;
  for (let i = 0; i < 8; i += 1) {
    const start = performance.now();
    result = run();
    times.push(performance.now() - start);
  }
  console.log(
    JSON.stringify({
      name,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      meanMs: times.reduce((sum, value) => sum + value, 0) / times.length,
      maxMs: Math.max(...times),
      result,
    }),
  );
}
