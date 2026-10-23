import type { ImportFormat } from "./import-utils";

/** Complete, importable examples; never use schema abbreviations as data. */
export const IMPORT_FORMAT_EXAMPLES: Record<ImportFormat, string> = {
  auto: "4 4\n0 1\n1 2\n1 3\n2 3",
  "contest-edge-list": "4 4\n0 1\n1 2\n1 3\n2 3",
  "tree-edge-list": "4\n0 1\n0 2\n2 3",
  "parent-list": "4\n0 0 2",
  "weighted-parent-list": "4\n0 5\n0 3\n2 2",
  "edge-pairs": "0 1\n1 2\n1 3\n2 3",
  "adjacency-list": "0: 1 2\n1: 3\n2: 3",
  "adjacency-matrix": "0 1 1\n1 0 1\n1 1 0",
  json: JSON.stringify(
    {
      version: 1,
      nodes: [
        { id: "a", label: "0", order: 0, x: 0, y: 0 },
        { id: "b", label: "1", order: 1, x: 120, y: 0 },
      ],
      edges: [{ id: "ab", source: "a", target: "b" }],
      settings: { indexBase: 0 },
    },
    null,
    2,
  ),
};

/** Parent and tree formats must use the same numbering as the current graph. */
export function getImportExample(format: ImportFormat, indexBase: 0 | 1) {
  if (indexBase === 0 || format === "json" || format === "adjacency-matrix")
    return IMPORT_FORMAT_EXAMPLES[format];
  if (format === "weighted-parent-list") return "4\n1 5\n1 3\n3 2";
  return IMPORT_FORMAT_EXAMPLES[format].replace(/\d+/g, (number, offset) => {
    // The first line of these formats is a count, not a vertex number.
    const firstLine = IMPORT_FORMAT_EXAMPLES[format].indexOf("\n");
    if (
      ["auto", "contest-edge-list", "tree-edge-list", "parent-list"].includes(
        format,
      ) &&
      offset < firstLine
    )
      return number;
    return String(Number(number) + 1);
  });
}
