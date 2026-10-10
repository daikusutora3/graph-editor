import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  GraphColor,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";
import {
  sampleEdgeCurve,
  edgeCurveSegments,
  type EdgeCurvePoint,
  type QuadraticCurveSegment,
} from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  getModelBounds,
  createPreviewEdgePath,
  SampleGraphPreview,
} from "../../features/graph-editor/ui/samples/SampleGraphPreview";
import { previewCurveBounds } from "../../features/graph-editor/ui/samples/preview-curve-bounds";
import { clipPreviewEdgeAtTarget } from "../../features/graph-editor/ui/samples/preview-edge-clip";
import {
  preparePreviewGeometry,
  type PreviewGeometryWork,
} from "../../features/graph-editor/ui/samples/preview-geometry";
import { samplePreviewSvgCases } from "../fixtures/sample-preview-svg-cases";
import samplePreviewSvg from "../fixtures/sample-preview-svg.json";
import {
  createGraphCanvasStylesheet,
  type GraphCanvasPalette,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";

verifyPreviewPaintMatchesCanvas();
verifyClippingFixtures();
verifyPreviewSettings();
verifyPreparedGeometry();

const quadratic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: -100, y: 180 },
  { x: 100, y: 0 },
]);
near(quadratic.minX, -100 / 3);
near(quadratic.maxX, 100);
near(quadratic.minY, 0);
near(quadratic.maxY, 90);

const cubic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: 100, y: 180 },
  { x: -100, y: -180 },
  { x: 0, y: 0 },
]);
near(cubic.minX, -100 / (2 * Math.sqrt(3)));
near(cubic.maxX, 100 / (2 * Math.sqrt(3)));
near(cubic.minY, -180 / (2 * Math.sqrt(3)));
near(cubic.maxY, 180 / (2 * Math.sqrt(3)));

const degenerateCubic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: 20, y: 40 },
  { x: 40, y: 40 },
  { x: 60, y: 0 },
]);
near(degenerateCubic.minX, 0);
near(degenerateCubic.maxX, 60);
near(degenerateCubic.maxY, 30);
assert.deepEqual(
  previewCurveBounds([
    { x: 2, y: -3 },
    { x: 2, y: -3 },
    { x: 2, y: -3 },
  ]),
  { minX: 2, maxX: 2, minY: -3, maxY: -3 },
);

const bowedModel = createModel();
const bounds = getModelBounds(
  bowedModel,
  computeEdgeRouting(bowedModel, { mode: "simple" }),
  true,
);
near(bounds.minX, -24);
near(bounds.width, 148);
near(bounds.minY, -24);
near(bounds.height, 114);

const multiRoutes = computeEdgeRouting(bowedModel, { mode: "simple" });
const multiCurve = {
  controlPointDistancesPx: [120, -200, 180],
  controlPointWeights: [0.2, 0.5, 0.8],
};
multiRoutes.set("edge", { ...multiRoutes.get("edge")!, ...multiCurve });
const multiBounds = getModelBounds(bowedModel, multiRoutes, true);
for (const point of sampleEdgeCurve(
  bowedModel.nodes[0],
  bowedModel.nodes[1],
  multiCurve,
  200,
)) {
  assert(
    point.x >= multiBounds.minX - 1e-8 &&
      point.x <= multiBounds.minX + multiBounds.width + 1e-8,
  );
  assert(
    point.y >= multiBounds.minY - 1e-8 &&
      point.y <= multiBounds.minY + multiBounds.height + 1e-8,
  );
}
assert(
  multiBounds.minY < -24 && multiBounds.minY + multiBounds.height > 24,
  "chained quadratic bounds include bends on both sides of the chord",
);

