import type { GraphModel, GraphNode } from "../core/graph/model";
import type { RoutingInteraction } from "./worker-protocol";

/** Restore current obstacles followed by old moved positions, without remote state. */
export function restoreRoutingInteractionNodes(
  model: GraphModel,
  interaction: RoutingInteraction,
): GraphNode[] {
  if ("nodes" in interaction) return interaction.nodes;
  // The measured widths in the routing model are transient. Interactive
  // selection historically uses unmeasured GraphNodes, like the Cytoscape
  // fallback, while final route calculation still uses the measured model.
  const currentNodes = model.nodes.map(({ id, label, order, x, y, color }) => ({
    id,
    label,
    order,
    x,
    y,
    ...(color === undefined ? {} : { color }),
  }));
  // Do not deduplicate: all old/current obstacle positions are tested, and
  // endpoint lookup keeps its existing last-wins order for duplicate ids.
  return [...currentNodes, ...interaction.previousNodes];
}
