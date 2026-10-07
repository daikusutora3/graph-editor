import type { RangeSelectionFilter } from "../shell/state/editor-state";
export type { RangeSelectionFilter } from "../shell/state/editor-state";

export function rangeSelectionFilterFromModifiers(
  {
    altKey,
    ctrlKey,
    metaKey,
    shiftKey,
  }: Pick<MouseEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
  filter: RangeSelectionFilter = "all",
): RangeSelectionFilter {
  if (altKey && (ctrlKey || metaKey)) return "edges";
  if (shiftKey && (ctrlKey || metaKey)) return "nodes";
  return filter;
}
