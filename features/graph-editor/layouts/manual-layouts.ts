import { layoutLine } from "./layout-algorithms";
import { layoutScc } from "./layout-algorithms";
import { layoutGrid } from "./layout-algorithms";
import { layoutConcentric } from "./layout-algorithms";
import { layoutBfs } from "./layout-algorithms";
import { layoutForce } from "./layout-algorithms";
import { layoutSpread } from "./layout-algorithms";
import { layoutTree } from "./layout-algorithms";
import { layoutDag } from "./layout-algorithms";
import { layoutBipartite } from "./layout-algorithms";
import { FORCE_LAYOUT_NODE_LIMIT } from "./layout-algorithms";
import { layoutRadial } from "./layout-algorithms";
import { createMoveNodesCommand } from "../core/graph/graph-intents";
import { estimateNodeWidth, NODE_SIZE_PX } from "../core/graph/node-size";
import type { GraphModel, NodeId } from "../core/graph/model";
import {
  isBipartite,
  isDirectedAcyclic,
  isForest,
  orderedNodeIds,
} from "../core/graph/graph-analysis";
import {
  ensureNodeClearance,
  layoutCircle,
  LAYOUT_CIRCLE_MIN_RADIUS,
} from "./layout-geometry";

type LayoutRuntimeDefinition = {
  kind: string;
  priority: "primary" | "advanced";
  positions: (
    model: GraphModel,
    rootNodeId?: NodeId,
  ) => Record<NodeId, { x: number; y: number }>;
  disabledReason?: (model: GraphModel) => LayoutDisabledReason | null;
};

export type LayoutDisabledReason =
  | "emptyGraph"
  | "tooLargeGraph"
  | "notForest"
  | "dagRequiresDirected"
  | "notDag"
  | "notBipartite"
  | "sccRequiresDirected";

const manualLayoutDefinitions = [
  {
    kind: "force",
    priority: "primary",
    positions: (model) => layoutForce(model),
    disabledReason: (model) =>
      model.nodes.length > FORCE_LAYOUT_NODE_LIMIT ? "tooLargeGraph" : null,
  },
  {
    kind: "circle",
    priority: "advanced",
    positions: (model) =>
      layoutCircle(orderedNodeIds(model), LAYOUT_CIRCLE_MIN_RADIUS),
  },
  {
    kind: "grid",
    priority: "advanced",
    positions: (model) => layoutGrid(orderedNodeIds(model)),
  },
  {
    kind: "bfs",
    priority: "primary",
    positions: (model, rootNodeId) => layoutBfs(model, rootNodeId),
  },
  {
    kind: "tree",
    priority: "advanced",
    positions: (model, rootNodeId) => layoutTree(model, rootNodeId),
    disabledReason: (model) => (isForest(model) ? null : "notForest"),
  },
  {
    kind: "concentric",
    priority: "advanced",
    positions: (model) => layoutConcentric(model),
  },
  {
    kind: "dagLayer",
    priority: "advanced",
    positions: (model) => layoutDag(model),
    disabledReason: (model) => {
      if (!model.settings.directed) {
        return "dagRequiresDirected";
      }

      return isDirectedAcyclic(model) ? null : "notDag";
    },
  },
  {
    kind: "bipartite",
    priority: "advanced",
    positions: (model) => layoutBipartite(model),
    disabledReason: (model) => (isBipartite(model) ? null : "notBipartite"),
  },
  {
    kind: "scc",
    priority: "advanced",
    positions: (model) => layoutScc(model),
    disabledReason: (model) =>
      model.settings.directed ? null : "sccRequiresDirected",
  },
  {
    kind: "radial",
    priority: "advanced",
    positions: (model, rootNodeId) => layoutRadial(model, rootNodeId),
  },
  {
    kind: "line",
    priority: "advanced",
    positions: (model) => layoutLine(model),
  },
  {
    kind: "spread",
    priority: "primary",
    positions: (model) => layoutSpread(model),
  },
] as const satisfies readonly LayoutRuntimeDefinition[];

export type LayoutKind = (typeof manualLayoutDefinitions)[number]["kind"];

export type LayoutDefinition = {
  kind: LayoutKind;
  priority: "primary" | "advanced";
};

export const layoutDefinitions: readonly LayoutDefinition[] =
  manualLayoutDefinitions.map(({ kind, priority }) => ({
    kind,
    priority,
  }));

const layoutRuntimeByKind = new Map<LayoutKind, LayoutRuntimeDefinition>(
  manualLayoutDefinitions.map((definition) => [definition.kind, definition]),
);

export function createManualLayoutCommand(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const after = createLayoutPositions(model, kind, rootNodeId);

  return createMoveNodesCommand(`Apply ${kind} layout`, after);
}

function createLayoutPositions(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const positions = getLayoutRuntime(kind).positions(model, rootNodeId);

  if (kind === "spread") return positions;

  // Force layouts space circles themselves; wide pills still need the pass.
  if (
    kind === "force" &&
    model.nodes.every((node) => estimateNodeWidth(node.label) <= NODE_SIZE_PX)
  ) {
    return positions;
  }

  return ensureNodeClearance(
    positions,
    model.nodes.map((node) => ({
      ...node,
      label: model.settings.showNodeLabels ? node.label : "",
    })),
  );
}

export function manualLayoutDisabledReasonCode(
  kind: LayoutKind,
  model: GraphModel,
): LayoutDisabledReason | null {
  if (model.nodes.length === 0) {
    return "emptyGraph";
  }

  return getLayoutRuntime(kind).disabledReason?.(model) ?? null;
}

function getLayoutRuntime(kind: LayoutKind) {
  const runtime = layoutRuntimeByKind.get(kind);

  if (!runtime) {
    throw new Error(`Unknown layout kind: ${kind}`);
  }

  return runtime;
}
