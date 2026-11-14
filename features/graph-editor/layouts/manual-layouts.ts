import {
  createForceLayoutTask,
  FORCE_LAYOUT_NODE_LIMIT,
  layoutBfs,
  layoutBipartite,
  layoutConcentric,
  layoutDag,
  layoutForce,
  layoutGrid,
  layoutLine,
  layoutRadial,
  layoutScc,
  layoutSpread,
  layoutTree,
} from "./layout-algorithms";
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
  createNodeClearanceTask,
  layoutCircle,
  LAYOUT_CIRCLE_MIN_RADIUS,
} from "./layout-geometry";

type LayoutRuntimeDefinition = {
  kind: string;
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
    positions: layoutForce,
    disabledReason: (model) =>
      model.nodes.length > FORCE_LAYOUT_NODE_LIMIT ? "tooLargeGraph" : null,
  },
  {
    kind: "circle",
    positions: (model) =>
      layoutCircle(orderedNodeIds(model), LAYOUT_CIRCLE_MIN_RADIUS),
  },
  {
    kind: "grid",
    positions: (model) => layoutGrid(orderedNodeIds(model)),
  },
  {
    kind: "bfs",
    positions: layoutBfs,
  },
  {
    kind: "tree",
    positions: layoutTree,
    disabledReason: (model) => (isForest(model) ? null : "notForest"),
  },
  {
    kind: "concentric",
    positions: layoutConcentric,
  },
  {
    kind: "dagLayer",
    positions: layoutDag,
    disabledReason: (model) => {
      if (!model.settings.directed) {
        return "dagRequiresDirected";
      }

      return isDirectedAcyclic(model) ? null : "notDag";
    },
  },
  {
    kind: "bipartite",
    positions: layoutBipartite,
    disabledReason: (model) => (isBipartite(model) ? null : "notBipartite"),
  },
  {
    kind: "scc",
    positions: layoutScc,
    disabledReason: (model) =>
      model.settings.directed ? null : "sccRequiresDirected",
  },
  {
    kind: "radial",
    positions: layoutRadial,
  },
  {
    kind: "line",
    positions: layoutLine,
  },
  {
    kind: "spread",
    positions: layoutSpread,
  },
] as const satisfies readonly LayoutRuntimeDefinition[];

export type LayoutKind = (typeof manualLayoutDefinitions)[number]["kind"];

export const layoutKinds = manualLayoutDefinitions.map(({ kind }) => kind);

export function createManualLayoutCommand(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const task = createManualLayoutTask(model, kind, rootNodeId);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

export function* createManualLayoutTask(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
): Generator<void, ReturnType<typeof createMoveNodesCommand>> {
  const after = yield* createLayoutPositionsTask(model, kind, rootNodeId);

  return createMoveNodesCommand(`Apply ${kind} layout`, after);
}

function* createLayoutPositionsTask(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const positions =
    kind === "force"
      ? yield* createForceLayoutTask(model)
      : getLayoutRuntime(kind).positions(model, rootNodeId);

  if (kind === "spread") return positions;

  if (
    kind === "force" &&
    model.nodes.every((node) => estimateNodeWidth(node.label) <= NODE_SIZE_PX)
  ) {
    return positions;
  }

  return yield* createNodeClearanceTask(
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

function getLayoutRuntime(kind: LayoutKind): LayoutRuntimeDefinition {
  const runtime = manualLayoutDefinitions.find(
    (definition) => definition.kind === kind,
  );

  if (!runtime) {
    throw new Error(`Unknown layout kind: ${kind}`);
  }

  return runtime;
}