// Sample the rendered SVG rather than mirroring the bounds helper. These cases
// exercise the actual fit scale, clipped arrow endpoints and shared C loops.
for (const directed of [false, true]) {
  for (const variant of ["editor", "sample"] as const) {
    for (const bowPx of [-180, -50, -48, -0.5, 0, 0.5, 48, 50, 180]) {
      for (const [targetX, targetY] of [
        [100, 0],
        [0, 100],
        [100, 80],
        [160, 0],
        [20, 0],
        [-20, 0],
        [0, -20],
        [-20, -20],
        [50, 0],
        [0.1, 0],
        [0.5, 0],
        [1, 0],
      ]) {
        const model = createModel(directed, targetX, targetY, bowPx);
        for (const focus of [false, true])
          verifyRenderedFit(model, variant, focus);
      }
    }
    for (const loopDirectionDeg of [-90, 0, 45, 120, 180]) {
      const model = {
        ...createEmptyGraphModel({ directed }),
        nodes: [{ id: "a", order: 0, label: "long label 日本語", x: 0, y: 0 }],
        edges: [
          {
            id: "loop",
            source: "a",
            target: "a",
            routing: {
              loopDirectionDeg,
              loopSweepDeg: 110,
              loopStepSizePx: 40,
            },
          },
        ],
      };
      verifyRenderedFit(model, variant);
      for (const loopStepSizePx of [40, 180]) {
        model.edges[0].routing.loopStepSizePx = loopStepSizePx;
        verifyRenderedFit(model, variant, true, 98, 76);
      }
    }
  }
}
verifyRenderedFit(createModel(true, 50, 0, 180), "editor", true);
// Tangential entries on overlapping nodes can put the marker's base outside
// centreline bounds. Include the actual gallery size and a narrow editor frame.
for (const variant of ["editor", "sample"] as const)
  for (const focus of [false, true])
    for (const [width, height] of [
      [98, 76],
      [132, 88],
      [160, 150],
      [320, 150],
      [80, 75],
    ])
      for (const bowPx of [0.5, 48, 50, 180])
        for (const targetX of [0.1, 0.5, 160, 10000])
          verifyRenderedFit(
            createModel(true, targetX, 0, bowPx),
            variant,
            focus,
            width,
            height,
          );
const denseModel: GraphModel = {
  ...createEmptyGraphModel({ directed: true }),
  nodes: Array.from({ length: 16 }, (_, index) => ({
    id: `node-${index}`,
    order: index,
    label: `${index}`,
    x: index * 100,
    y: Math.sin(index) * 60,
  })),
  edges: Array.from({ length: 15 }, (_, index) => ({
    id: `edge-${index}`,
    source: `node-${index}`,
    target: `node-${index + 1}`,
    routing: { bowPx: 50, bowT: 0.5 },
  })),
};
for (const variant of ["editor", "sample"] as const)
  for (const focus of [false, true])
    verifyRenderedFit(denseModel, variant, focus, 98, 76);
for (const variant of ["editor", "sample"] as const)
  verifyRenderedFit(createModel(true, 0, 0, 180), variant, true);
verifyRenderedFit(
  {
    ...createEmptyGraphModel(),
    nodes: [{ id: "a", order: 0, label: "long label 日本語", x: 80, y: -120 }],
  },
  "editor",
);
assert.deepEqual(getModelBounds(createEmptyGraphModel(), new Map(), true), {
  minX: -1,
  minY: -1,
  width: 2,
  height: 2,
});
assert.equal(
  createPreviewEdgePath({
    directed: true,
    radius: 24,
    scale: 1,
    source: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
  }),
  "M0 0Q38 0 76 0",
  "a straight directed edge ends at its target circle, without an extra gap",
);

for (const targetX of [0.1, 0.5, 1]) {
  const original = createPreviewEdgePath({
    directed: true,
    radius: 24,
    scale: 1,
    source: { x: 0, y: 0 },
    target: { x: targetX, y: 0 },
  })
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  for (const scale of [0.2, 0.5, 2, 3]) {
    const scaled = createPreviewEdgePath({
      directed: true,
      radius: 24 * scale,
      scale,
      source: { x: 0, y: 0 },
      target: { x: targetX * scale, y: 0 },
    })
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    scaled.forEach((coordinate, index) => {
      assert(
        Math.abs(coordinate - original[index] * scale) < 0.016,
        "clipped arrow endpoints must scale with the rest of the path",
      );
    });
  }
}

console.log("Sample preview bounds verification passed");

