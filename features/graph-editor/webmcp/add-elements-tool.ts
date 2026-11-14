import { nanoid } from "nanoid";

import { withMeasuredNodeGeometry } from "../adapters/browser/node-geometry";
import {
  SELECTABLE_EDGE_COLORS,
  SELECTABLE_NODE_COLORS,
} from "../core/graph/colors";
import { edgePairKey } from "../core/graph/edge-constraints";
import {
  GRAPH_MAX_ABS_COORDINATE,
  isGraphCoordinate,
} from "../core/graph/graph-coordinates";
import {
  normalizeEdgeLabelInput,
  normalizeEdgeWeightInput,
  normalizeNodeLabelInput,
} from "../core/graph/edit-values";
import { createEdge, createNode } from "../core/graph/graph-factory";
import {
  GRAPH_MAX_EDGES,
  GRAPH_MAX_JSON_CHARS,
  GRAPH_MAX_NODES,
  isGraphText,
} from "../core/graph/graph-limits";
import type {
  GraphColor,
  GraphEdge,
  GraphModel,
  GraphNode,
} from "../core/graph/model";
import { nodeGeometryHeight, nodeGeometryWidth } from "../core/graph/node-size";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import {
  fail,
  hasOnly,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
  type NodeSelector,
} from "./batch-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

type Position = { x: number; y: number };
const GAP = 16;

function validPosition(value: unknown): value is Position {
  return (
    isRecord(value) &&
    hasOnly(value, ["x", "y"]) &&
    isGraphCoordinate(value.x) &&
    isGraphCoordinate(value.y)
  );
}

function nodeColor(value: unknown): value is GraphColor {
  return (
    typeof value === "string" &&
    SELECTABLE_NODE_COLORS.includes(value as GraphColor)
  );
}

function edgeColor(value: unknown): value is GraphColor {
  return (
    typeof value === "string" &&
    SELECTABLE_EDGE_COLORS.includes(value as GraphColor)
  );
}

