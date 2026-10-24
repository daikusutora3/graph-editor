import type { GraphModel, GraphNode } from "../core/graph/model";
import type { RoutingInteraction } from "./worker-protocol";

/** Restore current obstacles followed by old moved positions, without remote state. */
export function restoreRoutingInteractionNodes(
  model: GraphModel,
  interaction: RoutingInteraction,
): GraphNode[] {
  if ("nodes" in interaction) return interaction.nodes;
  // Preserve browser-measured geometry. A Worker has no DOM from which to
  // reconstruct the current font's capsule width and height.
  const currentNodes = model.nodes;
  // Do not deduplicate: all old/current obstacle positions are tested, and
  // endpoint lookup keeps its existing last-wins order for duplicate ids.
  return [...currentNodes, ...interaction.previousNodes];
}
