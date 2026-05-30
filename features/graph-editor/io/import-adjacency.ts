import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import {
  arrangeNodes,
  detectIndexBase,
  ensureNodeByLabel,
  type ImportOptions,
  type ParsedLine,
  readImportSettings,
  splitTokens,
} from "./import-utils";
import type { NodeId } from "../core/graph/model";
import type { ImportResult } from "./import-types";

export function tryImportAdjacencyMatrix(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const rows = lines.map((line) => splitTokens(line.text));

  if (rows.length < 2 || rows.some((row) => row.length !== rows.length)) {
    return null;
  }

  const values = rows.map((row) => row.map(Number));
  if (values.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return null;
  }

  if (values.length < 3 || values.some((row) => !row.includes(0))) {
    return null;
  }

  const hasWeightedValue = values.some((row) =>
    row.some((value) => value !== 0 && value !== 1),
  );
  const settings = readImportSettings(options, { weighted: hasWeightedValue });
  const model = createEmptyGraphModel(settings);

  model.nodes = Array.from({ length: values.length }, (_, index) =>
    createNode({
      id: `n${index}`,
      label: String(index + settings.indexBase),
      order: index,
    }),
  );
  arrangeNodes(model);

  values.forEach((row, sourceIndex) => {
    row.forEach((value, targetIndex) => {
      if (value === 0) {
        return;
      }

      if (!settings.directed && targetIndex < sourceIndex) {
        return;
      }

      model.edges.push(
        createEdge({
          id: `e${model.edges.length}`,
          source: model.nodes[sourceIndex].id,
          target: model.nodes[targetIndex].id,
          weight: settings.weighted ? String(value) : undefined,
        }),
      );
    });
  });

  return { model, warnings: [], format: "Adjacency matrix" };
}

export function tryImportAdjacencyList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  if (!lines.every((line) => /[:]|->/.test(line.text))) {
    return null;
  }

  const labels = lines.flatMap((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [sourceText, targetText = ""] = line.text.split(separator);
    return [
      sourceText.trim(),
      ...splitTokens(targetText).map(
        (token) => parseAdjacencyTarget(token).label,
      ),
    ];
  });
  const hasWeightedTargets = lines.some((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [, targetText = ""] = line.text.split(separator);
    return splitTokens(targetText).some(
      (token) => parseAdjacencyTarget(token).weight != null,
    );
  });
  const settings = readImportSettings(
    {
      ...options,
      indexBase: detectIndexBase(labels, options.indexBase),
    },
    { weighted: hasWeightedTargets || options.weighted ? true : false },
  );
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const seenUndirected = new Set<string>();
  const warnings: string[] = [];

  lines.forEach((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [sourceText, targetText = ""] = line.text.split(separator);
    const sourceLabel = sourceText.trim();

    if (!sourceLabel) {
      warnings.push(`line ${line.number}: missing source node.`);
      return;
    }

    const source = ensureNodeByLabel(model, idByLabel, sourceLabel);
    const targets = splitTokens(targetText);

    if (targets.length === 0) {
      return;
    }

    targets.forEach((targetToken) => {
      const parsedTarget = parseAdjacencyTarget(targetToken);
      const { label: targetLabel } = parsedTarget;

      if (!targetLabel) {
        warnings.push(`line ${line.number}: missing target node.`);
        return;
      }

      const target = ensureNodeByLabel(model, idByLabel, targetLabel);

      if (!settings.directed) {
        const key = [source, target].sort().join("\0");
        if (seenUndirected.has(key)) {
          return;
        }
        seenUndirected.add(key);
      }

      model.edges.push(
        createEdge({
          id: `e${model.edges.length}`,
          source,
          target,
          weight: settings.weighted ? (parsedTarget.weight ?? "1") : undefined,
        }),
      );
    });
  });

  arrangeNodes(model);

  return { model, warnings, format: "Adjacency list" };
}

function parseAdjacencyTarget(token: string) {
  const weightedMatch = token.match(/^(.+)\(([^()]*)\)$/);

  if (!weightedMatch) {
    return { label: token, weight: undefined };
  }

  const [, label, weight] = weightedMatch;
  return {
    label: label.trim(),
    weight: weight.trim() || "1",
  };
}
