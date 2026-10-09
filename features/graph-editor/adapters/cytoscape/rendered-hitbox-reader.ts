import type { Core, EventObject } from "cytoscape";
import type { GraphModel } from "../../core/graph/model";
import {
  readEdgeLabelHitboxes,
  readNodeHitboxes,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "./graph-canvas-hitboxes";

/** Reuse geometry between frames; changes from routing/style still invalidate it. */
export function createRenderedHitboxReader(cy: Core) {
  let model: GraphModel | undefined;
  let nodes: NodeHitbox[] = [];
  let edges: EdgeLabelHitbox[] | null = null;
  let labels = new Map<string, string>();
  let modelEdges = new Map<string, GraphModel["edges"][number]>();
  let full = true;
  let zoom = NaN;
  let pan = { x: NaN, y: NaN };
  const dirtyNodes = new Set<string>();
  const dirtyEdges = new Set<string>();

  const invalidate = (event: EventObject) => {
    if (
      event.type === "add" ||
      event.type === "remove" ||
      event.target === cy
    ) {
      full = true;
      return;
    }
    const element = event.target;
    if (element.isNode()) {
      dirtyNodes.add(element.id());
      element
        .connectedEdges()
        .forEach((edge: { id(): string }) => dirtyEdges.add(edge.id()));
    } else {
      element
        .parallelEdges()
        .forEach((edge: { id(): string }) => dirtyEdges.add(edge.id()));
    }
  };
  const events = "position data style add remove";
  cy.on(events, invalidate);

  return {
    read(graph: GraphModel, includeEdges: boolean) {
      const currentPan = cy.pan();
      const currentZoom = cy.zoom();
      const reset =
        full ||
        model !== graph ||
        zoom !== currentZoom ||
        pan.x !== currentPan.x ||
        pan.y !== currentPan.y;
      if (model !== graph) {
        labels = new Map(graph.nodes.map((node) => [node.id, node.label]));
        modelEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));
      }
      if (reset) {
        nodes = readNodeHitboxes(cy, graph);
        edges = includeEdges ? readEdgeLabelHitboxes(cy, graph) : null;
      } else {
        if (dirtyNodes.size)
          nodes = replaceDirty(
            nodes,
            readNodeHitboxes(cy, graph, { ids: dirtyNodes, labels }),
          );
        if (includeEdges) {
          if (edges === null) edges = readEdgeLabelHitboxes(cy, graph);
          else if (dirtyEdges.size)
            edges = replaceDirty(
              edges,
              readEdgeLabelHitboxes(cy, graph, {
                ids: dirtyEdges,
                edges: modelEdges,
              }),
            );
        } else edges = null;
      }
      model = graph;
      zoom = currentZoom;
      pan = { x: currentPan.x, y: currentPan.y };
      full = false;
      dirtyNodes.clear();
      dirtyEdges.clear();
      return { nodes, edges };
    },
    dispose() {
      cy.off(events, invalidate);
    },
  };
}

function replaceDirty<T extends { id: string }>(
  previous: T[],
  replacements: T[],
) {
  if (!replacements.length) return previous;
  const byId = new Map(replacements.map((entry) => [entry.id, entry]));
  return previous.map((entry) => byId.get(entry.id) ?? entry);
}
