import type { WeightKind } from "./model";

export function normalizeNodeLabelInput(value: string) {
  const label = value.trim();

  return label === "" ? null : label;
}

export function normalizeEdgeLabelInput(value: string) {
  const label = value.trim();

  return label === "" ? undefined : label;
}

export function normalizeEdgeWeightInput(
  value: string,
  weightKind: WeightKind,
): { value: string; error?: string } {
  const weight = value.trim() || "1";

  if (weightKind === "number" && !Number.isFinite(Number(weight))) {
    return { value: weight, error: "数値を入力してください" };
  }

  return { value: weight };
}
