import type { GraphModel } from "../core/graph/model";
import { getExportNodeEntries } from "./export-node-labels";

export function exportEdgeList(model: GraphModel): string {
  const nodes = getExportNodeEntries(model);
  const nodeIndex = new Map(nodes.map((entry) => [entry.node.id, entry.label]));
  const lines = [`${nodes.length} ${model.edges.length}`];

  for (const edge of model.edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (source == null || target == null) continue;

    const columns = [String(source), String(target)];
    if (model.settings.weighted) columns.push(edge.weight ?? "1");
    lines.push(columns.join(" "));
  }

  return lines.join("\n");
}
