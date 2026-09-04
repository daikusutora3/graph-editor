import type { WeightKind } from "./model";

export function normalizeNodeLabelInput(value: string) {
  return value.trim();
}

export function normalizeEdgeLabelInput(value: string) {
  const label = value.trim();

  return label === "" ? undefined : label;
}

/** Validation failures are codes; the UI resolves them through i18n. */
export type InlineEditErrorCode = "invalid-number";

export function normalizeEdgeWeightInput(
  value: string,
  weightKind: WeightKind,
): { value: string; error?: InlineEditErrorCode } {
  const weight = value.trim() || "1";

  if (weightKind === "number" && !Number.isFinite(Number(weight))) {
    return { value: weight, error: "invalid-number" };
  }

  return { value: weight };
}
