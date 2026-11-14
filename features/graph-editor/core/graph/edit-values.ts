export function normalizeNodeLabelInput(value: string) {
  return value.trim();
}

export function normalizeEdgeLabelInput(value: string) {
  const label = value.trim();

  return label === "" ? undefined : label;
}

export type InlineEditErrorCode = "invalid-graph";

export function normalizeEdgeWeightInput(value: string): string {
  return value.trim() || "1";
}
