import type { GraphModel, GraphNode } from "../core/graph/model";
import type { RoutingInteraction } from "./worker-protocol";

export function restoreRoutingInteractionNodes(
  model: GraphModel,
  interaction: RoutingInteraction,
): GraphNode[] {
  if ("nodes" in interaction) return interaction.nodes;

  const currentNodes = model.nodes;

  return [...currentNodes, ...interaction.previousNodes];
}