function verifyPreparedGeometry() {
  const cases = samplePreviewSvgCases();
  for (const { name, ...props } of cases) {
    const golden = (samplePreviewSvg as Record<string, string>)[name];
    if (!golden) continue;
    // Attribute precision below one millionth of a screen pixel is irrelevant
    // to paint. Normalize it so Math.sin host rounding cannot break CI.
    const actual = renderToStaticMarkup(
      createElement(SampleGraphPreview, props),
    ).replace(/[-+]?\d+\.\d+(?:e[-+]?\d+)?/gi, (number) =>
      String(Number(Number(number).toFixed(6))),
    );
    assert.equal(actual, golden, `${name}: complete representative SVG`);
  }

  const { model } = cases.find(({ name }) => name === "chunked-editor")!;
  const work: PreviewGeometryWork = {
    nodeIndexBuilds: 0,
    nodeWidthReads: 0,
    edgeSegmentBuilds: 0,
    targetClips: 0,
    loopBuilds: 0,
  };
  const geometry = preparePreviewGeometry(
    model,
    computeEdgeRouting(model, { mode: "simple" }),
    true,
    1,
    work,
  );
  assert.deepEqual(
    work,
    {
      nodeIndexBuilds: 1,
      nodeWidthReads: 260,
      edgeSegmentBuilds: 259,
      targetClips: 259,
      loopBuilds: 0,
    },
    "one shared index, width and curve/clip preparation per directed editor preview",
  );
  assert.equal(geometry.nodeById.get("n259"), model.nodes[259]);
  assert.equal(geometry.edgeById.size, 259);
  assert(
    geometry.edgeById.get("e0")!.clippedSegments,
    "arrow bounds and SVG share the prepared target clip",
  );
  const markup = renderToStaticMarkup(
    createElement(SampleGraphPreview, { model, variant: "editor" }),
  );
  assert.equal(
    [...markup.matchAll(/<rect\b/g)].length,
    260,
    "all node chunks are rendered",
  );
  assert.equal(
    [...markup.matchAll(/<path\b[^>]*stroke=/g)].length,
    259,
    "all edge chunks are rendered",
  );

  const mixed = cases.find(
    ({ name }) => name === "true-editor-false-true-98",
  )!.model;
  const mixedWork: PreviewGeometryWork = {
    nodeIndexBuilds: 0,
    nodeWidthReads: 0,
    edgeSegmentBuilds: 0,
    targetClips: 0,
    loopBuilds: 0,
  };
  const mixedGeometry = preparePreviewGeometry(
    mixed,
    computeEdgeRouting(mixed, { mode: "simple" }),
    true,
    1,
    mixedWork,
  );
  assert.deepEqual(mixedWork, {
    nodeIndexBuilds: 1,
    nodeWidthReads: 3,
    edgeSegmentBuilds: 3,
    targetClips: 3,
    loopBuilds: 1,
  });
  assert(
    !mixedGeometry.edgeById.has("missing"),
    "dangling endpoints are omitted consistently",
  );
  const gallery = preparePreviewGeometry(
    mixed,
    computeEdgeRouting(mixed, { mode: "simple" }),
    false,
  );
  assert(
    !gallery.edgeById.get("straight")!.clippedSegments,
    "fixed screen-size gallery targets are clipped after fitting",
  );
  console.log(
    JSON.stringify({
      previewNodes: model.nodes.length,
      previewEdges: model.edges.length,
      work,
    }),
  );
}

function createModel(
  directed = false,
  targetX = 100,
  targetY = 0,
  bowPx = 180,
): GraphModel {
  return {
    ...createEmptyGraphModel({ directed }),
    nodes: [
      { id: "a", order: 0, label: "A", x: 0, y: 0 },
      { id: "b", order: 1, label: "B", x: targetX, y: targetY },
    ],
    edges: [
      { id: "edge", source: "a", target: "b", routing: { bowPx, bowT: 0.5 } },
    ],
  };
}

