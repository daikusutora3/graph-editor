import type { GraphModel, GraphNode } from "../core/graph/model";
import type { RoutingInteraction } from "./worker-protocol";

export function restoreRoutingInteractionNodes(
  model: GraphModel,
  interaction: RoutingInteraction,
): GraphNode[] {
  return [...model.nodes, ...interaction.previousNodes];
}
