import type { ImportFormatKind, ImportWarning } from "./import-types";

const formatNames: Record<ImportFormatKind, string> = {
  "contest-edge-list": "edge list",
  "tree-edge-list": "tree edge list",
  "parent-list": "parent list",
  "weighted-parent-list": "weighted parent list",
  "edge-pairs": "edge pair list",
  "adjacency-list": "adjacency list",
  "adjacency-matrix": "adjacency matrix",
  json: "Graph Editor JSON document",
};

const count = (value: number) => value.toLocaleString("en-US");

/** English rendering of a warning; also the diagnostic text in analyses. */
export function describeImportWarning(w: ImportWarning): string {
  const at = "line" in w ? `line ${w.line}: ` : "";

  switch (w.code) {
    case "empty-input":
      return "Empty input.";
    case "too-large":
      return `Import is too large: ${count(w.count)} ${
        w.kind === "input" ? "input characters" : w.kind
      }, maximum is ${count(w.limit)}.`;
    case "invalid-format":
      return `Input is not a valid ${formatNames[w.formatKind]}.`;
    case "unsupported-format":
      return "Input does not match a supported graph format.";
    case "ambiguous-formats":
      return "Input matches multiple graph formats. Select a format before applying.";
    case "maybe-weighted-parent-list":
      return "Input may be a weighted parent list. If the second value on each row is an edge weight, select Weighted parent list manually.";
    case "missing-edges":
      return `Expected ${w.expected} edges, found ${w.found}.`;
    case "extra-edge-lines":
      return `Ignored ${w.count} extra edge line(s).`;
    case "expected-integers":
      return `${at}expected ${w.expected} integers (${w.shape}), got ${w.got}`;
    case "node-out-of-range":
      return `${at}node id ${w.source} or ${w.target} out of range [${w.min}, ${w.max}]`;
    case "weight-not-numeric":
      return `${at}weight must be numeric.`;
    case "missing-source":
      return `${at}missing source node.`;
    case "missing-target":
      return `${at}missing target node.`;
    case "expected-header":
      return `${at}expected "N M", got "${w.got}"`;
    case "invalid-node-count":
      return `${at}invalid node count.`;
    case "invalid-edge-count":
      return `${at}invalid edge count.`;
  }
}