function verifyRenderedFit(
  model: GraphModel,
  variant: "sample" | "editor",
  focus = false,
  width = 160,
  height = 150,
) {
  const markup = renderToStaticMarkup(
    createElement(SampleGraphPreview, {
      model,
      width,
      height,
      variant,
      focus,
    }),
  );
  const paths = [
    ...markup.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*stroke="[^"]+"[^>]*>/g),
  ];
  const nodes = [...markup.matchAll(/<(?:rect|circle)\b[^>]+/g)].map(
    ([shape], index) => {
      const read = (attribute: string) =>
        Number(shape.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
      const centre = shape.startsWith("<rect")
        ? {
            x: read("x") + read("width") / 2,
            y: read("y") + read("height") / 2,
            width: read("width"),
            height: read("height"),
          }
        : {
            x: read("cx"),
            y: read("cy"),
            width: read("r") * 2,
            height: read("r") * 2,
          };
      return [model.nodes[index].id, centre] as const;
    },
  );
  const nodeCentres = new Map(nodes);
  const routes = computeEdgeRouting(model, { mode: "simple" });
  if (model.settings.directed)
    assert.match(markup, /<marker\b[^>]*refX="5\.25"/);
  assert.equal(
    paths.length,
    model.edges.length,
    "every model edge is included in the SVG fit check",
  );
  for (const [edgeIndex, [pathTag, path]] of paths.entries()) {
    assert.equal(
      pathTag.includes("marker-end="),
      model.settings.directed,
      "only directed edges have an arrow marker",
    );
    const tokens = path.match(/[MQCL]|-?\d+(?:\.\d+)?/g)!;
    const edgeStroke = Number(pathTag.match(/\bstroke-width="([^"]+)"/)![1]);
    let start = { x: 0, y: 0 };
    let finalControl = start;
    let firstControl: { x: number; y: number } | null = null;
    const quadratics: QuadraticCurveSegment[] = [];
    for (let index = 0; index < tokens.length;) {
      const command = tokens[index++];
      if (command === "M") {
        start = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
        continue;
      }
      const count = command === "C" ? 3 : command === "Q" ? 2 : 1;
      const points = [start];
      for (let control = 0; control < count; control++) {
        points.push({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
      }
      firstControl ??= points[1];
      finalControl = points.at(-2)!;
      if (count === 2)
        quadratics.push({ start, control: points[1], end: points[2] });
      for (let sample = 0; sample <= 200; sample++) {
        const t = sample / 200;
        const weights =
          count === 3
            ? [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3]
            : count === 2
              ? [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2]
              : [1 - t, t];
        const x = points.reduce(
          (sum, point, pointIndex) => sum + point.x * weights[pointIndex],
          0,
        );
        const y = points.reduce(
          (sum, point, pointIndex) => sum + point.y * weights[pointIndex],
          0,
        );
        assert(
          x - edgeStroke / 2 >= 1 &&
            x + edgeStroke / 2 <= width - 1 &&
            y - edgeStroke / 2 >= 1 &&
            y + edgeStroke / 2 <= height - 1,
          `${variant} painted curve leaves ${width}x${height} preview at ${x},${y}: ${path}`,
        );
      }
      start = points.at(-1)!;
    }
    if (model.settings.directed) {
      const marker = markup.match(/<marker\b[^>]*>/)![0];
      assert.match(marker, /markerUnits="strokeWidth"/);
      assert.match(marker, /orient="auto"/);
      const readMarker = (attribute: string) =>
        Number(marker.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
      const arrowScale = variant === "editor" ? model.settings.arrowScale : 1;
      near(readMarker("markerWidth"), 5.25 * arrowScale);
      near(readMarker("markerHeight"), 4.5 * arrowScale);
      const triangle = markup
        .match(/<marker\b[^>]*><path\b[^>]*d="([^"]+)"/)![1]
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number);
      const viewBox = marker
        .match(/\bviewBox="([^"]+)"/)![1]
        .split(" ")
        .map(Number);
      const markerScale = Math.min(
        readMarker("markerWidth") / viewBox[2],
        readMarker("markerHeight") / viewBox[3],
      );
      const angle = Math.atan2(
        start.y - finalControl.y,
        start.x - finalControl.x,
      );
      for (let index = 0; index < triangle.length; index += 2) {
        const localX =
          (triangle[index] - readMarker("refX")) * markerScale * edgeStroke;
        const localY =
          (triangle[index + 1] - readMarker("refY")) * markerScale * edgeStroke;
        const x = start.x + localX * Math.cos(angle) - localY * Math.sin(angle);
        const y = start.y + localX * Math.sin(angle) + localY * Math.cos(angle);
        assert(
          x >= 1 && x <= width - 1 && y >= 1 && y <= height - 1,
          `${variant} marker vertex leaves ${width}x${height} preview at ${x},${y}: ${path}`,
        );
      }
    }
    const edge = model.edges[edgeIndex];
    const source = nodeCentres.get(edge.source)!;
    const target = nodeCentres.get(edge.target)!;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const progress =
        ((start.x - source.x) * dx + (start.y - source.y) * dy) /
        (length * length);
      const roundingTolerance = 0.025 / length;
      assert(
        progress >= (model.settings.directed ? 0 : 1) - roundingTolerance &&
          progress <= 1 + roundingTolerance,
        `${variant} edge endpoint must remain toward its target: ${path}`,
      );
      assert(
        (start.x - finalControl.x) * dx + (start.y - finalControl.y) * dy >=
          -0.025 * length,
        `${variant} arrow tangent must point along the source-to-target chord: ${path}`,
      );
      if (edge.routing?.bowPx && firstControl) {
        const bend =
          dx * (firstControl.y - source.y) - dy * (firstControl.x - source.x);
        assert(
          Math.sign(bend) === Math.sign(edge.routing.bowPx) ||
            Math.abs(bend) < 0.025 * length,
          `${variant} shortening must retain the curve's bend side: ${path}`,
        );
      }
      const sourceModel = model.nodes.find((node) => node.id === edge.source)!;
      const targetModel = model.nodes.find((node) => node.id === edge.target)!;
      const scale =
        length /
        Math.hypot(
          targetModel.x - sourceModel.x,
          targetModel.y - sourceModel.y,
        );
      const route = routes.get(edge.id)!;
      const original = edgeCurveSegments(source, target, {
        controlPointDistancesPx: route.controlPointDistancesPx.map(
          (distance) => distance * scale,
        ),
        controlPointWeights: route.controlPointWeights,
      });
      verifyCurvePrefix(quadratics, original);
      if (model.settings.directed)
        verifyBoundaryEndpoint(quadratics.at(-1)!.end, original, target);
    }
  }
  for (const [rect] of markup.matchAll(/<rect\b[^>]+/g)) {
    const read = (attribute: string) =>
      Number(rect.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    const x = read("x"),
      y = read("y");
    const stroke = read("stroke-width") / 2;
    near(read("rx"), Math.min(read("width"), read("height")) / 2);
    near(read("ry"), read("rx"));
    assert(
      x - stroke >= 1 &&
        x + read("width") + stroke <= width - 1 &&
        y - stroke >= 1 &&
        y + read("height") + stroke <= height - 1,
      `editor painted pill leaves ${width}x${height} preview: ${rect}`,
    );
  }
  for (const [circle] of markup.matchAll(/<circle\b[^>]+/g)) {
    const read = (attribute: string) =>
      Number(circle.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    const x = read("cx"),
      y = read("cy"),
      radius = read("r") + read("stroke-width") / 2;
    const dense = model.nodes.length >= 12 || model.edges.length >= 30;
    const veryDense = model.nodes.length >= 16 || model.edges.length >= 40;
    near(
      read("r"),
      (veryDense ? 2.2 : dense ? 2.8 : Math.min(width, height) / 28) *
        (focus ? 1.1 : 1),
    );
    assert(
      x - radius >= 1 &&
        x + radius <= width - 1 &&
        y - radius >= 1 &&
        y + radius <= height - 1,
      `sample painted node leaves ${width}x${height} preview: ${circle}`,
    );
  }
}

function near(actual: number, expected: number) {
  assert(
    Math.abs(actual - expected) < 1e-8,
    `expected ${expected}, got ${actual}`,
  );
}

function verifyClippingFixtures() {
  for (const [x, y, width, height, distances, weights] of [
    [160, 0, 48, 48, [60], [0.5]],
    [160, 0, 48, 48, [60], [0.05]],
    [160, 0, 48, 48, [-60], [0.95]],
    [160, 0, 240, 48, [60], [0.5]],
    [20, 0, 48, 48, [180], [0.5]],
    [0.1, 0, 48, 48, [180], [0.5]],
    [20, 0, 48, 48, [0], [0.5]],
    [20, 0, 48, 48, [1], [0.5]],
    [160, 0, 48, 52.8, [60], [0.5]],
    [0, 160, 240, 48, [60], [0.5]],
    [160, 0, 48, 48, [120, -200, 180], [0.2, 0.5, 0.8]],
    [160, 0, 380, 48, [120, -200, 180], [0.2, 0.5, 0.8]],
    [160, 0, 380, 48, [180, 0, 0], [0.2, 0.5, 0.8]],
    [160, 0, 380, 48, [200, 0, -200, 0, 0], [0.1, 0.3, 0.5, 0.7, 0.9]],
  ] as const) {
    const source = { x: 0, y: 0 };
    const target = { x, y, width, height };
    const original = edgeCurveSegments(source, target, {
      controlPointDistancesPx: distances,
      controlPointWeights: weights,
    });
    const frozen = original.map((segment) =>
      Object.freeze({
        start: Object.freeze({ ...segment.start }),
        control: Object.freeze({ ...segment.control }),
        end: Object.freeze({ ...segment.end }),
      }),
    );
    const clipped = clipPreviewEdgeAtTarget(Object.freeze(frozen), {
      centre: target,
      width,
      height,
    });
    verifyCurvePrefix(clipped, original);
    verifyBoundaryEndpoint(clipped.at(-1)!.end, original, target, 1e-5);
    const path = createPreviewEdgePath({
      directed: true,
      radius: height / 2,
      targetWidth: width,
      scale: 1,
      source,
      target,
      routing: {
        bowPx: distances[0],
        controlPointDistancesPx: distances,
        controlPointWeights: weights,
        loopDirectionDeg: -45,
        loopSweepDeg: 70,
      },
    });
    verifyCurvePrefix(readQuadraticPath(path), original);
    if (x === 20 && distances[0] <= 1)
      assert.equal(
        clipped,
        frozen,
        "fully covered edges retain their original curve",
      );
    if (width === 380 && distances.at(-2) === 0)
      assert(
        clipped.length < original.length,
        "target-covered final segments are removed after the last visible entry",
      );
  }
  const longPillModel = createModel(true, 160, 0, 60);
  longPillModel.nodes[1].label = "long label 日本語";
  for (const variant of ["editor", "sample"] as const)
    for (const focus of [false, true])
      verifyRenderedFit(longPillModel, variant, focus);
}

function readQuadraticPath(path: string): QuadraticCurveSegment[] {
  const tokens = path.match(/[MQ]|-?\d+(?:\.\d+)?/g)!;
  assert.equal(tokens[0], "M");
  let start = { x: Number(tokens[1]), y: Number(tokens[2]) };
  const segments: QuadraticCurveSegment[] = [];
  for (let index = 3; index < tokens.length; index += 5) {
    assert.equal(tokens[index], "Q");
    const control = {
      x: Number(tokens[index + 1]),
      y: Number(tokens[index + 2]),
    };
    const end = { x: Number(tokens[index + 3]), y: Number(tokens[index + 4]) };
    segments.push({ start, control, end });
    start = end;
  }
  return segments;
}

/** Check the SVG's polynomial against the original curve at mapped parameters. */
function verifyCurvePrefix(
  actual: readonly QuadraticCurveSegment[],
  original: readonly QuadraticCurveSegment[],
) {
  assert(actual.length > 0 && actual.length <= original.length);
  for (const [index, segment] of actual.entries()) {
    const expected = original[index];
    const cx = expected.control.x - expected.start.x;
    const cy = expected.control.y - expected.start.y;
    const denominator = cx * cx + cy * cy;
    const cut =
      denominator === 0
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              ((segment.control.x - expected.start.x) * cx +
                (segment.control.y - expected.start.y) * cy) /
                denominator,
            ),
          );
    if (index < actual.length - 1) assert(Math.abs(cut - 1) < 0.001);
    for (let sample = 0; sample <= 100; sample++) {
      const parameter = sample / 100;
      const point = quadraticPolynomial(segment, parameter);
      const expectedPoint = quadraticPolynomial(expected, parameter * cut);
      assert(
        Math.hypot(point.x - expectedPoint.x, point.y - expectedPoint.y) <
          0.025,
        "the clipped SVG must follow an exact prefix of the original curve",
      );
    }
  }
}

