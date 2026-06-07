import { getNodeByOrder } from "../core/graph/selectors";
import type { GraphModel, GraphNode } from "../core/graph/model";

export type ExportNodeEntry = {
  node: GraphNode;
  label: number;
};

export function getExportNodeEntries(model: GraphModel): ExportNodeEntry[] {
  const numericEntries = readContiguousNumericLabels(model.nodes);

  if (numericEntries) {
    return numericEntries.toSorted((a, b) => a.label - b.label);
  }

  return getNodeByOrder(model).map((node, index) => ({
    node,
    label: index + model.settings.indexBase,
  }));
}

function readContiguousNumericLabels(
  nodes: GraphNode[],
): ExportNodeEntry[] | null {
  const entries: ExportNodeEntry[] = [];
  const seen = new Set<number>();

  for (const node of nodes) {
    if (!/^-?\d+$/.test(node.label)) {
      return null;
    }

    const label = Number(node.label);

    if (!Number.isSafeInteger(label) || seen.has(label)) {
      return null;
    }

    seen.add(label);
    entries.push({ node, label });
  }

  if (entries.length === 0) {
    return entries;
  }

  const min = Math.min(...entries.map((entry) => entry.label));
  const max = Math.max(...entries.map((entry) => entry.label));

  return max - min + 1 === entries.length ? entries : null;
}
