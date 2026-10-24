import type { Core, EventObject } from "cytoscape";
import type { GraphModel } from "../../core/graph/model";
import { decodeCytoscapeId, getCytoscapeElement } from "./cytoscape-ids";
import {
  edgeHitboxLabel,
  readEdgeLabelHitboxes,
  readNodeHitboxes,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "./graph-canvas-hitboxes";
import {
  createNodeHitboxSnapshot,
  createEdgeLabelHitboxSnapshot,
} from "./hitbox-reconciliation";

export function createRenderedHitboxReader(cy: Core) {
  let model: GraphModel | undefined;
  let nodes: NodeHitbox[] = [];
  let edges: EdgeLabelHitbox[] | null = null;
  const nodeSnapshot = createNodeHitboxSnapshot();
  const edgeSnapshot = createEdgeLabelHitboxSnapshot();
  let labels = new Map<string, string>();
  let modelEdges = new Map<string, GraphModel["edges"][number]>();
  let full = true;
  let zoom = NaN;
  let pan = { x: NaN, y: NaN };
  const dirtyNodes = new Set<string>();
  const dirtyEdges = new Set<string>();

  const dirtyNode = (id: string, element = getCytoscapeElement(cy, id)) => {
    if (dirtyNodes.has(id)) return;
    dirtyNodes.add(id);
    element.connectedEdges().forEach((edge) => {
      dirtyEdges.add(decodeCytoscapeId(edge.id()));
    });
  };
  const dirtyEdge = (id: string, element = getCytoscapeElement(cy, id)) => {
    if (dirtyEdges.has(id)) return;
    dirtyEdges.add(id);
    element.parallelEdges().forEach((edge) => {
      dirtyEdges.add(decodeCytoscapeId(edge.id()));
    });
  };

  const invalidate = (event: EventObject) => {
    if (
      event.type === "add" ||
      event.type === "remove" ||
      event.target === cy
    ) {
      full = true;
      return;
    }
    if (full) return;
    const element = event.target;
    if (element.isNode()) dirtyNode(decodeCytoscapeId(element.id()), element);
    else dirtyEdge(decodeCytoscapeId(element.id()), element);
  };
  const events = "position data style add remove";
  cy.on(events, invalidate);

  return {
    read(graph: GraphModel, includeEdges: boolean) {
      const currentPan = cy.pan();
      const currentZoom = cy.zoom();
      if (model !== graph) {
        const nextLabels = new Map(
          graph.nodes.map((node) => [node.id, node.label]),
        );
        const nextEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));

        full ||=
          nextLabels.size !== labels.size ||
          nextEdges.size !== modelEdges.size ||
          graph.nodes.some((node) => !labels.has(node.id)) ||
          graph.edges.some((edge) => !modelEdges.has(edge.id));
        if (!full) {
          for (const node of graph.nodes)
            if (labels.get(node.id) !== node.label) dirtyNode(node.id);
          for (const edge of graph.edges) {
            const previous = modelEdges.get(edge.id)!;
            if (
              previous.source !== edge.source ||
              previous.target !== edge.target ||
              edgeHitboxLabel(previous, model!.settings.weighted) !==
                edgeHitboxLabel(edge, graph.settings.weighted)
            )
              dirtyEdge(edge.id);
          }
        }
        labels = nextLabels;
        modelEdges = nextEdges;
      }
      const reset =
        full ||
        zoom !== currentZoom ||
        pan.x !== currentPan.x ||
        pan.y !== currentPan.y;
      if (reset) {
        nodes = nodeSnapshot.reset(readNodeHitboxes(cy, graph));
        edges = includeEdges
          ? edgeSnapshot.reset(readEdgeLabelHitboxes(cy, graph))
          : null;
      } else {
        if (dirtyNodes.size)
          nodes = nodeSnapshot.replace(
            readNodeHitboxes(cy, graph, { ids: dirtyNodes, labels }),
          );
        if (includeEdges) {
          if (edges === null)
            edges = edgeSnapshot.reset(readEdgeLabelHitboxes(cy, graph));
          else if (dirtyEdges.size)
            edges = edgeSnapshot.replace(
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
