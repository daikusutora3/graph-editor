import type { GraphModel, GraphSettings } from "../core/graph/model";
import {
  createParameterizedSampleGraph,
  type SampleGraphKind,
} from "./sample-graphs";

export type SampleParameterLabelKey =
  | "nodes"
  | "rows"
  | "columns"
  | "left"
  | "right"
  | "moveX"
  | "moveY"
  | "rungs"
  | "rim"
  | "path"
  | "triangles"
  | "spine"
  | "dimension"
  | "parts"
  | "outerNodes"
  | "step"
  | "edges"
  | "seed";

export type SampleParameter = {
  key: string;
  labelKey: SampleParameterLabelKey;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
};

export type SampleParameterValues = Readonly<Record<string, string | number>>;

export function normalizeSampleParameterInput(value: string): string {
  return value.normalize("NFKC").trim();
}

const parameter = (
  key: SampleParameterLabelKey,
  defaultValue: number,
  min: number,
  max: number,
  step = 1,
): SampleParameter => ({ key, labelKey: key, defaultValue, min, max, step });

const nodes = (defaultValue: number, min = 1, max = 1000) =>
  parameter("nodes", defaultValue, min, max);
const seed = parameter("seed", 1, 0, 999999);
const board = (size: number) => [
  parameter("rows", size, 1, 1000),
  parameter("columns", size, 1, 1000),
];

const parametersByKind = {
  path: [nodes(6)],
  cycle: [nodes(6, 3)],
  edgeless: [nodes(6)],
  complete: [nodes(5, 1, 100)],
  star: [nodes(6)],
  tree: [nodes(7)],
  grid: board(3),
  bipartite: [parameter("left", 3, 1, 999), parameter("right", 3, 1, 999)],
  crown: [parameter("nodes", 10, 4, 140, 2)],
  knight: [
    ...board(4),
    parameter("moveX", 1, 1, 999),
    parameter("moveY", 2, 1, 999),
  ],
  ladder: [parameter("rungs", 4, 1, 500)],
  wheel: [parameter("rim", 6, 3, 999)],
  fan: [parameter("path", 5, 1, 999)],
  friendship: [parameter("triangles", 3, 1, 499)],
  caterpillar: [parameter("spine", 5, 1, 333)],
  hypercube: [parameter("dimension", 4, 1, 8)],
  turan: [nodes(8, 1, 100), parameter("parts", 3, 1, 100)],
  generalizedPetersen: [
    parameter("outerNodes", 7, 3, 500),
    parameter("step", 2, 1, 249),
  ],
  randomTree: [nodes(12), seed],
  randomDag: [nodes(12), parameter("edges", 18, 0, 5000), seed],
  randomConnected: [nodes(12), parameter("edges", 18, 0, 5000), seed],
} satisfies Partial<Record<SampleGraphKind, readonly SampleParameter[]>>;

export function getSampleParameters(
  kind: SampleGraphKind,
): readonly SampleParameter[] {
  return kind in parametersByKind
    ? parametersByKind[kind as keyof typeof parametersByKind]
    : [];
}

/** Normalize all constraints together so preview and inserted graph agree. */
export function normalizeSampleParameters(
  kind: SampleGraphKind,
  values: SampleParameterValues = {},
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const definition of getSampleParameters(kind)) {
    const input = values[definition.key];
    const numericInput =
      typeof input === "string" ? normalizeSampleParameterInput(input) : input;
    const parsed = numericInput === "" ? Number.NaN : Number(numericInput);
    const value = Number.isFinite(parsed) ? parsed : definition.defaultValue;
    const step = definition.step ?? 1;
    normalized[definition.key] = Math.min(
      definition.max,
      Math.max(definition.min, Math.round(value / step) * step),
    );
  }
  if (kind === "grid" || kind === "knight") {
    normalized.columns = Math.min(
      normalized.columns,
      Math.floor(1000 / normalized.rows),
    );
  }
  if (kind === "bipartite") {
    normalized.right = Math.min(
      normalized.right,
      1000 - normalized.left,
      Math.floor(5000 / normalized.left),
    );
  }
  if (kind === "turan") {
    normalized.parts = Math.min(normalized.parts, normalized.nodes);
  }
  if (kind === "generalizedPetersen") {
    normalized.step = Math.min(
      normalized.step,
      Math.floor((normalized.outerNodes - 1) / 2),
    );
  }
  if (kind === "randomDag" || kind === "randomConnected") {
    const maxEdges = Math.min(
      5000,
      (normalized.nodes * (normalized.nodes - 1)) / 2,
    );
    const minEdges = kind === "randomConnected" ? normalized.nodes - 1 : 0;
    normalized.edges = Math.max(minEdges, Math.min(maxEdges, normalized.edges));
  }
  return normalized;
}

export function createConfiguredSampleGraph(
  kind: SampleGraphKind,
  values: SampleParameterValues = {},
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createParameterizedSampleGraph(
    kind,
    normalizeSampleParameters(kind, values),
    settings,
  );
}
