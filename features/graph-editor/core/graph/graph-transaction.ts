import { serializeGraphModel } from "./graph-json";
import { graphIntentLabel } from "./graph-intents";
import { diffGraphModels, isEmptyGraphPatch } from "./graph-patch";
import { reduceGraphIntent } from "./graph-reducer";
import type { GraphIntent, GraphModel, GraphTransaction } from "./model";

export type PreparedGraphTransaction = {
  after: GraphModel;
  serialized: string;
  transaction: GraphTransaction;
};

export function prepareGraphTransaction(
  before: GraphModel,
  intent: GraphIntent,
  beforeRevision: number,
): PreparedGraphTransaction | null {
  const after = reduceGraphIntent(before, intent);
  if (intent.type === "put-graph-elements") {
    const afterIds = new Set(after.edges.map((edge) => edge.id));
    if (intent.edges.some((edge) => !afterIds.has(edge.id)))
      throw new Error("Graph operation would drop edges");
  }
  const serialized = serializeGraphModel(after);
  const forward = diffGraphModels(before, after);

  if (isEmptyGraphPatch(forward)) {
    return null;
  }

  return {
    after,
    serialized,
    transaction: {
      label: graphIntentLabel(intent),
      forward,
      backward: diffGraphModels(after, before),
      beforeRevision,
      afterRevision: beforeRevision + 1,
    },
  };
}
