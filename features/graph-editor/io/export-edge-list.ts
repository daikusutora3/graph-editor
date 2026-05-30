import { getNodeByOrder } from "../core/graph/selectors";
import type { GraphModel } from "../core/graph/model";

type EdgeListExportOptions = {
  indexBase?: 0 | 1;
  weighted?: boolean;
};

export function exportEdgeList(
  model: GraphModel,
  options: EdgeListExportOptions = {},
): string {
  const indexBase = options.indexBase ?? model.settings.indexBase;
  const weighted = options.weighted ?? model.settings.weighted;
  const nodes = getNodeByOrder(model);
  const nodeIndex = new Map(
    nodes.map((node, index) => [node.id, index + indexBase]),
  );
  const lines = [`${nodes.length} ${model.edges.length}`];

  for (const edge of model.edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (source == null || target == null) continue;

    const columns = [String(source), String(target)];
    if (weighted) columns.push(edge.weight ?? "1");
    lines.push(columns.join(" "));
  }

  return lines.join("\n");
}
