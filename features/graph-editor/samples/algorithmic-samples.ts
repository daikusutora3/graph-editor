import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import type { GraphModel, GraphSettings } from "../core/graph/model";

type Point = readonly [number, number];
type SampleEdge = readonly [number, number, number?];
type SampleFactory = (settings: Partial<GraphSettings>) => GraphModel;

function createExample(
  settings: Partial<GraphSettings>,
  required: Partial<GraphSettings>,
  positions: readonly Point[],
  edges: readonly SampleEdge[],
): GraphModel {
  const model = createEmptyGraphModel({ ...settings, ...required });
  model.nodes = positions.map(([x, y], index) =>
    createNode({
      id: `n${index}`,
      label: String(index + model.settings.indexBase),
      order: index,
      x,
      y,
    }),
  );
  model.edges = edges.map(([source, target, weight], index) =>
    createEdge({
      id: `e${index}`,
      source: `n${source}`,
      target: `n${target}`,
      weight: model.settings.weighted ? String(weight ?? 1) : undefined,
    }),
  );
  return model;
}

const numericDirectedSettings: Partial<GraphSettings> = {
  directed: true,
  weighted: true,
  weightKind: "number",
};

export const algorithmicSampleFactories = {
  zeroOne: (settings) =>
    createExample(
      settings,
      numericDirectedSettings,
      [
        [-260, 0],
        [-110, -105],
        [-110, 105],
        [50, -105],
        [50, 105],
        [205, 0],
        [335, 0],
      ],
      [
        [0, 1, 1],
        [0, 2, 0],
        [2, 1, 0],
        [1, 3, 1],
        [2, 4, 1],
        [3, 4, 0],
        [3, 5, 1],
        [4, 5, 0],
        [5, 6, 1],
      ],
    ),
  negativeEdges: (settings) => {
    const model = createExample(
      settings,
      numericDirectedSettings,
      [
        [-250, 0],
        [-100, -120],
        [-100, 120],
        [80, -120],
        [80, 120],
        [250, 0],
      ],
      [
        [0, 1, 2],
        [0, 2, 5],
        [2, 1, -4],
        [1, 2, 6],
        [1, 3, 2],
        [2, 4, 2],
        [3, 4, 3],
        [4, 5, 1],
        [3, 5, 8],
      ],
    );
    // Reversed directions use the same bow sign to place their weights apart.
    model.edges[2].routing = { bowPx: 64 };
    model.edges[3].routing = { bowPx: 64 };
    return model;
  },
  negativeCycle: (settings) =>
    createExample(
      settings,
      numericDirectedSettings,
      [
        [-235, 0],
        [-80, -105],
        [80, -105],
        [0, 100],
        [235, 0],
      ],
      [
        [0, 1, 1],
        [1, 2, 2],
        [2, 3, -4],
        [3, 1, 1],
        [3, 4, 2],
        [0, 4, 10],
      ],
    ),
  multigraph: (settings) => {
    const model = createExample(
      settings,
      { directed: false, allowMultiEdges: true, allowSelfLoops: true },
      [
        [-100, -85],
        [100, -85],
        [100, 85],
        [-100, 85],
      ],
      [
        [0, 1],
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [2, 2],
      ],
    );
    // Keep the defining parallel edges visible even if automatic routing is off.
    model.edges[0].routing = { bowPx: -32 };
    model.edges[1].routing = { bowPx: 32 };
    model.edges[5].routing = { loopDirectionDeg: 45, loopSweepDeg: 70 };
    return model;
  },
  bridges: (settings) =>
    createExample(
      settings,
      { directed: false },
      [
        [-290, 0],
        [-225, -115],
        [-160, 0],
        [-55, 0],
        [55, 0],
        [160, 0],
        [225, -115],
        [290, 0],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 0],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 5],
      ],
    ),
  bipartiteMatching: (settings) =>
    createExample(
      settings,
      { directed: false },
      [
        [-140, -165],
        [-140, -55],
        [-140, 55],
        [-140, 165],
        [140, -165],
        [140, -55],
        [140, 55],
        [140, 165],
      ],
      [
        [0, 4],
        [0, 5],
        [1, 4],
        [2, 5],
        [2, 6],
        [3, 6],
        [3, 7],
      ],
    ),
  eulerTrail: (settings) =>
    createExample(
      settings,
      { directed: false },
      [
        [-180, 0],
        [-90, -155],
        [90, -155],
        [180, 0],
        [90, 155],
        [-90, 155],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 0],
        [0, 3],
      ],
    ),
  functional: (settings) =>
    createExample(
      settings,
      { directed: true },
      [
        [-80, -60],
        [60, 70],
        [-200, 70],
        [-80, -200],
        [-190, -315],
        [30, -315],
        [235, -50],
        [235, 120],
      ],
      [
        [0, 1],
        [1, 2],
        [2, 0],
        [3, 0],
        [4, 3],
        [5, 3],
        [6, 7],
        [7, 6],
      ],
    ),
} satisfies Record<string, SampleFactory>;
