export type RangeSelectionFilter = "all" | "nodes" | "edges";

export function rangeSelectionFilterFromModifiers({
  altKey,
  ctrlKey,
  metaKey,
  shiftKey,
}: Pick<
  MouseEvent,
  "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>): RangeSelectionFilter {
  if (altKey && (ctrlKey || metaKey)) return "edges";
  if (shiftKey && (ctrlKey || metaKey)) return "nodes";
  return "all";
}
