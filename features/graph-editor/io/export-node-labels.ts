import { getNodeByOrder } from "../core/graph/selectors";
import type { GraphModel, GraphNode } from "../core/graph/model";

type ExportNodeEntry = {
  node: GraphNode;
  label: number;
};

export function getExportNodeEntries(model: GraphModel): ExportNodeEntry[] {
  const numericEntries = readContiguousNumericLabels(
    model.nodes,
    model.settings.indexBase,
  );

  if (numericEntries) {
    return numericEntries;
  }

  return getNodeByOrder(model).map((node, index) => ({
    node,
    label: index + model.settings.indexBase,
  }));
}

function readContiguousNumericLabels(
  nodes: GraphNode[],
  indexBase: number,
): ExportNodeEntry[] | null {
  const entries: ExportNodeEntry[] = [];

  for (const node of nodes) {
    if (!/^-?\d+$/.test(node.label)) {
      return null;
    }

    const label = Number(node.label);

    if (
      !Number.isSafeInteger(label) ||
      label < indexBase ||
      label >= indexBase + nodes.length ||
      entries[label - indexBase] !== undefined
    ) {
      return null;
    }

    entries[label - indexBase] = { node, label };
  }

  return entries;
}
