import { graphIntentLabel } from "./graph-intents";
import { diffGraphModels, isEmptyGraphPatch } from "./graph-patch";
import { reduceGraphIntent } from "./graph-reducer";
import type { GraphIntent, GraphModel, GraphTransaction } from "./model";

export type PreparedGraphTransaction = {
  after: GraphModel;
  transaction: GraphTransaction;
};

export function prepareGraphTransaction(
  before: GraphModel,
  intent: GraphIntent,
  beforeRevision: number,
): PreparedGraphTransaction | null {
  const after = reduceGraphIntent(before, intent);
  const forward = diffGraphModels(before, after);

  if (isEmptyGraphPatch(forward)) {
    return null;
  }

  return {
    after,
    transaction: {
      label: graphIntentLabel(intent),
      forward,
      backward: diffGraphModels(after, before),
      beforeRevision,
      afterRevision: beforeRevision + 1,
    },
  };
}
