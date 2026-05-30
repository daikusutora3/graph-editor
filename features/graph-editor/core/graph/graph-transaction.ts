import { graphIntentLabel } from "./graph-intents";
import { diffGraphModels, isEmptyGraphPatch } from "./graph-patch";
import { reduceGraphIntent } from "./graph-reducer";
import type { GraphIntent, GraphModel, GraphTransaction } from "./model";

export function prepareGraphTransaction(
  before: GraphModel,
  intent: GraphIntent,
  beforeRevision: number,
): GraphTransaction | null {
  const after = reduceGraphIntent(before, intent);
  const forward = diffGraphModels(before, after);

  if (isEmptyGraphPatch(forward)) {
    return null;
  }

  return {
    label: graphIntentLabel(intent),
    forward,
    backward: diffGraphModels(after, before),
    beforeRevision,
    afterRevision: beforeRevision + 1,
  };
}