function verifyBoundaryEndpoint(
  endpoint: EdgeCurvePoint,
  original: readonly QuadraticCurveSegment[],
  target: EdgeCurvePoint & { width: number; height: number },
  tolerance = 0.025,
) {
  const radius = Math.min(target.width, target.height) / 2;
  const distance = (point: EdgeCurvePoint) =>
    Math.hypot(
      Math.max(0, Math.abs(point.x - target.x) - target.width / 2 + radius),
      Math.max(0, Math.abs(point.y - target.y) - target.height / 2 + radius),
    ) - radius;
  const outside = original.some((segment) =>
    Array.from({ length: 201 }, (_, index) =>
      distance(quadraticPolynomial(segment, index / 200)),
    ).some((value) => value > 1e-8),
  );
  assert(
    outside
      ? Math.abs(distance(endpoint)) < tolerance
      : Math.hypot(endpoint.x - target.x, endpoint.y - target.y) < tolerance,
    `visible directed edges must reach the target pill boundary; covered edges stay beneath it: ${JSON.stringify({ endpoint, target, outside, distance: distance(endpoint), original })}`,
  );
}

function quadraticPolynomial(
  segment: QuadraticCurveSegment,
  parameter: number,
) {
  const inverse = 1 - parameter;
  return {
    x:
      inverse * inverse * segment.start.x +
      2 * inverse * parameter * segment.control.x +
      parameter * parameter * segment.end.x,
    y:
      inverse * inverse * segment.start.y +
      2 * inverse * parameter * segment.control.y +
      parameter * parameter * segment.end.y,
  };
}

