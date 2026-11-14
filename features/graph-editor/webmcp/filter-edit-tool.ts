import {
  SELECTABLE_EDGE_COLORS,
  SELECTABLE_NODE_COLORS,
} from "../core/graph/colors";
import { stripUndefinedProperties } from "../core/graph/graph-utils";
import type { GraphColor, GraphModel } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import {
  fail,
  hasOnly,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
} from "./batch-edit-primitives";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

const FILTER_COLORS: GraphColor[] = [
  "paper",
  "white",
  "black",
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
];

function inColors(
  value: unknown,
  colors: readonly GraphColor[],
): value is GraphColor {
  return typeof value === "string" && colors.includes(value as GraphColor);
}

type Decimal = { sign: -1 | 0 | 1; digits: string; order: number };

// Compare decimal notation without rounding its significand to an IEEE double.
// The input and exponent limits also avoid allocating strings proportional to
// untrusted exponents (including imported edge weights).
function parseDecimal(value: unknown): Decimal | undefined {
  if (
    typeof value !== "string" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    return;
  if (typeof value === "string" && value.length > 256) return;
  const text = String(value).trim();
  if (text.length > 256) return;
  const match =
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return;
  const exponentText = (match[5] ?? "0").replace(/^[+-]?0*/, "");
  if (exponentText.length > 5) return;
  const exponent = Number(match[5] ?? "0");
  if (!Number.isFinite(exponent) || Math.abs(exponent) > 10_000) return;
  const fraction = match[3] ?? match[4] ?? "";
  const digits = `${match[2] ?? ""}${fraction}`.replace(/^0+/, "");
  if (!digits) return { sign: 0, digits: "0", order: 0 };
  return {
    sign: match[1] === "-" ? -1 : 1,
    digits,
    order: digits.length + exponent - fraction.length,
  };
}

function compareDecimal(a: Decimal, b: Decimal): number {
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
  if (a.sign === 0) return 0;
  if (a.order !== b.order) return (a.order < b.order ? -1 : 1) * a.sign;
  const length = Math.max(a.digits.length, b.digits.length);
  for (let i = 0; i < length; i++) {
    const left = a.digits.charCodeAt(i) || 48;
    const right = b.digits.charCodeAt(i) || 48;
    if (left !== right) return (left < right ? -1 : 1) * a.sign;
  }
  return 0;
}

export const nodeFilterSchema = {
  type: "object",
  description:
    "All conditions must match. The reference node is excluded from its own neighbors.",
  properties: {
    color: {
      type: "string",
      enum: FILTER_COLORS,
      description: "Match this color; paper means the default.",
    },
    neighborOf: {
      type: "object",
      description:
        "Match neighbors of this node. For directed edges, choose out, in, or all; undirected edges match in either direction.",
      properties: {
        node: nodeSelectorSchema,
        direction: { type: "string", enum: ["all", "in", "out"] },
      },
      required: ["node"],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export const edgeFilterSchema = {
  type: "object",
  description:
    "All conditions must match. Weights over 256 characters, non-decimal weights, and exponents beyond +/-10000 are excluded and counted.",
  properties: {
    color: {
      type: "string",
      enum: FILTER_COLORS,
      description: "Match this color; paper means the default.",
    },
    minWeight: {
      type: ["number", "string"],
      description:
        "Inclusive minimum; use a string for exact digits. Decimal values have up to 256 characters and exponent +/-10000. Missing weights count as 1.",
    },
    maxWeight: {
      type: ["number", "string"],
      description:
        "Inclusive maximum; use a string for exact digits. Decimal values have up to 256 characters and exponent +/-10000. Missing weights count as 1.",
    },
  },
  additionalProperties: false,
};

export function resolveFilterTargets(
  graph: GraphModel,
  nf: unknown,
  ef: unknown,
  allowEmpty = false,
) {
  const minWeight =
    isRecord(ef) && ef.minWeight !== undefined
      ? parseDecimal(ef.minWeight)
      : undefined;
  const maxWeight =
    isRecord(ef) && ef.maxWeight !== undefined
      ? parseDecimal(ef.maxWeight)
      : undefined;
  if (
    nf !== undefined &&
    (!isRecord(nf) ||
      !hasOnly(nf, ["color", "neighborOf"]) ||
      Object.keys(nf).length === 0 ||
      (nf.color !== undefined && !inColors(nf.color, FILTER_COLORS)) ||
      (nf.neighborOf !== undefined &&
        (!isRecord(nf.neighborOf) ||
          !hasOnly(nf.neighborOf, ["node", "direction"]) ||
          !isNodeSelector(nf.neighborOf.node) ||
          (nf.neighborOf.direction !== undefined &&
            !["all", "in", "out"].includes(
              nf.neighborOf.direction as string,
            )))))
  )
    return fail(
      "invalid-input",
      "Invalid node filter. Color names are lowercase.",
    );
  if (
    ef !== undefined &&
    (!isRecord(ef) ||
      !hasOnly(ef, ["color", "minWeight", "maxWeight"]) ||
      Object.keys(ef).length === 0 ||
      (ef.color !== undefined && !inColors(ef.color, FILTER_COLORS)) ||
      (ef.minWeight !== undefined && !minWeight) ||
      (ef.maxWeight !== undefined && !maxWeight) ||
      (minWeight && maxWeight && compareDecimal(minWeight, maxWeight) > 0))
  )
    return fail(
      "invalid-input",
      "Invalid edge filter. Weight bounds must be valid inclusive decimal numbers.",
    );
  // Reject own properties whose value is undefined: they are not conditions.
  if (
    (isRecord(nf) && nf.color === undefined && nf.neighborOf === undefined) ||
    (isRecord(ef) &&
      ef.color === undefined &&
      ef.minWeight === undefined &&
      ef.maxWeight === undefined)
  )
    return fail(
      "invalid-input",
      "A filter must contain at least one condition.",
    );
  const nodeFilter = isRecord(nf) ? nf : undefined;
  const edgeFilter = isRecord(ef) ? ef : undefined;
  const hasWeightFilter =
    edgeFilter !== undefined &&
    (edgeFilter.minWeight !== undefined || edgeFilter.maxWeight !== undefined);
  if (hasWeightFilter && !graph.settings.weighted)
    return fail(
      "unweighted-graph",
      "Weight conditions require a weighted graph.",
    );

  let neighbors: Set<string> | undefined;
  if (nodeFilter && isRecord(nodeFilter.neighborOf)) {
    const selector = nodeFilter.neighborOf.node;
    if (!isNodeSelector(selector))
      return fail("invalid-input", "Invalid neighbor selector.");
    const matches = graph.nodes.filter((node) =>
      selector.id !== undefined
        ? node.id === selector.id
        : node.label === selector.label,
    );
    if (matches.length === 0)
      return fail(
        "node-not-found",
        "The neighbor reference did not match a node.",
      );
    if (matches.length > 1)
      return fail(
        "ambiguous-node",
        "The neighbor reference matches multiple nodes. Use a node ID.",
      );
    const id = matches[0].id;
    const direction = nodeFilter.neighborOf.direction ?? "all";
    neighbors = new Set<string>();
    for (const edge of graph.edges) {
      if (
        (!graph.settings.directed || direction !== "in") &&
        edge.source === id
      )
        neighbors.add(edge.target);
      if (
        (!graph.settings.directed || direction !== "out") &&
        edge.target === id
      )
        neighbors.add(edge.source);
    }
    neighbors.delete(id);
  }
  const nodeIds = new Set<string>();
  if (nodeFilter) {
    for (const node of graph.nodes) {
      if (
        nodeFilter.color !== undefined &&
        (node.color ?? "paper") !== nodeFilter.color
      )
        continue;
      if (neighbors && !neighbors.has(node.id)) continue;
      nodeIds.add(node.id);
    }
  }
  const edgeIds = new Set<string>();
  let nonNumericWeights = 0;
  if (edgeFilter) {
    for (const edge of graph.edges) {
      if (
        edgeFilter.color !== undefined &&
        (edge.color ?? "paper") !== edgeFilter.color
      )
        continue;
      if (hasWeightFilter) {
        const value = parseDecimal(edge.weight ?? "1");
        if (!value) {
          nonNumericWeights++;
          continue;
        }
        if (minWeight && compareDecimal(value, minWeight) < 0) continue;
        if (maxWeight && compareDecimal(value, maxWeight) > 0) continue;
      }
      edgeIds.add(edge.id);
    }
  }
  if (
    !allowEmpty &&
    ((nodeFilter && !nodeIds.size) || (edgeFilter && !edgeIds.size))
  )
    return {
      ...fail(
        "no-targets",
        "At least one requested filter matched no elements; nothing changed.",
      ),
      nodeCount: nodeIds.size,
      edgeCount: edgeIds.size,
      nonNumericWeights,
    };
  return { nodeIds, edgeIds, nonNumericWeights };
}

export function createFilterEditTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "update_graph_elements_by_filter",
    description:
      "Color all nodes or edges matching conditions in one atomic undo step without retrieving their IDs. Use for requests like 'make blue nodes red', 'color edges with weight at least 10 blue', or 'color neighbors of node 4 red'. Conditions within each filter are ANDed. Supply a nonempty nodeFilter with nodeColor and/or a nonempty edgeFilter with edgeColor; no implicit all-elements selection. Read get_graph_summary first and pass expectedRevision. If nonNumericWeights is greater than zero, tell the user those weights could not be compared and were excluded.",
    inputSchema: {
      type: "object",
      properties: {
        nodeFilter: nodeFilterSchema,
        nodeColor: { type: "string", enum: SELECTABLE_NODE_COLORS },
        edgeFilter: edgeFilterSchema,
        edgeColor: { type: "string", enum: SELECTABLE_EDGE_COLORS },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "nodeFilter",
          "nodeColor",
          "edgeFilter",
          "edgeColor",
          "expectedRevision",
        ]) ||
        typeof input.expectedRevision !== "string"
      )
        return fail(
          "invalid-input",
          "Provide filters, target colors, and the current revision.",
        );
      if (
        (input.nodeFilter === undefined) !== (input.nodeColor === undefined) ||
        (input.edgeFilter === undefined) !== (input.edgeColor === undefined) ||
        (input.nodeFilter === undefined && input.edgeFilter === undefined)
      )
        return fail(
          "invalid-input",
          "Provide a nonempty filter and a target color for each requested element type.",
        );
      if (
        (input.nodeColor !== undefined &&
          !inColors(input.nodeColor, SELECTABLE_NODE_COLORS)) ||
        (input.edgeColor !== undefined &&
          !inColors(input.edgeColor, SELECTABLE_EDGE_COLORS))
      )
        return fail("invalid-input", "Invalid target color.");
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before editing.",
        );
      const graph = store.get(graphAtom);
      const resolved = resolveFilterTargets(
        graph,
        input.nodeFilter,
        input.edgeFilter,
      );
      if (!("nodeIds" in resolved) || !resolved.nodeIds || !resolved.edgeIds)
        return resolved;
      const { nodeIds, edgeIds, nonNumericWeights } = resolved;
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const nodeColor =
        input.nodeColor === "paper"
          ? undefined
          : (input.nodeColor as GraphColor);
      const edgeColor =
        input.edgeColor === "paper"
          ? undefined
          : (input.edgeColor as GraphColor);
      const model: GraphModel = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          nodeIds.has(node.id)
            ? stripUndefinedProperties({ ...node, color: nodeColor })
            : node,
        ),
        edges: graph.edges.map((edge) =>
          edgeIds.has(edge.id)
            ? stripUndefinedProperties({ ...edge, color: edgeColor })
            : edge,
        ),
      };
      const result = store.set(executeCommandAtom, {
        type: "replace-model",
        label: "Edit filtered graph elements",
        model,
      });
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        nodeCount: nodeIds.size,
        edgeCount: edgeIds.size,
        nonNumericWeights,
      };
    },
  };
}