function validWeight(value: unknown) {
  return (
    (typeof value === "string" && isGraphText(value.trim())) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function createNodeResolver(nodes: GraphNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byLabel = new Map<string, GraphNode | null>();
  for (const node of nodes) {
    byLabel.set(node.label, byLabel.has(node.label) ? null : node);
  }
  return (selector: NodeSelector) => {
    const found =
      selector.id !== undefined
        ? byId.get(selector.id)
        : byLabel.get(selector.label!);
    if (found === null)
      return {
        error: fail(
          "ambiguous-node",
          "A node label matches multiple nodes. Use a node ID.",
        ),
      } as const;
    if (!found)
      return {
        error: fail(
          "node-not-found",
          "A node selector did not match. Read the graph and retry.",
        ),
      } as const;
    return { value: found } as const;
  };
}

// Arrange automatic positions outside the existing and explicitly placed nodes.
// Candidate placement is bounded by the editor's coordinate contract and does
// not move any existing node. Explicit positions intentionally remain unchanged.
function placeAutomaticNodes(
  graph: GraphModel,
  newNodes: GraphNode[],
  automatic: boolean[],
): Position[] | null {
  const automaticCount = automatic.filter(Boolean).length;
  if (!automaticCount) return [];
  const measured = withMeasuredNodeGeometry({
    ...graph,
    nodes: [...graph.nodes, ...newNodes],
  });
  const existing = measured.nodes.slice(0, graph.nodes.length);
  const measuredNew = measured.nodes.slice(graph.nodes.length);
  const obstacles = [
    ...existing,
    ...measuredNew.filter((_, index) => !automatic[index]),
  ];
  const autoNodes = measuredNew.filter((_, index) => automatic[index]);
  const width = Math.max(...autoNodes.map(nodeGeometryWidth));
  const height = Math.max(...autoNodes.map(nodeGeometryHeight));
  const cols = Math.ceil(Math.sqrt(automaticCount));
  const rows = Math.ceil(automaticCount / cols);
  const xStep = width + GAP;
  const yStep = height + GAP;
  const xSpan = (cols - 1) * xStep;
  const ySpan = (rows - 1) * yStep;
  const cap = GRAPH_MAX_ABS_COORDINATE;
  if (xSpan > 2 * cap || ySpan > 2 * cap) return null;
  const clampStart = (value: number, span: number) =>
    Math.max(-cap, Math.min(cap - span, value));
  let candidates: Array<{ x: number; y: number; dx: number; dy: number }>;
  if (!obstacles.length) {
    candidates = [{ x: -xSpan / 2, y: -ySpan / 2, dx: xStep, dy: yStep }];
  } else {
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const node of obstacles) {
      const w = nodeGeometryWidth(node),
        h = nodeGeometryHeight(node);
      left = Math.min(left, node.x - w / 2);
      right = Math.max(right, node.x + w / 2);
      top = Math.min(top, node.y - h / 2);
      bottom = Math.max(bottom, node.y + h / 2);
    }
    const centerX = (left + right) / 2,
      centerY = (top + bottom) / 2;
    const y = clampStart(centerY - ySpan / 2, ySpan);
    const x = clampStart(centerX - xSpan / 2, xSpan);
    candidates = [
      { x: right + GAP + width / 2, y, dx: xStep, dy: yStep },
      { x: left - GAP - width / 2, y, dx: -xStep, dy: yStep },
      { x, y: bottom + GAP + height / 2, dx: xStep, dy: yStep },
      { x, y: top - GAP - height / 2, dx: xStep, dy: -yStep },
    ];
  }
  for (const candidate of candidates) {
    const positions = Array.from({ length: automaticCount }, (_, index) => ({
      x: candidate.x + (index % cols) * candidate.dx,
      y: candidate.y + Math.floor(index / cols) * candidate.dy,
    }));
    if (
      positions.every(
        ({ x, y }) => isGraphCoordinate(x) && isGraphCoordinate(y),
      )
    )
      return positions;
  }
  return null;
}

export function createAddElementsTool({
  store,
  revision,
  requestFit,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "add_graph_elements",
    description:
      "Add multiple nodes and edges to the current graph atomically in one undo step. Edges can connect existing nodes or newly added nodes by exact unique label. Existing elements and settings are preserved.",
    inputSchema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          maxItems: GRAPH_MAX_NODES,
          description:
            "New nodes; give unique labels to refer to them in the edges array.",
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "Node label; omit for the next unused number.",
              },
              position: {
                type: "object",
                description:
                  "Optional explicit graph coordinates; otherwise placed automatically.",
                properties: { x: { type: "number" }, y: { type: "number" } },
                required: ["x", "y"],
                additionalProperties: false,
              },
              color: { type: "string", enum: SELECTABLE_NODE_COLORS },
            },
            additionalProperties: false,
          },
        },
        edges: {
          type: "array",
          maxItems: GRAPH_MAX_EDGES,
          description:
            "New edges between existing or newly added nodes; duplicate labels require existing IDs.",
          items: {
            type: "object",
            properties: {
              source: nodeSelectorSchema,
              target: nodeSelectorSchema,
              weight: {
                type: ["string", "number"],
                description: "Weight for weighted graphs; defaults to 1.",
              },
              label: { type: "string", description: "Optional edge label." },
              color: { type: "string", enum: SELECTABLE_EDGE_COLORS },
            },
            required: ["source", "target"],
            additionalProperties: false,
          },
        },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from get_graph_summary.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, ["nodes", "edges", "expectedRevision"]) ||
        typeof input.expectedRevision !== "string" ||
        (input.nodes !== undefined &&
          (!Array.isArray(input.nodes) ||
            input.nodes.length > GRAPH_MAX_NODES)) ||
        (input.edges !== undefined &&
          (!Array.isArray(input.edges) || input.edges.length > GRAPH_MAX_EDGES))
      )
        return fail(
          "invalid-input",
          "Provide node and/or edge definitions and the current graph revision.",
        );
      const nodeInputs = (input.nodes ?? []) as unknown[];
      const edgeInputs = (input.edges ?? []) as unknown[];
      if (!nodeInputs.length && !edgeInputs.length)
        return fail("invalid-input", "List at least one node or edge to add.");
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before adding elements.",
        );
      const graph = store.get(graphAtom);
      if (graph.nodes.length + nodeInputs.length > GRAPH_MAX_NODES)
        return fail(
          "node-limit",
          "Adding these nodes would exceed the graph node limit.",
        );
      if (graph.edges.length + edgeInputs.length > GRAPH_MAX_EDGES)
        return fail(
          "edge-limit",
          "Adding these edges would exceed the graph edge limit.",
        );

      const usedIds = new Set([
        ...graph.nodes.map((node) => node.id),
        ...graph.edges.map((edge) => edge.id),
      ]);
      function nextId(): string {
        let id = nanoid();
        while (usedIds.has(id)) id = nanoid();
        usedIds.add(id);
        return id;
      }
      const labels = new Set(graph.nodes.map((node) => node.label));
      const orders = new Set(graph.nodes.map((node) => node.order));
      let nextLabel = graph.settings.indexBase;
      let nextOrder = 0;
      const nodes: GraphNode[] = [];
      const automatic: boolean[] = [];
      for (const value of nodeInputs) {
        if (
          !isRecord(value) ||
          !hasOnly(value, ["label", "position", "color"]) ||
          (value.label !== undefined &&
            (typeof value.label !== "string" ||
              !isGraphText(value.label.trim()))) ||
          (value.position !== undefined && !validPosition(value.position)) ||
          (value.color !== undefined && !nodeColor(value.color))
        )
          return fail(
            "invalid-input",
            "Each node needs a valid label, optional position and optional node color.",
          );
        while (labels.has(String(nextLabel))) nextLabel++;
        const label =
          typeof value.label === "string"
            ? normalizeNodeLabelInput(value.label)
            : String(nextLabel);
        labels.add(label);
        while (orders.has(nextOrder)) nextOrder++;
        const position = validPosition(value.position)
          ? value.position
          : { x: 0, y: 0 };
        automatic.push(value.position === undefined);
        nodes.push(
          createNode({
            id: nextId(),
            label,
            order: nextOrder,
            ...position,
            ...(nodeColor(value.color) ? { color: value.color } : {}),
          }),
        );
        orders.add(nextOrder++);
      }
      let positions: Position[] | null;
      try {
        positions = placeAutomaticNodes(graph, nodes, automatic);
      } catch {
        return fail(
          "position-failed",
          "Could not measure node sizes. Specify coordinates or try again.",
        );
      }
      if (!positions)
        return fail(
          "position-unavailable",
          "Could not find available positions within graph coordinate limits. Specify coordinates or adjust the graph.",
        );
      let positionIndex = 0;
      const placed = nodes.map((node, index) =>
        automatic[index] ? { ...node, ...positions[positionIndex++] } : node,
      );
      const model: GraphModel = {
        ...graph,
        nodes: [...graph.nodes, ...placed],
      };
      let projectedSize = JSON.stringify(model).length;
      if (projectedSize > GRAPH_MAX_JSON_CHARS)
        return fail(
          "invalid-graph",
          "Adding these elements would exceed the graph size limit.",
        );
      const resolveNode = createNodeResolver(model.nodes);
      const pairKey = (source: string, target: string) =>
        edgePairKey(source, target, graph.settings.directed);
      const pairs = graph.settings.allowMultiEdges
        ? null
        : new Set(graph.edges.map((edge) => pairKey(edge.source, edge.target)));
      const edges: GraphEdge[] = [];
      for (const value of edgeInputs) {
        if (
          !isRecord(value) ||
          !hasOnly(value, ["source", "target", "weight", "label", "color"]) ||
          !isNodeSelector(value.source) ||
          !isNodeSelector(value.target) ||
          (value.weight !== undefined && !validWeight(value.weight)) ||
          (value.label !== undefined &&
            (typeof value.label !== "string" ||
              !isGraphText(value.label.trim()))) ||
          (value.color !== undefined && !edgeColor(value.color))
        )
          return fail(
            "invalid-input",
            "Each edge needs source and target selectors and valid weight, label and color.",
          );
        if (value.weight !== undefined && !graph.settings.weighted)
          return fail(
            "unweighted-graph",
            "The graph is unweighted; switch to weighted before specifying weights.",
          );
        const source = resolveNode(value.source);
        if ("error" in source) return source.error;
        const target = resolveNode(value.target);
        if ("error" in target) return target.error;
        if (
          !graph.settings.allowSelfLoops &&
          source.value.id === target.value.id
        )
          return fail(
            "edge-not-allowed",
            "An edge conflicts with the graph's self-loop or multiple-edge settings.",
          );
        const separator = graph.edges.length + edges.length > 0 ? 1 : 0;
        // IDs are not individually length-limited. Check their raw lengths
        // before encoding or building any pair key, then count the exact JSON
        // entry. This bounds accumulated work and memory by the graph limit.
        if (
          projectedSize +
            source.value.id.length +
            target.value.id.length +
            separator >
          GRAPH_MAX_JSON_CHARS
        )
          return fail(
            "invalid-graph",
            "Adding these elements would exceed the graph size limit.",
          );
        const edge = createEdge({
          id: nextId(),
          source: source.value.id,
          target: target.value.id,
          ...(graph.settings.weighted
            ? {
                weight: normalizeEdgeWeightInput(
                  value.weight === undefined ? "1" : String(value.weight),
                ),
              }
            : {}),
          ...(typeof value.label === "string"
            ? { label: normalizeEdgeLabelInput(value.label) }
            : {}),
          ...(edgeColor(value.color) ? { color: value.color } : {}),
        });
        projectedSize += JSON.stringify(edge).length + separator;
        if (projectedSize > GRAPH_MAX_JSON_CHARS)
          return fail(
            "invalid-graph",
            "Adding these elements would exceed the graph size limit.",
          );
        if (pairs) {
          const key = pairKey(source.value.id, target.value.id);
          if (pairs.has(key))
            return fail(
              "edge-not-allowed",
              "An edge conflicts with the graph's self-loop or multiple-edge settings.",
            );
          pairs.add(key);
        }
        edges.push(edge);
      }
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const result = store.set(executeCommandAtom, {
        type: "replace-model",
        label: "Add graph elements",
        model: { ...model, edges: [...graph.edges, ...edges] },
      });
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      let fitRequested = false;
      if (result.status === "applied" && placed.length) {
        try {
          requestFit(result.graph);
          fitRequested = true;
        } catch {
          /* The change is already committed. */
        }
      }
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        nodeCount: placed.length,
        edgeCount: edges.length,
        nodeIds: placed.slice(0, 10).map((node) => node.id),
        edgeIds: edges.slice(0, 10).map((edge) => edge.id),
        nodeIdsTruncated: placed.length > 10,
        edgeIdsTruncated: edges.length > 10,
        fitRequested,
      };
    },
  };
}