function verifyPreviewPaintMatchesCanvas() {
  const palette = {
    selectionBoxBorder: "#000",
    selectionBoxFill: "#000",
    node: "var(--canvas-node)",
    nodeBorder: "var(--canvas-node-border)",
    nodeText: "var(--canvas-node-text)",
    nodeWhite: "var(--canvas-node-white)",
    nodeBlack: "var(--canvas-node-black)",
    nodeRed: "var(--canvas-node-red)",
    nodeYellow: "var(--canvas-node-yellow)",
    nodeBlue: "var(--canvas-node-blue)",
    nodeGreen: "var(--canvas-node-green)",
    nodePink: "var(--canvas-node-pink)",
    edge: "var(--canvas-edge)",
    edgeWhite: "var(--canvas-edge-white)",
    edgeBlack: "var(--canvas-edge-black)",
    edgeRed: "var(--canvas-edge-red)",
    edgeYellow: "var(--canvas-edge-yellow)",
    edgeBlue: "var(--canvas-edge-blue)",
    edgeGreen: "var(--canvas-edge-green)",
    edgePink: "var(--canvas-edge-pink)",
    labelBg: "#000",
    active: "#000",
    selectedNode: "#000",
    selectedNodeText: "#000",
    activeOpacity: 0.4,
    fontFamily: "sans-serif",
    nodeSize: 48,
    nodeFontSize: 16,
    edgeFontSize: 12,
    labelPadding: 5,
  } satisfies GraphCanvasPalette;
  // Compare actual SVG output against the independent canvas stylesheet. The
  // assertion deliberately does not import the shared stroke constants.
  const stylesheet = createGraphCanvasStylesheet(palette) as Array<{
    selector: string;
    style: Record<string, unknown>;
  }>;
  const nodeStyle = stylesheet.find(
    ({ selector }) => selector === "node",
  )!.style;
  const edgeStyle = stylesheet.find(
    ({ selector }) => selector === "edge",
  )!.style;
  const border = Number(nodeStyle["border-width"]);
  const nodeHeight = Number(nodeStyle.height);
  const edgeWidth = Number(edgeStyle.width);
  near(border, 2);
  near(edgeWidth, 2.5);
  for (const [width, height, targetX] of [
    [320, 300, 100],
    [160, 150, 100],
    [80, 75, 1000],
  ]) {
    const model = createModel(false, targetX, 0, 0);
    const markup = renderToStaticMarkup(
      createElement(SampleGraphPreview, {
        model,
        width,
        height,
        variant: "editor",
      }),
    );
    const rect = markup.match(/<rect\b[^>]+/)![0];
    const edge = markup.match(
      /<path\b[^>]*stroke="var\(--canvas-edge\)"[^>]+/,
    )![0];
    const read = (tag: string, attribute: string) =>
      Number(tag.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    const scale = read(rect, "height") / nodeHeight;
    const svgBorder = read(rect, "stroke-width");
    const svgEdgeWidth = read(edge, "stroke-width");
    near(svgBorder, Math.max(0.75, border * scale));
    near(svgEdgeWidth, Math.max(1, edgeWidth * scale));
    if (border * scale >= 0.75 && edgeWidth * scale >= 1) {
      near(svgBorder / read(rect, "height"), border / nodeHeight);
      near(svgEdgeWidth / svgBorder, edgeWidth / border);
    } else {
      near(svgBorder, 0.75);
      near(svgEdgeWidth, 1);
    }

    const sampleMarkup = renderToStaticMarkup(
      createElement(SampleGraphPreview, {
        model,
        width,
        height,
        variant: "sample",
      }),
    );
    const circle = sampleMarkup.match(/<circle\b[^>]+/)![0];
    const sampleEdge = sampleMarkup.match(
      /<path\b[^>]*stroke="var\(--canvas-edge\)"[^>]+/,
    )![0];
    const radius = read(circle, "r");
    near(read(circle, "stroke-width"), Math.max(1, radius * 0.55));
    near(read(sampleEdge, "stroke-width"), Math.max(0.9, radius * 0.42));
  }
  for (const color of [
    undefined,
    "paper",
    "white",
    "black",
    "red",
    "yellow",
    "blue",
    "green",
    "pink",
  ] as const) {
    const model = createModel(true);
    if (color) {
      model.nodes[0].color = color;
      model.edges[0].color = color;
    }
    const markup = renderToStaticMarkup(
      createElement(SampleGraphPreview, { model, variant: "editor" }),
    );
    const nodePaint = {
      ...nodeStyle,
      ...stylesheet.find(({ selector }) => selector === `node.color-${color}`)
        ?.style,
    };
    const edgePaint = {
      ...edgeStyle,
      ...stylesheet.find(({ selector }) => selector === `edge.color-${color}`)
        ?.style,
    };
    const rect = markup.match(/<rect\b[^>]+/)![0];
    const text = markup.match(/<text\b[^>]+/)![0];
    const edge = markup.match(/<path\b[^>]*stroke="[^"]+"[^>]+/)![0];
    const attribute = (tag: string, name: string) =>
      tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
    assert.equal(
      attribute(rect, "fill"),
      nodePaint["background-color"],
      `${color} node fill matches the canvas`,
    );
    assert.equal(
      attribute(rect, "stroke"),
      nodePaint["border-color"],
      `${color} node border matches the canvas`,
    );
    assert.equal(
      attribute(text, "fill"),
      nodePaint.color,
      `${color} label contrast matches the canvas`,
    );
    assert.equal(
      attribute(edge, "stroke"),
      edgePaint["line-color"],
      `${color} edge paint matches the canvas`,
    );
    assert.equal(
      Number(attribute(edge, "opacity")),
      edgePaint["line-opacity"],
      "editor edge opacity matches the canvas",
    );
    const markerId = attribute(edge, "marker-end")!.slice(5, -1);
    const marker = [...markup.matchAll(/<marker\b[^>]*>[\s\S]*?<\/marker>/g)]
      .map(([tag]) => tag)
      .find((tag) => attribute(tag, "id") === markerId)!;
    assert.equal(
      attribute(marker, "fill"),
      edgePaint["target-arrow-color"],
      `${color} arrow uses the corresponding edge color`,
    );
  }
}

function verifyPreviewSettings() {
  const render = (model: GraphModel, variant: "sample" | "editor" = "editor") =>
    renderToStaticMarkup(createElement(SampleGraphPreview, { model, variant }));
  const model = createModel(true, 160, 0, 180);
  model.nodes[1].label = "long label 日本語";
  const shown = render(model);
  const hidden = render({
    ...model,
    settings: { ...model.settings, showNodeLabels: false },
  });
  assert.equal([...shown.matchAll(/<text\b/g)].length, 2);
  assert.doesNotMatch(
    hidden,
    /<text\b/,
    "hidden-label editor previews omit labels",
  );
  for (const [rect] of hidden.matchAll(/<rect\b[^>]+/g)) {
    const read = (attribute: string) =>
      Number(rect.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    near(read("width"), read("height"));
  }
  const dense = {
    ...model,
    nodes: Array.from({ length: 16 }, (_, order) => ({
      id: `n${order}`,
      order,
      label: String(order),
      x: order * 100,
      y: 0,
    })),
    edges: [],
  };
  assert.equal(
    [...render(dense).matchAll(/<text\b/g)].length,
    16,
    "editor previews honor visible labels even on larger graphs",
  );

  const colored: GraphModel = {
    ...model,
    nodes: model.nodes.map((node, index) => ({
      ...node,
      color: (index === 0 ? "red" : "black") as GraphColor,
    })),
    edges: [
      { ...model.edges[0], color: "blue" },
      { id: "reverse", source: "b", target: "a", color: "red" },
    ],
    settings: { ...model.settings, showNodeLabels: false, arrowScale: 2 },
  };
  const coloredMarkup = render(colored);
  const references = [
    ...coloredMarkup.matchAll(/marker-end="url\(#([^)]+)\)"/g),
  ].map((match) => match[1]);
  assert.equal(
    new Set(references).size,
    2,
    "independently colored edges use distinct markers",
  );
  for (const reference of references)
    assert(
      coloredMarkup.includes(`id="${reference}"`),
      "every colored edge references an emitted marker",
    );
  assert.equal(
    render(colored, "sample"),
    render(
      {
        ...colored,
        nodes: model.nodes,
        edges: colored.edges.map(({ color: _color, ...edge }) => edge),
        settings: model.settings,
      },
      "sample",
    ),
    "gallery previews retain their intentional simplified palette, labels and arrow size",
  );

  for (const variant of ["editor", "sample"] as const)
    for (const arrowScale of [0.6, 1, 2])
      for (const showNodeLabels of [false, true])
        for (const focus of [false, true])
          for (const [width, height] of [
            [80, 75],
            [98, 76],
            [160, 150],
          ]) {
            for (const [x, y, bow] of [
              [0.1, 0, 180],
              [20, 0, 0.5],
              [160, 0, 180],
              [0, 0, 0],
            ]) {
              const fixture = createModel(true, x, y, bow);
              fixture.nodes[1].label = "long label 日本語";
              fixture.nodes[0].color = "black";
              fixture.edges[0].color = "red";
              fixture.settings = {
                ...fixture.settings,
                arrowScale,
                showNodeLabels,
              };
              verifyRenderedFit(fixture, variant, focus, width, height);
            }
            const loop: GraphModel = {
              ...createEmptyGraphModel({
                directed: true,
                arrowScale,
                showNodeLabels,
              }),
              nodes: [
                {
                  id: "a",
                  label: "long label 日本語",
                  order: 0,
                  x: 0,
                  y: 0,
                  color: "white",
                },
              ],
              edges: [
                {
                  id: "loop",
                  source: "a",
                  target: "a",
                  color: "blue",
                  routing: {
                    loopDirectionDeg: 120,
                    loopSweepDeg: 110,
                  },
                },
              ],
            };
            verifyRenderedFit(loop, variant, focus, width, height);
          }
}
